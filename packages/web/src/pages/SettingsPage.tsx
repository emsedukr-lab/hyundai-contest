import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ToastNotice } from '../components/ToastNotice';
import { Button } from '@astryxdesign/core/Button';
import { FileInput } from '@astryxdesign/core/FileInput';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useInstallPrompt } from '../components/InstallHint';
import { PlusIcon, SaveIcon, FolderOpenIcon, PinIcon, TrashIcon, InfoIcon, PhoneIcon, PresetIcon, ShieldIcon } from '../components/shell/icons';
import { Row, Section } from '../components/shell/rows';
import { PushScreen } from '../components/shell/Screens';
import { TRIPS_CHANGED, trips } from '../lib/db';
import type { MealSlot } from '@tteonaljido/shared';
import { checkBackupTrip } from '../lib/backup';
import { saveFile } from '../lib/fileOut';
import { t } from '../lib/i18n';
import { MEAL_SLOTS, isDefaultMealTimes, mealLabel, mealRange, mealTimes, mealTimesError, setMealTimes, type MealTimes } from '../lib/meals';
import { navigate } from '../lib/router';
import { isNativeApp } from '../lib/platform';
import { presetSlots, presetLabel, presetPlace } from '../lib/settings';
import { docFromShare, importShare, isShareFile } from '../lib/share';
import { nowIso, type TripDoc } from '../lib/trips';

const MealTimeSheet = lazy(() => import('../editor/MealTimeSheet').then((m) => ({ default: m.MealTimeSheet })));
const TripDefaultsSheet = lazy(() => import('../editor/TripDefaultsSheet').then((m) => ({ default: m.TripDefaultsSheet })));

/**
 * 설정 tab: named endpoint shortcuts, meal times for the route recommendation, trip data (backup out, backup or a friend's share file in) and
 * the app (install, privacy, about). The import logic is the one that used to sit on the trips screen, moved as-is.
 */
