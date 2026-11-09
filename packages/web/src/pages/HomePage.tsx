import { useEffect, useRef, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { sampleTrip, type Trip } from '@tteonaljido/shared';
import { InstallHint } from '../components/InstallHint';
import { NextTrip } from '../components/NextTrip';
import { pickNextTrip } from '../lib/nextTrip';
import { PlusIcon } from '../components/shell/icons';
import { Row, Section } from '../components/shell/rows';
import { Tag } from '../components/shell/Tag';
import { TabScreen } from '../components/shell/Screens';
import { TRIPS_CHANGED, sendLog, trips, type SendLogEntry } from '../lib/db';
import { dateLabel, dayOf, periodLabel } from '../lib/format';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { defaultHome } from '../lib/settings';
import { newDoc, nightsLabel, nowIso, unassignedVisits, type TripDoc } from '../lib/trips';

/**
 * 여행 tab (M45): the next trip as a card with its whole route, the other trips in one list, and 새 여행 in the top bar.
 * The sample trip has no menu; `/?sample=1` still adds it for demos and tests (the address is cleaned right after).
 */
export function HomePage() {
  const [docs, setDocs] = useState<TripDoc[] | null>(null);
  const [lastSends, setLastSends] = useState<Record<string, SendLogEntry>>({});
  const [message, setMessage] = useState<string | null>(null);
  const sampleAsked = useRef(false);

  const reload = async () => {
    const [all, log] = await Promise.all([trips.all(), sendLog.recent(1000)]);
    setDocs(all);
    // The most recent send per trip, so a row can show "last sent vN · date" (the log is newest first).
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
    void reload();
    // The editor saves on its way out (browser back included); reload when that write lands after this list.
    const onChanged = () => void reload();
    window.addEventListener(TRIPS_CHANGED, onChanged);
    return () => window.removeEventListener(TRIPS_CHANGED, onChanged);
  }, []);

  const addSample = async () => {
    const plan: Trip = { ...sampleTrip(nowIso()), tripId: crypto.randomUUID() };
    await trips.put(await newDoc(plan, defaultHome())); // home is the one set in 설정 (none → the car uses its navigation HOME)
    setMessage(t('home.sampleAdded'));
    await reload();
  };

  const next = docs ? pickNextTrip(docs) : null;
  const others = (docs ?? []).filter((d) => d !== next);
  const newTrip = (
    <button type="button" className="tn-headbtn" onClick={() => navigate('/trips/new')} aria-label={t('trips.create')}>
      <PlusIcon />
      {t('home.newTrip')}
    </button>
  );

  return (
    <TabScreen path="/" title={t('home.title')} actions={newTrip}>
      <div className="tn-intro">
        <p>{t('home.tagline')}</p>
      </div>
      <div className="tn-pad tn-home-notes">
        <InstallHint />
        {message && <Banner status="info" title={message} isDismissable onDismiss={() => setMessage(null)} />}
      </div>
      {docs !== null && docs.length === 0 && (
        <div className="tn-panel" style={{ marginTop: 16 }}>
          <EmptyState title={t('common.noTrips')} description={t('home.empty.head')} />
        </div>
      )}
      {next && (
        <Section title={t('home.next.title')}>
          <NextTrip doc={next} sent={lastSends[next.tripId]} />
        </Section>
      )}
      {others.length > 0 && (
        <Section title={t('home.others')}>
          <ul className="tn-cards">
            {others.map((d) => {
              const unassigned = unassignedVisits(d.plan).length;
              const sent = lastSends[d.tripId];
              return (
                <li key={d.tripId}>
                  <Row
                    href={`/trips/${d.tripId}`}
                    onClick={() => navigate(`/trips/${d.tripId}`)}
                    title={
                      // tags ride on the title line so the summary gets the full width on a 360pt screen
                      <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <span>{d.plan.name}</span>
                        {d.setup && !d.setup.done ? (
                          // still in its step-by-step setup (M43)
                          <Tag tone="accent">{t('setup.homeBadge', { step: d.setup.step })}</Tag>
                        ) : (
                          <>
                            <span className="tn-rev">{`v${d.revision}`}</span>
                            {unassigned > 0 && <Tag tone="warn">{t('home.unassignedBadge', { n: unassigned })}</Tag>}
                          </>
                        )}
                      </span>
                    }
                    // '3박 4일' keeps its space unbroken so the nights never split across lines
                    subtitle={
                      t('common.tripSummary', { period: periodLabel(d.plan.startDate, d.plan.endDate), nights: nightsLabel(d.plan).replace(/ /g, '\u00a0'), places: d.plan.places.length }) +
                      (sent ? ` · ${t('home.lastSend', { version: sent.revision, date: dateLabel(dayOf(sent.at)) })}` : '')
                    }
                    chevron
                  />
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </TabScreen>
  );
}
