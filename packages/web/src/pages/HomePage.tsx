import { useEffect, useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { sampleTrip, type Home, type Trip } from '@tteonaljido/shared';
import { InstallHint } from '../components/InstallHint';
import { MapIcon } from '../components/shell/icons';
import { Row, Section } from '../components/shell/rows';
import { TabScreen } from '../components/shell/Screens';
import { sendLog, trips, type SendLogEntry } from '../lib/db';
import { dateLabel, dayOf, periodLabel } from '../lib/format';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { newDoc, nightsLabel, nowIso, unassignedVisits, type TripDoc } from '../lib/trips';

/** 여행 tab: the trip list, one primary "create" action and a sample for a first look. Backup and import live in 전체. */
export function HomePage() {
  const [docs, setDocs] = useState<TripDoc[] | null>(null);
  const [lastSends, setLastSends] = useState<Record<string, SendLogEntry>>({});
  const [message, setMessage] = useState<string | null>(null);

  const reload = async () => {
    const [all, log] = await Promise.all([trips.all(), sendLog.recent(1000)]);
    setDocs(all);
    // The most recent send per trip, so a row can show "last sent vN · date" (the log is newest first).
    const latest: Record<string, SendLogEntry> = {};
    for (const e of log) latest[e.tripId] ??= e;
    setLastSends(latest);
  };
  useEffect(() => void reload(), []);

  const addSample = async () => {
    const plan: Trip = { ...sampleTrip(nowIso()), tripId: crypto.randomUUID() };
    // 임시 데모용 '집' = 세종시청(좌표는 근사값). 편집기의 '집' 항목에서 언제든 바꾸거나 지울 수 있어요.
    const home: Home = { address: '세종특별자치시 한누리대로 2130 (세종시청)', latE7: 364801000, lonE7: 1272887000 };
    await trips.put(await newDoc(plan, home));
    setMessage(t('home.sampleAdded'));
    await reload();
  };

  return (
    <TabScreen path="/" title={t('home.title')}>
      <div className="tn-intro">
        <p>{t('home.tagline')}</p>
      </div>
      <div className="tn-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <InstallHint />
        {message && <Banner status="info" title={message} isDismissable onDismiss={() => setMessage(null)} />}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <Button label={t('trips.create')} variant="primary" size="lg" width="100%" onClick={() => navigate('/trips/new')} />
          </div>
          <Button label={t('common.addSample')} variant="secondary" size="lg" onClick={() => void addSample()} />
        </div>
      </div>
      {docs !== null && docs.length === 0 ? (
        <div className="tn-pad" style={{ paddingTop: 32 }}>
          <EmptyState title={t('common.noTrips')} description={t('home.empty.description')} />
        </div>
      ) : (
        <Section title={t('home.myTrips')}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {(docs ?? []).map((d) => {
              const unassigned = unassignedVisits(d.plan).length;
              const sent = lastSends[d.tripId];
              return (
                <li key={d.tripId}>
                  <Row
                    href={`/trips/${d.tripId}`}
                    onClick={() => navigate(`/trips/${d.tripId}`)}
                    lead={<MapIcon />}
                    title={
                      // badges ride on the title line so the summary gets the full width on a 360pt screen
                      <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                        <span>{d.plan.name}</span>
                        <Badge variant="neutral" label={`v${d.revision}`} />
                        {unassigned > 0 && <Badge variant="warning" label={t('home.unassignedBadge', { n: unassigned })} />}
                      </span>
                    }
                    subtitle={
                      t('common.tripSummary', { period: periodLabel(d.plan.startDate, d.plan.endDate), nights: nightsLabel(d.plan), places: d.plan.places.length }) +
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
