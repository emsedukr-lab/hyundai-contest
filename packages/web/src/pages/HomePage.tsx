import { useEffect, useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FileInput } from '@astryxdesign/core/FileInput';
import { Layout, LayoutContent, LayoutFooter, LayoutHeader } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { sampleTrip, type Trip } from '@tteonaljido/shared';
import { trips } from '../lib/db';
import { periodLabel } from '../lib/format';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { newDoc, nightsLabel, nowIso, unassignedVisits, type TripDoc } from '../lib/trips';

export function HomePage() {
  const [docs, setDocs] = useState<TripDoc[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const reload = () => trips.all().then(setDocs);
  useEffect(() => void reload(), []);

  const addSample = async () => {
    const plan: Trip = { ...sampleTrip(nowIso()), tripId: crypto.randomUUID() };
    await trips.put(await newDoc(plan));
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
    try {
      const data = JSON.parse(await file.text()) as { format?: string; trips?: TripDoc[] };
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
            {message && <Banner status="info" title={message} isDismissable onDismiss={() => setMessage(null)} />}
            {docs !== null && docs.length === 0 ? (
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
            ) : (
              <List hasDividers header={<Text type="label">{t('home.myTrips')}</Text>}>
                {(docs ?? []).map((d) => (
                  <ListItem
                    key={d.tripId}
                    label={d.plan.name}
                    description={t('common.tripSummary', { period: periodLabel(d.plan.startDate, d.plan.endDate), nights: nightsLabel(d.plan), places: d.plan.places.length })}
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
          </VStack>
        </LayoutContent>
      }
      footer={
        docs?.length ? (
          <LayoutFooter hasDivider>
            <HStack gap={2}>
              <Button label={t('home.newTrip')} variant="primary" onClick={() => navigate('/trips/new')} />
              <Button label={t('common.addSample')} variant="secondary" onClick={addSample} />
            </HStack>
          </LayoutFooter>
        ) : undefined
      }
    />
  );
}
