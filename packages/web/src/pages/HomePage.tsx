import { useEffect, useRef, useState } from 'react';
import { ToastNotice } from '../components/ToastNotice';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { sampleTrip, type Trip } from '@tteonaljido/shared';
import { InstallHint } from '../components/InstallHint';
import { NextTrip } from '../components/NextTrip';
import { SwipeToRemove } from '../components/SwipeToRemove';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { dateOverlaps, pickNextTrip, sortOtherTrips } from '../lib/nextTrip';
import { GearIcon, QrIcon } from '../components/shell/icons';
import { Row, Section } from '../components/shell/rows';
import { Tag } from '../components/shell/Tag';
import { RootScreen } from '../components/shell/Screens';
import { TRIPS_CHANGED, sendLog, trash, trips, type SendLogEntry } from '../lib/db';
import { periodLabel } from '../lib/format';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { defaultHome } from '../lib/settings';
import { ensureExampleTrip, EXAMPLE_TRIP_ID } from '../lib/exampleTrip';
import { newDoc, nightsLabel, setupStepNumber, nowIso, unassignedVisits, type TripDoc } from '../lib/trips';

/**
 * 여행 (the main screen, no tab bar): the next trip as a card with its whole route and the other trips in one list. 연결 (a QR icon,
 * the car's QR is scanned there) and 설정 (a gear) sit in the top bar; the bottom action creates a trip.
 * The sample trip has no menu; `/?sample=1` still adds it for demos and tests (the address is cleaned right after).
 */
