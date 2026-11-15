import { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import type { Home, Trip } from '@tteonaljido/shared';
import { CheckIcon, CloseIcon, PushPinIcon } from '../components/shell/icons';
import { shortDate } from '../lib/format';
import { t } from '../lib/i18n';
import { naverShareUrl } from '../lib/placeShare';
import { readPaste } from '../lib/pasteImport';
import type { ResolvedList } from '../lib/pairing';
import { Sheet } from './Sheet';
import { favorites } from '../lib/db';
import { recommend, summarizeRecommendation, type RecommendInsights, type RecommendationDiff } from '../lib/recommend';
import { getHere, locate } from '../lib/here';
import { allRuns, applyRun, fetchRun } from '../lib/routeTimes';
import { mealTimes as storedMealTimes } from '../lib/meals';
import { collectedPlaces, placeOf, relinkLegs, rememberLegs, removePlace, setReservation, setupReady, suggestVisitTime, updateVisit, type LegBook, type SetupStep } from '../lib/trips';
import { MealChips, useNotes } from './NotesContext';
import { PlaceCollector } from './sheets/PlaceSheet';
import type { Notice } from './sheets/PlaceSheet';
import { RecommendPreview } from './RecommendPreview';
import { CATEGORY_LABEL } from './PlaceSearch';
import { TripInfoPanel } from './TripInfoPanel';
import './timeline.css';
import { TimeSelect } from './TimeSelect';

const STEPS: SetupStep[] = [1, 3, 4];
const TITLE: Record<SetupStep, 'setup.step1' | 'setup.step2' | 'setup.step3' | 'setup.step4'> = { 1: 'setup.step1', 2: 'setup.step1', 3: 'setup.step3', 4: 'setup.step4' };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A new trip, step by step: ① 일정·장소 (optional name, dates, start/home, collected places)
 * → ② 숙소·예약 (lodging or 미정, booked places get their day and time, must-sees a pin) → ③ 경로 추천, which shows its work —
 * locations, days and order, Kakao travel times — and then the proposed days. Only after 이 일정으로 시작 does the
 * editor show the day-by-day itinerary. Every step is saved as it goes, so leaving and coming back resumes here.
 */
export function TripSetup({
  plan,
  home,
  step,
  onStep,
  onChange,
  onOpenPlace,
  onNotice,
  onOpenSettings,
  onFinish,
}: {
  plan: Trip;
  home: Home | null;
  step: SetupStep;
  onStep: (s: SetupStep) => void;
  onChange: (p: Trip) => void;
  onOpenPlace: (ref: string) => void;
  onNotice: (n: Notice) => void;
  onOpenSettings: () => void;
  /** 이 일정으로 시작 (the proposed plan and its Kakao distances), or null for 추천 없이 직접 짤게요. */
  onFinish: (result: { plan: Trip; meters: Record<string, number> } | null) => void;
}) {
  const { lodgingTbd, notes } = useNotes();
  const [phase, setPhase] = useState<'idle' | 'running' | 'preview'>('idle');
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<{ plan: Trip; meters: Record<string, number>; insights: RecommendInsights; diff: RecommendationDiff } | null>(null);
  const ready = setupReady(plan, lodgingTbd, step);
  // What a step still needs reads as a hint until 다음 was tried: only then is it an error (red, and announced).
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [checkingClipboard, setCheckingClipboard] = useState(false);
  const [importingClipboard, setImportingClipboard] = useState(false);
  const [importReview, setImportReview] = useState<{ terms?: string[]; list?: ResolvedList } | null>(null);
  const [tried, setTried] = useState(false);
  useEffect(() => setTried(false), [step]);

  /** 경로 추천: the real work runs between the progress lines, so what the user watches is what happens. */
  const run = async () => {
    setPhase('running');
    setStage(1);
    // A trip that starts from 현재 위치 is timed from where this phone is: asked here, on the user's tap. Without
    // it the first leg simply stays for the car to time.
    if (plan.origin.kind === 'CURRENT' && !getHere()) await locate(8_000);
    await wait(500);
    const pool = await favorites.all().catch(() => []);
    // The whole trip is arranged at once: first on straight-line estimates of the driving times…
    const mealTimes = storedMealTimes();
    let found = recommend(plan, home, { notes, pool, mealTimes });
    setStage(2);
    await wait(500);
    setStage(3);
    const meters: Record<string, number> = {};
    const timed = async (from: Trip): Promise<Trip> => {
      let next = from;
      for (const r of allRuns(next, home)) {
        const res = await fetchRun(r);
        if (!res) break; // directions unavailable: the preview simply shows no times there
        const out = applyRun(next, r, res, { overwrite: true });
        next = out.plan;
        Object.assign(meters, out.meters);
      }
      return next;
    };
    let next = await timed(found.plan);
    // …then once more with the real times of that order, in case they change which order is best.
    const book: LegBook = new Map();
    rememberLegs(next, book);
    const again = recommend(next, home, { notes, pool, book, mealTimes });
    if (again.plan !== next && summarizeRecommendation(next, again.plan).changed) next = await timed(relinkLegs(next, again.plan, book));
    found = { plan: next, insights: again.insights };
    await wait(300);
    setResult({ plan: next, meters, insights: found.insights, diff: summarizeRecommendation(plan, next) });
    setPhase('preview');
  };

  const go = (s: SetupStep) => {
    setPhase('idle');
    setResult(null);
    onStep(s);
    window.scrollTo({ top: 0 });
  };

  const next = async () => {
    if (ready.ok) return go(step < 3 ? 3 : 4);
    if (step >= 3) return setTried(true);
    setCheckingClipboard(true);
    let url: string | null = null;
    try { url = naverShareUrl(await navigator.clipboard.readText()); }
    catch { /* Clipboard access is optional; manual paste stays available on this page. */ }
    setClipboardUrl(url);
    setCheckingClipboard(false);
    if (!url) {
      setTried(true);
      document.getElementById('setup-places')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
  };
  const importClipboard = async () => {
    if (!clipboardUrl || importingClipboard) return;
    setImportingClipboard(true);
    try {
      const out = await readPaste(clipboardUrl);
      if (out.kind === 'list') setImportReview({ list: out.list });
      else if (out.kind === 'terms') setImportReview({ terms: out.terms });
      else onNotice({ tone: 'error', text: t('place.resolve.failed') });
    } catch {
      onNotice({ tone: 'error', text: t('place.resolve.failed') });
    } finally {
      setClipboardUrl(null);
      setImportingClipboard(false);
    }
  };

  const visits = plan.visits.filter((v) => placeOf(plan, v.placeRef)?.category !== 'LODGING');
  const marked = {
    must: visits.filter((v) => v.importance === 'MUST' || v.fixed?.kind === 'RESERVATION').length,
    booked: visits.filter((v) => v.fixed?.kind === 'RESERVATION').length,
  };
  const progress = [t('setup.progress.locate'), t('setup.progress.split'), t('setup.progress.route')];

  return (
    <div className="tl-setup">
      <div className="tn-pad tl-setup-head">
        {step >= 3 && <h2 className="tl-setup-title">{t(TITLE[step])}</h2>}
        <div className="tl-setup-dots" aria-hidden="true">
          {STEPS.map((s) => (
            <span key={s} className={`tl-setup-dot${s <= step ? ' is-on' : ''}`} />
          ))}
        </div>
      </div>

      {(step === 1 || step === 2) && (
        <>
          <TripInfoPanel plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} section="basics" showRequired={tried} showEndpoints={false} />
          <div id="setup-places" className="tn-pad tl-setup-body tl-setup-places" style={{ scrollMarginTop: 72 }}>
            <h3 className="tl-sheet-section">{t('setup.step2')}</h3>
            <PlaceCollector importReview={importReview} onImportClose={() => setImportReview(null)} plan={plan} onChange={onChange} onOpenPlace={onOpenPlace} onNotice={onNotice} onRemovePlace={(ref) => onChange(removePlace(plan, ref))} />
          </div>
        </>
      )}

      {step === 3 && (
        <div className="tn-pad tl-setup-body">
          <p className="tl-setup-hint">{t('setup.lodging.hint')}</p>
          <TripInfoPanel plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} section="lodging" showRequired={tried} />
          <div className="tl-setup-bookings-head">
            <h3 className="tl-sheet-section">{t('setup.bookings')}</h3>
            <span className="tl-setup-count"><PushPinIcon />{t('setup.bookings.count', marked)}</span>
          </div>
          <p className="tl-setup-hint">{t('setup.step3.hint')}</p>
          <div className="tl-setup-list">
            {visits.map((v) => {
              const p = placeOf(plan, v.placeRef);
              const day = plan.days.find((d) => d.visitOrder.includes(v.visitId))?.dayIndex ?? plan.days[0].dayIndex;
              const booked = v.fixed?.kind === 'RESERVATION';
              const must = v.importance === 'MUST';
              const reserve = (d: number, time: string) => {
                try {
                  onChange(setReservation(plan, v.visitId, d, time));
                } catch (e) {
                  onNotice({ tone: 'error', text: (e as Error).message });
                }
              };
              return (
                <Card key={v.visitId} padding={3}>
                  <div className="tl-setup-row">
                    <div className="tl-setup-row-text">
                      <span className="tl-name">{p?.name}</span>
                      <span className="tl-meta">{p ? CATEGORY_LABEL[p.category] : ''}</span>
                    </div>
                    {/* Off the pin is outlined; on it is filled. A booked place is always kept by the recommendation,
                        so its pin shows on and cannot be turned off while the booking stands. */}
                    <button
                      type="button"
                      className={`tl-pin${must || booked ? ' is-on' : ''}`}
                      aria-pressed={must || booked}
                      aria-label={t('setup.mustAria', { name: p?.name ?? '' })}
                      disabled={booked}
                      onClick={() => onChange(updateVisit(plan, v.visitId, { importance: must ? 'NORMAL' : 'MUST' }))}>
                      <PushPinIcon />
                    </button>
                    <button type="button" className="tn-iconbtn pc-remove" aria-label={t('place.removeNamed', { name: p?.name ?? '' })} onClick={() => onChange(removePlace(plan, v.placeRef))}>
                      <CloseIcon />
                    </button>
                  </div>
                  {/* A restaurant's meal, set before the first recommendation: 상관없음 unless chosen. A booked
                      time already says which meal it is, so the choice is not offered then. */}
                  {p?.category === 'FOOD' && !booked && (
                    <div className="tl-setup-meal">
                      <span className="tl-meta">{t('meal.title')}</span>
                      <MealChips placeRef={v.placeRef} label={t('meal.aria', { name: p.name })} />
                    </div>
                  )}
                  {/* Most places are not booked: a small text button, and the day and time only once it is pressed. */}
                  {booked ? (
                    <div className="tl-setup-reserve">
                      <span className="tl-setup-reserve-label"><CheckIcon />{t('setup.reserve.saved')}</span>
                      <Selector
                        label={t('setup.reserveDay')}
                        isLabelHidden
                        placement="below"
                        options={plan.days.map((d) => ({ value: String(d.dayIndex), label: `${t('common.day', { day: d.dayIndex })} · ${shortDate(d.date)}` }))}
                        value={String(day)}
                        onChange={(d) => reserve(Number(d), v.fixed!.time)}
                      />
                      <TimeSelect label={t('setup.reserveTime')} value={v.fixed!.time} suggest={suggestVisitTime(plan, v.visitId, day)} onChange={(x) => x && reserve(day, x)} />
                      <button type="button" className="tn-iconbtn" aria-label={t('setup.reserve.clearAria', { name: p?.name ?? '' })} onClick={() => onChange(setReservation(plan, v.visitId, null, null))}>
                        <CloseIcon />
                      </button>
                    </div>
                  ) : (
                    <div className="tl-setup-reserve-add">
                      <button type="button" className="tl-textbtn" onClick={() => reserve(day, suggestVisitTime(plan, v.visitId, day))}>
                        {t('setup.reserve.add')}
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="tn-pad tl-setup-body">
          {phase === 'idle' && <p className="tl-setup-hint">{t('setup.step4.hint', { n: visits.length, days: plan.days.length })}</p>}
          {phase !== 'idle' && (
            <ol className="tl-setup-progress" aria-live="polite">
              {progress.map((label, i) => {
                const n = i + 1;
                const state = phase === 'preview' || stage > n ? 'done' : stage === n ? 'now' : 'wait';
                return (
                  <li key={label} className={`is-${state}`}>
                    <span className="tl-setup-progress-mark" aria-hidden="true">
                      {state === 'done' ? <CheckIcon /> : state === 'now' ? <Spinner size="sm" /> : null}
                    </span>
                    {label}
                  </li>
                );
              })}
            </ol>
          )}
          {phase === 'preview' && result && (
            <>
              <p className="tl-setup-hint">{t('recommend.rules')}</p>
              <RecommendPreview display={result.plan} home={home} diff={result.diff} insights={result.insights} showNew={false} />
            </>
          )}
          <button type="button" className="tl-textbtn tl-setup-skip" onClick={() => onFinish(null)}>
            {t('setup.skip')}
          </button>
        </div>
      )}

      {clipboardUrl && (
        <Sheet
          isOpen
          onClose={() => !importingClipboard && setClipboardUrl(null)}
          title={t('setup.clipboard.title')}
          footer={<div className="tn-btnrow">
            <Button label={t('setup.clipboard.later')} variant="secondary" isDisabled={importingClipboard} onClick={() => setClipboardUrl(null)} />
            <Button label={t('setup.clipboard.import')} variant="primary" isLoading={importingClipboard} onClick={() => void importClipboard()} />
          </div>}>
          <p className="tl-meta" style={{ overflowWrap: 'anywhere' }}>{clipboardUrl}</p>
        </Sheet>
      )}

      {/* room so the last card clears the fixed buttons */}
      <div style={{ height: 112 }} />
      <div className="tn-cta">
        {/* Tapping a disabled Next marks the lodging fields that still need a choice. */}
        <div className="tn-cta-inner" onClickCapture={() => !ready.ok && step === 3 && setTried(true)}>
          {step >= 3 && phase !== 'running' && <Button label={t('setup.prev')} variant="secondary" size="lg" onClick={() => go(step === 4 ? 3 : 1)} />}
          {step < 4 && <Button label={step < 3 && collectedPlaces(plan).length > 0 ? t('setup.nextPlaces', { n: collectedPlaces(plan).length }) : t('setup.next')} variant="primary" size="lg" isDisabled={!ready.ok && step === 3} isLoading={checkingClipboard} onClick={() => void next()} />}
          {step === 4 && phase === 'idle' && <Button label={t('setup.run')} variant="primary" size="lg" onClick={() => void run()} />}
          {step === 4 && phase === 'running' && <Button label={t('setup.run')} variant="primary" size="lg" isLoading onClick={() => undefined} />}
          {step === 4 && phase === 'preview' && result && <Button label={t('setup.start')} variant="primary" size="lg" onClick={() => onFinish(result)} />}
        </div>
      </div>
    </div>
  );
}
