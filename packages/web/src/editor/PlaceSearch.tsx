import { useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { List, ListItem } from '@astryxdesign/core/List';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import type { Place } from '@tteonaljido/shared';
import { t } from '../lib/i18n';
import { ApiError, searchPlaces, type PlaceHit } from '../lib/pairing';

export const CATEGORY_OPTIONS = [
  { value: 'SIGHT', label: t('place.category.sight') },
  { value: 'FOOD', label: t('place.category.food') },
  { value: 'CAFE', label: t('place.category.cafe') },
  { value: 'LODGING', label: t('common.lodging') },
  { value: 'OTHER', label: t('place.category.other') },
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
export function PlaceSearch({ onPick, label = t('place.search'), lodgingOnly = false }: { onPick: (p: NewPlace) => void; label?: string; lodgingOnly?: boolean }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [manual, setManual] = useState(false);

  /** Adds a place by name only; the car finds its exact location in the Hyundai navigation. */
  const addByName = () => {
    const name = q.trim().slice(0, 60);
    if (!name) return;
    onPick({ name, address: '', latE7: null, lonE7: null, category: lodgingOnly ? 'LODGING' : 'OTHER', source: { provider: 'MANUAL', externalId: null }, naviPoi: null, hours: { status: 'UNKNOWN' } });
    setQ('');
    setNote(null);
  };

  const run = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      setHits(await searchPlaces(q.trim()));
    } catch (e) {
      setHits(null);
      const off = e instanceof ApiError && e.status === 503;
      setUnavailable(off);
      setNote(off ? t('place.search.unavailable') : t('place.search.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <VStack gap={2}>
      <HStack gap={2} vAlign="end">
        <StackItem size="fill">
          <TextInput label={label} value={q} onChange={setQ} onEnter={run} placeholder={t('place.search.placeholder')} hasClear />
        </StackItem>
        <Button label={t('place.search.action')} variant="secondary" isLoading={busy} onClick={run} />
      </HStack>
      {note && <Banner status="info" title={note} />}
      {note && q.trim() && <Button label={t('place.search.addByName', { query: q.trim().slice(0, 20) })} variant="primary" size="sm" onClick={addByName} />}
      {hits && hits.length === 0 && <Banner status="info" title={t('place.search.noResults')} />}
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
        <Button label={unavailable ? t('place.manual.full') : t('place.manual.open')} variant="ghost" size="sm" onClick={() => setManual(true)} />
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
  // Coordinates are optional; when given, both are needed and must be in range.
  const hasCoords = lat !== null && lon !== null;
  const valid = name.trim().length > 0 && (lat === null) === (lon === null) && (!hasCoords || (Math.abs(lat!) <= 90 && Math.abs(lon!) <= 180));

  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => !o && onClose()} width={480}>
      <DialogHeader title={t('place.manual.title')} onOpenChange={(o) => !o && onClose()} />
      <VStack gap={4}>
        <FormLayout>
          <TextInput label={t('place.manual.name')} value={name} onChange={setName} isRequired />
          <TextInput label={t('place.manual.address')} value={address} onChange={setAddress} isOptional />
          <HStack gap={2}>
            <NumberInput label={t('place.manual.lat')} value={lat} onChange={(v: number | null) => setLat(v)} step={0.0001} placeholder="37.7955" isOptional hasClear />
            <NumberInput label={t('place.manual.lon')} value={lon} onChange={(v: number | null) => setLon(v)} step={0.0001} placeholder="128.8975" isOptional hasClear />
          </HStack>
          <Text type="supporting" color="secondary">
            {t('place.manual.coordsHint')}
          </Text>
          {!lodgingOnly && <Selector label={t('common.type')} options={CATEGORY_OPTIONS} value={category} onChange={(v) => setCategory(v as Place['category'])} />}
        </FormLayout>
        <HStack gap={2} hAlign="end">
          <Button label={t('common.cancel')} variant="secondary" onClick={onClose} />
          <Button
            label={t('place.manual.add')}
            variant="primary"
            isDisabled={!valid}
            onClick={() =>
              onSave({
                name: name.trim().slice(0, 60),
                address: address.trim().slice(0, 120),
                latE7: hasCoords ? Math.round(lat! * 1e7) : null,
                lonE7: hasCoords ? Math.round(lon! * 1e7) : null,
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
