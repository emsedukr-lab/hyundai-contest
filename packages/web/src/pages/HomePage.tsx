import { useEffect, useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FileInput } from '@astryxdesign/core/FileInput';
import { Layout, LayoutContent, LayoutFooter, LayoutHeader } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { sampleTrip, type Home, type Trip } from '@tteonaljido/shared';
import { Card, CardListHeader } from '../components/toss/Card';
import { InstallHint } from '../components/InstallHint';
import { sendLog, trips, type SendLogEntry } from '../lib/db';
import { dateLabel, periodLabel } from '../lib/format';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { docFromShare, importShare, isShareFile } from '../lib/share';
import { newDoc, nightsLabel, nowIso, unassignedVisits, type TripDoc } from '../lib/trips';

export function HomePage() {
  const [docs, setDocs] = useState<TripDoc[] | null>(null);
  const [lastSends, setLastSends] = useState<Record<string, SendLogEntry>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  // A friend's encrypted share needs a passcode; hold the file text until it is entered.
  const [shareText, setShareText] = useState<string | null>(null);
  const [sharePass, setSharePass] = useState('');

  const reload = async () => {
    const all = await trips.all();
    setDocs(all);
    // The most recent send per trip, so a card can show "last sent vN · date".
    const latest: Record<string, SendLogEntry> = {};
    for (const d of all) {
      const log = await sendLog.forTrip(d.tripId);
      const newest = log.reduce<SendLogEntry | null>((a, b) => (a && a.at >= b.at ? a : b), null);
      if (newest) latest[d.tripId] = newest;
    }
    setLastSends(latest);
  };
  useEffect(() => void reload(), []);

  const localDate = (at: number) => {
    const d = new Date(at);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const addSample = async () => {
    const plan: Trip = { ...sampleTrip(nowIso()), tripId: crypto.randomUUID() };
    // 임시 데모용 '집' = 세종시청(좌표는 근사값). 편집기의 '집' 항목에서 언제든 바꾸거나 지울 수 있어요.
    const home: Home = { address: '세종특별자치시 한누리대로 2130 (세종시청)', latE7: 364801000, lonE7: 1272887000 };
    await trips.put(await newDoc(plan, home));
    setMessage(t('home.sampleAdded'));
    await reload();
  };

  const exportAll = () => {
    const blob = new Blob([JSON.stringify({ format: 'tteonaljido-backup', version: 1, trips: docs }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = t('home.backupFileName', { date: nowIso().slice(0, 10) });
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    // A friend's share is encrypted: hold it and ask for the passcode instead of importing immediately.
    if (isShareFile(text)) {
      setShareText(text);
      setSharePass('');
      setShowImport(false);
      return;
    }
    try {
      const data = JSON.parse(text) as { format?: string; trips?: TripDoc[] };
      if (data.format !== 'tteonaljido-backup' || !Array.isArray(data.trips)) throw new Error('not a backup');
      // A backup replaces trips with the same id; warn before overwriting any.
      const existing = new Set((docs ?? []).map((d) => d.tripId));
      const overwrites = data.trips.filter((d) => existing.has(d.tripId)).length;
      if (overwrites > 0 && !window.confirm(t('home.import.overwrite', { n: overwrites }))) return;
      for (const d of data.trips) await trips.put(await newDoc({ ...d.plan, revision: d.revision, updatedAt: d.updatedAt }, d.home));
      setMessage(t('home.imported', { n: data.trips.length }));
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
    <Layout
      contentWidth={640}
      header={
        <LayoutHeader hasDivider>
          <VStack gap={0.5}>
            <Heading level={1}>{t('home.title')}</Heading>
            <Text type="supporting" color="secondary">
              {t('home.tagline')}
            </Text>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={4}>
            <InstallHint />
            {message && <Banner status="info" title={message} isDismissable onDismiss={() => setMessage(null)} />}
            {docs !== null && docs.length === 0 ? (
              <VStack gap={3}>
                <EmptyState
                  title={t('common.noTrips')}
                  description={t('home.empty.description')}
                  actions={
                    <HStack gap={2}>
                      <Button label={t('home.newTrip')} variant="primary" onClick={() => navigate('/trips/new')} />
                      <Button label={t('common.addSample')} variant="secondary" onClick={addSample} />
                    </HStack>
                  }
                />
                <Banner status="info" title={t('home.shareHint')} />
              </VStack>
            ) : (
              <VStack gap={2}>
                <Card pad={0}>
                  {/* header (not a loose label) so the list is named for screen readers via aria-labelledby */}
                  <List hasDividers header={<CardListHeader>{t('home.myTrips')}</CardListHeader>}>
                    {(docs ?? []).map((d) => (
                  <ListItem
                    key={d.tripId}
                    label={d.plan.name}
                    description={
                      t('common.tripSummary', { period: periodLabel(d.plan.startDate, d.plan.endDate), nights: nightsLabel(d.plan), places: d.plan.places.length }) +
                      (lastSends[d.tripId] ? ` · ${t('home.lastSend', { version: lastSends[d.tripId].revision, date: dateLabel(localDate(lastSends[d.tripId].at)) })}` : '')
                    }
                    endContent={
                      <HStack gap={1}>
                        {unassignedVisits(d.plan).length > 0 && <Badge variant="warning" label={t('home.unassignedBadge', { n: unassignedVisits(d.plan).length })} />}
                        <Badge variant="neutral" label={`v${d.revision}`} />
                      </HStack>
                    }
                    onClick={() => navigate(`/trips/${d.tripId}`)}
                  />
                    ))}
                  </List>
                </Card>
              </VStack>
            )}
            <Text type="supporting" color="secondary">
              {t('home.storageNote')}
            </Text>
            <HStack gap={2} wrap="wrap">
              <Button label={t('home.exportBackup')} variant="ghost" size="sm" isDisabled={!docs?.length} onClick={exportAll} />
              <Button label={t('home.importBackup')} variant="ghost" size="sm" onClick={() => setShowImport((v) => !v)} />
              <Button label={t('privacy.title')} variant="ghost" size="sm" onClick={() => navigate('/privacy')} />
            </HStack>
            {showImport && (
              <FileInput
                label={t('home.backupFile.label')}
                mode="input"
                accept="application/json"
                value={null}
                onChange={(f) => {
                  const file = Array.isArray(f) ? f[0] : f;
                  if (file) void importFile(file).then(() => setShowImport(false));
                }}
                description={t('home.backupFile.description')}
              />
            )}
            {shareText && (
              <VStack gap={2}>
                <Banner status="info" title={t('share.importTitle')} description={t('share.importHint')} />
                <TextInput label={t('share.passcode')} value={sharePass} inputMode="numeric" onChange={setSharePass} />
                <HStack gap={2}>
                  <Button label={t('share.importAction')} variant="primary" size="sm" isDisabled={sharePass.trim().length < 4} onClick={importSharedTrip} />
                  <Button label={t('common.cancel')} variant="ghost" size="sm" onClick={() => setShareText(null)} />
                </HStack>
              </VStack>
            )}
          </VStack>
        </LayoutContent>
      }
      footer={
        docs?.length ? (
          <LayoutFooter hasDivider>
            <HStack gap={2}>
              <StackItem size="fill">
                <Button label={t('home.newTrip')} variant="primary" width="100%" onClick={() => navigate('/trips/new')} />
              </StackItem>
              <Button label={t('common.addSample')} variant="secondary" onClick={addSample} />
            </HStack>
          </LayoutFooter>
        ) : undefined
      }
    />
  );
}
