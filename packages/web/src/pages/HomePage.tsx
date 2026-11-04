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
    setMessage('강릉 3박 4일 샘플을 추가했어요. 좌표는 시연용 근사값이에요.');
    await reload();
  };

  const exportAll = () => {
    const blob = new Blob([JSON.stringify({ format: 'tteonaljido-backup', version: 1, trips: docs }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `떠날지도-백업-${nowIso().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as { format?: string; trips?: TripDoc[] };
      if (data.format !== 'tteonaljido-backup' || !Array.isArray(data.trips)) throw new Error();
      for (const d of data.trips) await trips.put(await newDoc({ ...d.plan, revision: d.revision, updatedAt: d.updatedAt }, d.home));
      setMessage(`여행 ${data.trips.length}개를 가져왔어요`);
      await reload();
    } catch {
      setMessage('떠날지도 백업 파일이 아니에요');
    }
  };

  return (
    <Layout
      contentWidth={640}
      header={
        <LayoutHeader hasDivider>
          <VStack gap={0.5}>
            <Heading level={1}>떠날지도</Heading>
            <Text type="supporting" color="secondary">
              여행을 휴대폰에서 짜고, 차에서 QR로 불러와요
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
                title="저장된 여행이 없어요"
                description="새 여행을 만들거나 샘플 여행으로 먼저 둘러보세요."
                actions={
                  <HStack gap={2}>
                    <Button label="새 여행" variant="primary" onClick={() => navigate('/trips/new')} />
                    <Button label="샘플 여행 추가" variant="secondary" onClick={addSample} />
                  </HStack>
                }
              />
            ) : (
              <List hasDividers header={<Text type="label">내 여행</Text>}>
                {(docs ?? []).map((d) => (
                  <ListItem
                    key={d.tripId}
                    label={d.plan.name}
                    description={`${periodLabel(d.plan.startDate, d.plan.endDate)} · ${nightsLabel(d.plan)} · 장소 ${d.plan.places.length}곳`}
                    endContent={
                      <HStack gap={1}>
                        {unassignedVisits(d.plan).length > 0 && <Badge variant="warning" label={`미배정 ${unassignedVisits(d.plan).length}`} />}
                        <Badge variant="neutral" label={`v${d.revision}`} />
                      </HStack>
                    }
                    onClick={() => navigate(`/trips/${d.tripId}`)}
                  />
                ))}
              </List>
            )}
            <Text type="supporting" color="secondary">
              여행은 이 휴대폰 브라우저에만 저장돼요. 계정이 없고 서버에 보관하지 않아요. 차로 보낼 때만, 고른 여행 하나가 암호화되어 잠시 전달돼요.
            </Text>
            <HStack gap={2} wrap="wrap">
              <Button label="백업 내보내기" variant="ghost" size="sm" isDisabled={!docs?.length} onClick={exportAll} />
              <Button label="백업 가져오기" variant="ghost" size="sm" onClick={() => setShowImport((v) => !v)} />
              <Button label="개인정보 안내" variant="ghost" size="sm" onClick={() => navigate('/privacy')} />
            </HStack>
            {showImport && (
              <FileInput
                label="백업 파일"
                mode="input"
                accept="application/json"
                value={null}
                onChange={(f) => {
                  const file = Array.isArray(f) ? f[0] : f;
                  if (file) void importFile(file).then(() => setShowImport(false));
                }}
                description="떠날지도에서 내보낸 JSON 파일"
              />
            )}
          </VStack>
        </LayoutContent>
      }
      footer={
        docs?.length ? (
          <LayoutFooter hasDivider>
            <HStack gap={2}>
              <Button label="새 여행" variant="primary" onClick={() => navigate('/trips/new')} />
              <Button label="샘플 여행 추가" variant="secondary" onClick={addSample} />
            </HStack>
          </LayoutFooter>
        ) : undefined
      }
    />
  );
}
