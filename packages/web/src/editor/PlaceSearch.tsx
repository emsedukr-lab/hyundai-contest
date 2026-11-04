import { useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { List, ListItem } from '@astryxdesign/core/List';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { TextInput } from '@astryxdesign/core/TextInput';
import type { Place } from '@tteonaljido/shared';
import { ApiError, searchPlaces, type PlaceHit } from '../lib/pairing';

export const CATEGORY_OPTIONS = [
  { value: 'SIGHT', label: '관광·산책' },
  { value: 'FOOD', label: '식사' },
  { value: 'CAFE', label: '카페·디저트' },
  { value: 'LODGING', label: '숙소' },
  { value: 'OTHER', label: '기타' },
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label])) as Record<Place['category'], string>;

export type NewPlace = Omit<Place, 'placeRef'>;

const fromHit = (h: PlaceHit): NewPlace => ({
  name: h.name,
  address: h.address,
  latE7: h.latE7,
  lonE7: h.lonE7,
  category: h.category,
  source: { provider: 'KAKAO', externalId: h.externalId },
  naviPoi: null,
  hours: { status: 'UNKNOWN' },
});

/** Kakao search through our relay, with a manual fallback when search is not available. */
export function PlaceSearch({ onPick, label = '장소 검색', lodgingOnly = false }: { onPick: (p: NewPlace) => void; label?: string; lodgingOnly?: boolean }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      setHits(await searchPlaces(q.trim()));
    } catch (e) {
      setHits(null);
      setNote(e instanceof ApiError && e.status === 503 ? '지금은 장소 검색을 쓸 수 없어요. 직접 입력해 주세요.' : '검색하지 못했어요. 인터넷 연결을 확인하거나 직접 입력해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <VStack gap={2}>
      <HStack gap={2} vAlign="end">
        <StackItem size="fill">
          <TextInput label={label} value={q} onChange={setQ} onEnter={run} placeholder="예: 경포호, 테라로사" hasClear />
        </StackItem>
        <Button label="검색" variant="secondary" isLoading={busy} onClick={run} />
      </HStack>
      {note && <Banner status="info" title={note} />}
      {hits && hits.length === 0 && <Banner status="info" title="검색 결과가 없어요" />}
      {hits && hits.length > 0 && (
        <List hasDividers>
          {hits.map((h) => (
            <ListItem
              key={h.externalId}
              label={h.name}
              description={`${CATEGORY_LABEL[h.category]} · ${h.address}`}
              onClick={() => {
                onPick({ ...fromHit(h), category: lodgingOnly ? 'LODGING' : h.category });
                setHits(null);
                setQ('');
              }}
            />
          ))}
        </List>
      )}
      <HStack gap={2}>
        <Button label="직접 입력" variant="ghost" size="sm" onClick={() => setManual(true)} />
      </HStack>
      <ManualPlaceDialog isOpen={manual} lodgingOnly={lodgingOnly} onClose={() => setManual(false)} onSave={(p) => (onPick(p), setManual(false))} />
    </VStack>
  );
}

function ManualPlaceDialog({ isOpen, onClose, onSave, lodgingOnly }: { isOpen: boolean; onClose: () => void; onSave: (p: NewPlace) => void; lodgingOnly: boolean }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [category, setCategory] = useState<Place['category']>(lodgingOnly ? 'LODGING' : 'SIGHT');
  const valid = name.trim().length > 0 && lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => !o && onClose()} width={480}>
      <DialogHeader title="장소 직접 입력" onOpenChange={(o) => !o && onClose()} />
      <VStack gap={4}>
        <FormLayout>
          <TextInput label="이름" value={name} onChange={setName} isRequired />
          <TextInput label="주소" value={address} onChange={setAddress} isOptional />
          <HStack gap={2}>
            <NumberInput label="위도" value={lat} onChange={setLat} step={0.0001} placeholder="37.7955" isRequired />
            <NumberInput label="경도" value={lon} onChange={setLon} step={0.0001} placeholder="128.8975" isRequired />
          </HStack>
          {!lodgingOnly && <Selector label="종류" options={CATEGORY_OPTIONS} value={category} onChange={(v) => setCategory(v as Place['category'])} />}
        </FormLayout>
        <HStack gap={2} hAlign="end">
          <Button label="취소" variant="secondary" onClick={onClose} />
          <Button
            label="추가"
            variant="primary"
            isDisabled={!valid}
            onClick={() =>
              onSave({
                name: name.trim().slice(0, 60),
                address: address.trim().slice(0, 120),
                latE7: Math.round(lat! * 1e7),
                lonE7: Math.round(lon! * 1e7),
                category,
                source: { provider: 'MANUAL', externalId: null },
                naviPoi: null,
                hours: { status: 'UNKNOWN' },
              })
            }
          />
        </HStack>
      </VStack>
    </Dialog>
  );
}