export function SettingsPage() {
  const [docs, setDocs] = useState<TripDoc[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  // A friend's encrypted share needs a passcode; hold the file text until it is entered.
  const [shareText, setShareText] = useState<string | null>(null);
  const [sharePass, setSharePass] = useState('');
  const install = useInstallPrompt();
  const presets = presetSlots().map((slot) => ({ slot, place: presetPlace(slot) }));
  const [tripDefaultsOpen, setTripDefaultsOpen] = useState(false);

  // 식사 시간: one meal is edited in a sheet as a draft and kept on 저장, only while it stays in order with the others.
  const [meals, setMeals] = useState<MealTimes>(mealTimes);
  const [mealSlot, setMealSlot] = useState<MealSlot>('lunch');
  const [mealDraft, setMealDraft] = useState<[string, string] | null>(null);
  const draftTimes: MealTimes = mealDraft ? { ...meals, [mealSlot]: mealDraft } : meals;
  const mealError = mealDraft ? mealTimesError(draftTimes, mealSlot) : null;
  const neighbour = MEAL_SLOTS[MEAL_SLOTS.indexOf(mealSlot) + (mealError === 'OVERLAP_BEFORE' ? -1 : 1)];
  const mealErrorText =
    mealError === 'ORDER' ? t('settings.meals.error.order')
    : mealError === 'OVERLAP_BEFORE' ? t('settings.meals.error.before', { other: mealLabel(neighbour), range: mealRange(meals, neighbour), time: meals[neighbour][1] })
    : mealError === 'OVERLAP_AFTER' ? t('settings.meals.error.after', { other: mealLabel(neighbour), range: mealRange(meals, neighbour), time: meals[neighbour][0] })
    : null;
  const saveMeal = () => {
    if (!mealDraft || mealError) return;
    setMealTimes(draftTimes);
    setMeals(mealTimes()); // read back: shows what was actually kept
    setMealDraft(null);
  };
  const resetMeals = () => {
    setMealTimes(null);
    setMeals(mealTimes());
    setMessage(t('settings.meals.resetDone'));
  };

  const reload = async () => setDocs(await trips.all());
  useEffect(() => {
    const refresh = () => { void reload().catch(() => setMessage(t('settings.fileFailed'))); };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener(TRIPS_CHANGED, refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); window.removeEventListener(TRIPS_CHANGED, refresh); };
  }, []);

  const exportAll = async () => {
    try {
      const current = await trips.all();
      if (!current.length) return setMessage(t('settings.noTrips'));
      const blob = new Blob([JSON.stringify({ format: 'tteonaljido-backup', version: 1, trips: current }, null, 2)], { type: 'application/json' });
      if (await saveFile(new File([blob], t('home.backupFileName', { date: nowIso().slice(0, 10) }), { type: 'application/json' }))) setMessage(t('settings.filePrepared'));
    } catch { setMessage(t('settings.fileFailed')); }
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    // A friend's share is encrypted: hold it and ask for the passcode instead of importing immediately.
    if (isShareFile(text)) {
      setShareText(text);
      setSharePass('');
      return;
    }
    try {
      const data = JSON.parse(text) as { format?: string; trips?: TripDoc[] };
      if (data.format !== 'tteonaljido-backup' || !Array.isArray(data.trips)) throw new Error('not a backup');
      // Every trip is checked the way the car checks a transfer before anything is written: one broken entry would
      // otherwise be stored and crash the trip list on every launch. All or nothing — no half-imported backup.
      const checked = await Promise.all(data.trips.map((d) => checkBackupTrip(d)));
      if (checked.some((d) => d === null)) throw new Error('not a backup');
      const ok = checked as TripDoc[];
      // A backup replaces trips with the same id; warn before overwriting any.
      const existing = new Set((await trips.all()).map((d) => d.tripId));
      const overwrites = ok.filter((d) => existing.has(d.tripId)).length;
      if (overwrites > 0 && !window.confirm(t('home.import.overwrite', { n: overwrites }))) return;
      for (const d of ok) await trips.put(d);
      setMessage(t('home.imported', { n: ok.length }));
      await reload();
    } catch {
      setMessage(t('home.notBackup'));
    }
  };

  const importSharedTrip = async () => {
    if (!shareText) return;
    const r = await importShare(shareText, sharePass.trim());
    if (!r.ok) return setMessage(t(r.reason === 'passcode' ? 'share.wrongPass' : 'share.invalid'));
    await trips.put(await docFromShare(r.transfer));
    setShareText(null);
    setSharePass('');
    setMessage(t('share.received'));
    await reload();
  };

  return (
    <PushScreen title={t('nav.settings')} onBack={() => navigate('/')}>
      {message && <ToastNotice status="info" title={message} onDismiss={() => setMessage(null)} />}

      {/* Start places for new trips: 집, 회사, and registered custom places. */}
      <Section title={t('settings.origins')}>
        <ul className="tn-cards">
          {presets.map(({ slot, place }) => (
            <li key={slot}>
              <Row
                href={`/settings/place/${slot}`}
                onClick={() => navigate(`/settings/place/${slot}`)}
                lead={<PresetIcon slot={slot} />}
                title={presetLabel(slot)}
                subtitle={place?.address || t('settings.home.unset')}
                chevron
              />
            </li>
          ))}
          <li><Row lead={<PinIcon />} title={t('setup.endpoints')} subtitle={t('settings.tripDefaults.detail')} chevron onClick={() => setTripDefaultsOpen(true)} /></li>
        </ul>
        <div className="tn-pad" style={{ paddingTop: 12 }}><Button label={t('settings.preset.add')} icon={<PlusIcon />} variant="secondary" width="100%" onClick={() => navigate('/settings/place/new')} /></div>
        <p className="tn-note">
          {t('settings.origins.detail2')}
        </p>
      </Section>
      {tripDefaultsOpen && <Suspense fallback={null}>
        <TripDefaultsSheet onClose={() => setTripDefaultsOpen(false)} onSaved={() => { setTripDefaultsOpen(false); setMessage(t('settings.tripDefaults.saved')); }} />
      </Suspense>}

      {/* 식사 시간: when each meal is eaten — what the route recommendation places restaurants by. Phone only. */}
      <Section
        title={t('settings.meals')}
        action={
          !isDefaultMealTimes(meals) && (
            <button type="button" className="tn-textaction" onClick={resetMeals}>
              {t('settings.meals.reset')}
            </button>
          )
        }>
        <ul className="tn-cards">
          {MEAL_SLOTS.map((slot) => (
            <li key={slot}>
              <Row
                title={mealLabel(slot)}
                end={<span className="tn-row-value">{mealRange(meals, slot)}</span>}
                chevron
                onClick={() => {
                  setMealSlot(slot);
                  setMealDraft([...meals[slot]]);
                }}
              />
            </li>
          ))}
        </ul>
        <p className="tn-note">{t('settings.meals.detail')}</p>
      </Section>
      {/* The sheet and its time pickers are the editor's: loaded when a row is first tapped, not with the tab. */}
      {mealDraft && (
        <Suspense fallback={null}>
          <MealTimeSheet
            title={t('settings.meals.sheet', { meal: mealLabel(mealSlot) })}
            fromLabel={t('settings.meals.fromOf', { meal: mealLabel(mealSlot) })}
            toLabel={t('settings.meals.toOf', { meal: mealLabel(mealSlot) })}
            value={mealDraft}
            error={mealErrorText}
            onChange={setMealDraft}
            onSave={saveMeal}
            onClose={() => setMealDraft(null)}
          />
        </Suspense>
      )}

      <Section title={t('settings.places')}>
        <ul className="tn-cards"><li><Row lead={<PinIcon />} title={t('settings.placeLibrary')} subtitle={t('settings.placeLibrary.detail')} href="/places" onClick={() => navigate('/places')} chevron /></li></ul>
      </Section>
      <Section title={t('more.data')}>
        <div className="tn-pad" style={{ paddingBottom: 12 }}>
          <ToastNotice status="info" title={t('settings.backupHint')} description={t(isNativeApp ? 'settings.backupRisk.native' : 'settings.backupRisk')} />
        </div>
        <ul className="tn-cards">
          <li>
            <Row lead={<SaveIcon />} title={t('home.exportBackup')} subtitle={t(docs.length ? isNativeApp ? 'settings.export.native' : 'more.export.detail' : 'settings.noTrips')} end={<span className="tn-row-value">{t(docs.length ? 'settings.fileSave' : 'settings.fileNone')}</span>} onClick={docs.length ? () => void exportAll() : undefined} />
          </li>
          <li>
            <Row lead={<FolderOpenIcon />} title={t('home.importBackup')} subtitle={t('more.import.detail')} end={<span className="tn-row-value">{t('settings.fileOpen')}</span>} onClick={() => importInput.current?.click()} />
          </li>
          <li>
            <Row lead={<TrashIcon />} title={t('trash.title')} subtitle={t('trash.hint')} href="/settings/trash" onClick={() => navigate('/settings/trash')} chevron />
          </li>
        </ul>
        <div hidden>
          <FileInput
            ref={importInput}
            label={t('home.backupFile.label')}
            mode="input"
            accept="application/json"
            value={null}
            onChange={(f) => {
              const file = Array.isArray(f) ? f[0] : f;
              if (file) void importFile(file).catch(() => setMessage(t('home.notBackup'))).finally(() => { if (importInput.current) importInput.current.value = ''; });
            }}
          />
        </div>
        {shareText && (
          <div className="tn-panel" style={{ marginTop: 12 }}>
            <ToastNotice status="info" title={t('share.importTitle')} description={t('share.importHint')} />
            <TextInput label={t('share.passcode')} value={sharePass} inputMode="numeric" onChange={setSharePass} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button label={t('common.cancel')} variant="secondary" size="lg" onClick={() => setShareText(null)} />
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <Button label={t('share.importAction')} variant="primary" size="lg" width="100%" isDisabled={sharePass.trim().length < 4} onClick={() => void importSharedTrip()} />
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section title={t('more.app')}>
        <ul className="tn-cards">
          {install.available && (
            <li>
              <Row
                lead={<PhoneIcon />}
                title={t('install.cta')}
                subtitle={install.canPrompt ? t('more.install.detail') : t('install.ios')}
                onClick={install.canPrompt ? () => void install.install() : undefined}
              />
            </li>
          )}
          <li>
            <Row lead={<ShieldIcon />} title={t('privacy.title')} subtitle={t('more.privacy.detail')} href="/privacy" onClick={() => navigate('/privacy')} chevron />
          </li>
          <li>
            <Row lead={<InfoIcon />} title={t('more.about')} href="/about" onClick={() => navigate('/about')} chevron />
          </li>
        </ul>
      </Section>

      <p className="tn-note" style={{ marginTop: 16 }}>
        {t(isNativeApp ? 'settings.storage.native' : 'home.storageNote')}
      </p>
    </PushScreen>
  );
}