export function HomePage() {
  const [docs, setDocs] = useState<TripDoc[] | null>(null);
  const [lastSends, setLastSends] = useState<Record<string, SendLogEntry>>({});
  const [message, setMessage] = useState<string | null>(null);
  const sampleAsked = useRef(false);
  // a trip swiped away is deleted at once and kept here for 되돌리기 (the whole saved doc goes back as it was).
  const [removed, setRemoved] = useState<TripDoc | null>(null);
  useEffect(() => {
    if (!removed) return;
    const id = window.setTimeout(() => setRemoved(null), 8000);
    return () => window.clearTimeout(id);
  }, [removed]);

  const reload = async () => {
    const [all, log] = await Promise.all([trips.all(), sendLog.recent(1000)]);
    setDocs(all);
    // The most recent send for the next-trip card (the log is newest first).
    const latest: Record<string, SendLogEntry> = {};
    for (const e of log) latest[e.tripId] ??= e;
    setLastSends(latest);
  };
  useEffect(() => {
    // Demo/test entry: '/?sample=1' adds the sample once and drops the parameter.
    if (!sampleAsked.current && new URLSearchParams(location.search).get('sample') === '1') {
      sampleAsked.current = true;
      history.replaceState(null, '', '/');
      void addSample();
    }
    void (async () => {
      try { await ensureExampleTrip(); }
      catch { setMessage(t('home.storage.failed')); }
      await reload().catch(() => { setDocs([]); setMessage(t('home.storage.failed')); });
    })();
    // The editor saves on its way out (browser back included); reload when that write lands after this list.
    const onChanged = () => void reload();
    window.addEventListener(TRIPS_CHANGED, onChanged);
    return () => window.removeEventListener(TRIPS_CHANGED, onChanged);
  }, []);

  const removeTrip = async (d: TripDoc) => {
    try {
      if (await trash.move(d.tripId)) setRemoved(d);
      await reload();
    } catch { setMessage(t('trash.failed')); }
  };
  const undoRemove = async () => {
    if (!removed) return;
    try {
      if (!(await trash.restore(removed.tripId))) setMessage(t('trash.restoreFailed'));
      setRemoved(null);
      await reload();
    } catch { setMessage(t('trash.failed')); }
  };
  const swipeProps = (d: TripDoc) => ({ actionText: t('editor.delete.action'), actionLabel: t('home.deleteAria', { name: d.plan.name }), onRemove: () => void removeTrip(d) });

  const addSample = async () => {
    const plan: Trip = { ...sampleTrip(nowIso()), tripId: crypto.randomUUID() };
    await trips.put(await newDoc(plan, defaultHome())); // home is the one set in 설정 (none → the car uses its navigation HOME)
    setMessage(t('home.sampleAdded'));
    await reload();
  };

  const personal = (docs ?? []).filter((d) => d.tripId !== EXAMPLE_TRIP_ID);
  const next = docs ? pickNextTrip(personal.length ? personal : docs) : null;
  // a clear order below the next-trip card (by departure, past trips last) and a mark on trips whose dates overlap.
  const others = sortOtherTrips((docs ?? []).filter((d) => d !== next));
  const overlaps = dateOverlaps(personal);

  return (
    <RootScreen
      title={t('home.title')}
      cta={<Button label={t('home.add.trip')} variant="primary" size="lg" width="100%" onClick={() => navigate('/trips/new')} />}
      actions={
        <>
          <button type="button" className="tn-iconbtn" aria-label={t('home.connectAria')} onClick={() => navigate('/car')}>
            <QrIcon />
          </button>
          <button type="button" className="tn-iconbtn" aria-label={t('nav.settings')} onClick={() => navigate('/settings')}>
            <GearIcon />
          </button>
        </>
      }>
      <div className="tn-pad tn-home-notes">
        <InstallHint />
        {message && <ToastNotice status="info" title={message} isDismissable onDismiss={() => setMessage(null)} />}
      </div>
      {docs !== null && docs.length === 0 && (
        <div className="tn-panel" style={{ marginTop: 16 }}>
          {/* First visit: the way forward is right here — make a trip, or look at the sample first. */}
          <EmptyState title={t('common.noTrips')} description={t('home.empty.description')} />
          <Button label={t('home.empty.sample')} variant="ghost" size="md" width="100%" onClick={() => void addSample()} />
        </div>
      )}
      {next && (
        <Section title={t('home.next.title')}>
          <SwipeToRemove key={next.tripId} className="tn-next-swipe" cardClassName="" {...swipeProps(next)}>
            <NextTrip doc={next} sent={lastSends[next.tripId]} overlaps={overlaps.get(next.tripId)?.length ?? 0} />
          </SwipeToRemove>
        </Section>
      )}
      {others.length > 0 && (
        <Section title={t('home.others')}>
          <ul className="tn-cards">
            {others.map((d) => {
              const unassigned = unassignedVisits(d.plan).length;
              return (
                <li key={d.tripId}>
                  <SwipeToRemove className="tn-row-swipe" cardClassName="tn-row-swipe-card" {...swipeProps(d)}>
                  <Row
                    href={`/trips/${d.tripId}`}
                    onClick={() => navigate(`/trips/${d.tripId}`)}
                    title={
                      // tags ride on the title line so the summary gets the full width on a 360pt screen
                      <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <span>{d.plan.name}</span>
                        {d.tripId === EXAMPLE_TRIP_ID && <Tag>{t('home.example')}</Tag>}
                        {d.setup && !d.setup.done ? (
                          // still in its step-by-step setup
                          <Tag tone="accent">{t('setup.homeBadge', { step: setupStepNumber(d.setup.step) })}</Tag>
                        ) : (
                          unassigned > 0 && <Tag tone="warn">{t('home.unassignedBadge', { n: unassigned })}</Tag>
                        )}
                        {overlaps.has(d.tripId) && <Tag tone="warn">{t('home.overlap', { n: overlaps.get(d.tripId)!.length })}</Tag>}
                      </span>
                    }
                    // '3박 4일' keeps its space unbroken so the nights never split across lines
                    subtitle={
                      t('common.tripSummary', { period: periodLabel(d.plan.startDate, d.plan.endDate), nights: nightsLabel(d.plan).replace(/ /g, '\u00a0'), places: d.plan.places.length })
                    }
                    chevron
                  />
                  </SwipeToRemove>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {/* 되돌리기 for a trip swiped away, above the bottom action. */}
      <div role="status">
        {removed && <UndoSnackbar above="tab" text={t('home.deleted', { name: removed.plan.name })} onUndo={() => void undoRemove()} onClose={() => setRemoved(null)} />}
      </div>
    </RootScreen>
  );
}
