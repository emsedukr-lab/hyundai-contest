import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Switch } from '@astryxdesign/core/Switch';
import type { Home, Trip } from '@tteonaljido/shared';
import { CheckIcon, StarIcon } from '../components/shell/icons';
import { shortDate } from '../lib/format';
import { t } from '../lib/i18n';
import { recommendRoute, summarizeRecommendation } from '../lib/recommend';
import { allRuns, applyRun, fetchRun } from '../lib/routeTimes';
import { placeOf, removePlace, setReservation, setupReady, suggestVisitTime, updateVisit, type SetupStep } from '../lib/trips';
import { useNotes } from './NotesContext';
import { PlaceCollector } from './sheets/PlaceSheet';
import type { Notice } from './sheets/PlaceSheet';
import { RecommendPreview } from './RecommendDialog';
import { CATEGORY_LABEL } from './PlaceSearch';
import { TripInfoPanel } from './TripInfoPanel';
import './timeline.css';
import { TimeSelect } from './TimeSelect';

const STEPS: SetupStep[] = [1, 2, 3, 4];
const TITLE: Record<SetupStep, 'setup.step1' | 'setup.step2' | 'setup.step3' | 'setup.step4'> = { 1: 'setup.step1', 2: 'setup.step2', 3: 'setup.step3', 4: 'setup.step4' };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A new trip, step by step (M43): ① 여행 정보 (name, dates, start/home, every night's lodging or 미정) → ② 장소 담기
 * → ③ 예약·꼭 갈 곳 (booked places get their day and time, must-sees a ★) → ④ 경로 추천, which shows its work —
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
  const { lodgingTbd } = useNotes();
  const [phase, setPhase] = useState<'idle' | 'running' | 'preview'>('idle');
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<{ plan: Trip; meters: Record<string, number> } | null>(null);
  const ready = setupReady(plan, lodgingTbd, step);

  /** 경로 추천: the real work runs between the progress lines, so what the user watches is what happens. */
  const run = async () => {
    setPhase('running');
    setStage(1);
    await wait(500);
    const proposed = recommendRoute(plan, home);
    setStage(2);
    await wait(500);
    setStage(3);
    let next = proposed;
    const meters: Record<string, number> = {};
    for (const r of allRuns(next, home)) {
      const res = await fetchRun(r);
      if (!res) break; // directions unavailable: the preview simply shows no times there
      const out = applyRun(next, r, res, { overwrite: true });
      next = out.plan;
      Object.assign(meters, out.meters);
    }
    await wait(300);
    setResult({ plan: next, meters });
    setPhase('preview');
  };

  const go = (s: SetupStep) => {
    setPhase('idle');
    setResult(null);
    onStep(s);
    window.scrollTo({ top: 0 });
  };

  const visits = plan.visits.filter((v) => placeOf(plan, v.placeRef)?.category !== 'LODGING');
  const progress = [t('setup.progress.locate'), t('setup.progress.split'), t('setup.progress.route')];

  return (
    <div className="tl-setup">
      <div className="tn-pad tl-setup-head">
        <span className="tl-kicker">{t('setup.kicker', { step })}</span>
        <h2 className="tl-setup-title">{t(TITLE[step])}</h2>
        <div className="tl-setup-dots" aria-hidden="true">
          {STEPS.map((s) => (
            <span key={s} className={`tl-setup-dot${s <= step ? ' is-on' : ''}`} />
          ))}
        </div>
      </div>

      {step === 1 && <TripInfoPanel plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} />}

      {step === 2 && (
        <div className="tn-pad tl-setup-body">
          <p className="tl-setup-hint">{t('setup.step2.hint')}</p>
          <PlaceCollector plan={plan} onChange={onChange} onOpenPlace={onOpenPlace} onNotice={onNotice} onRemovePlace={(ref) => onChange(removePlace(plan, ref))} />
        </div>
      )}

      {step === 3 && (
        <div className="tn-pad tl-setup-body">
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
                    <button
                      type="button"
                      className={`tl-chip${must ? ' is-on' : ''}`}
                      aria-pressed={must}
                      aria-label={t('setup.mustAria', { name: p?.name ?? '' })}
                      onClick={() => onChange(updateVisit(plan, v.visitId, { importance: must ? 'NORMAL' : 'MUST' }))}>
                      <StarIcon filled={must} />
                      {t('common.must')}
                    </button>
                  </div>
                  <Switch label={t('setup.reserved')} value={booked} onChange={(on) => (on ? reserve(day, v.fixed?.time ?? suggestVisitTime(plan, v.visitId, day)) : onChange(setReservation(plan, v.visitId, null, null)))} />
                  {booked && (
                    <div className="tl-setup-reserve">
                      <Selector
                        label={t('setup.reserveDay')}
                        isLabelHidden
                        placement="below"
                        options={plan.days.map((d) => ({ value: String(d.dayIndex), label: `${t('common.day', { day: d.dayIndex })} · ${shortDate(d.date)}` }))}
                        value={String(day)}
                        onChange={(d) => reserve(Number(d), v.fixed!.time)}
                      />
                      <TimeSelect label={t('setup.reserveTime')} value={v.fixed!.time} suggest={suggestVisitTime(plan, v.visitId, day)} onChange={(x) => x && reserve(day, x)} />
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
          {phase === 'preview' && result && <RecommendPreview display={result.plan} diff={summarizeRecommendation(plan, result.plan)} />}
          <button type="button" className="tl-textbtn tl-setup-skip" onClick={() => onFinish(null)}>
            {t('setup.skip')}
          </button>
        </div>
      )}

      {/* room so the last card clears the fixed buttons */}
      <div style={{ height: 112 }} />
      <div className="tn-cta">
        <div className="tn-cta-inner">
          {step > 1 && phase !== 'running' && <Button label={t('setup.prev')} variant="secondary" size="lg" onClick={() => go((step - 1) as SetupStep)} />}
          {step < 4 && <Button label={t('setup.next')} variant="primary" size="lg" isDisabled={!ready.ok} onClick={() => go((step + 1) as SetupStep)} />}
          {step === 4 && phase === 'idle' && <Button label={t('setup.run')} variant="primary" size="lg" onClick={() => void run()} />}
          {step === 4 && phase === 'running' && <Button label={t('setup.run')} variant="primary" size="lg" isLoading onClick={() => undefined} />}
          {step === 4 && phase === 'preview' && result && <Button label={t('setup.start')} variant="primary" size="lg" onClick={() => onFinish(result)} />}
        </div>
        {!ready.ok && step < 4 && <p className="tl-setup-need">{ready.reason}</p>}
      </div>
    </div>
  );
}
