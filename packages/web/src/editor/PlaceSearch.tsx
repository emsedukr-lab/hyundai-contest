import { useEffect, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { IconButton } from '@astryxdesign/core/IconButton';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { List, ListItem } from '@astryxdesign/core/List';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Token } from '@astryxdesign/core/Token';
import type { Place } from '@tteonaljido/shared';
import { Card } from '../components/toss/Card';
import { favorites } from '../lib/db';
import { asNewPlace, favoriteId, toFavorite } from '../lib/favorites';
import type { FavoritePlace } from '../lib/favorites';
import { t } from '../lib/i18n';
import { ApiError, resolvePlace, searchPlaces, type PlaceHit } from '../lib/pairing';
import { parsePastedPlace, parsePastedPlaces } from '../lib/placeShare';
import { BulkAddDialog } from './BulkAddDialog';

export const CATEGORY_OPTIONS = [
  { value: 'SIGHT', label: t('place.category.sight') },
  { value: 'FOOD', label: t('place.category.food') },
  { value: 'CAFE', label: t('place.category.cafe') },
  { value: 'LODGING', label: t('common.lodging') },
  { value: 'OTHER', label: t('place.category.other') },
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label])) as Record<Place['category'], string>;

export type NewPlace = Omit<Place, 'placeRef'>;

export const fromHit = (h: PlaceHit): NewPlace => ({
  name: h.name,
  address: h.address,
  latE7: h.latE7,
  lonE7: h.lonE7,
  category: h.category,
  source: { provider: 'KAKAO', externalId: h.externalId },
  naviPoi: null,
  hours: { status: 'UNKNOWN' },
});

/** A place added by name only; the car finds its exact location in the Hyundai navigation. */
export const byName = (name: string): NewPlace => ({
  name: name.slice(0, 60),
  address: '',
  latE7: null,
  lonE7: null,
  category: 'OTHER',
  source: { provider: 'MANUAL', externalId: null },
  naviPoi: null,
  hours: { status: 'UNKNOWN' },
});

/**
 * Kakao search through our relay, with a manual fallback when search is not available. `requireCoords` is for pickers
 * that need a real location (the home address): it hides the name-only paths — manual entry, "add by name", and
 * favorites without coordinates — which could never satisfy them.
 */
export function PlaceSearch({
  onPick,
  onPickMany,
  label = t('place.search'),
  lodgingOnly = false,
  requireCoords = false,
}: {
  onPick: (p: NewPlace) => void;
  onPickMany?: (places: NewPlace[]) => void;
  label?: string;
  lodgingOnly?: boolean;
  requireCoords?: boolean;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [manual, setManual] = useState(false);
  const [favs, setFavs] = useState<FavoritePlace[]>([]);
  const [manageFavs, setManageFavs] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [paste, setPaste] = useState('');
  const [bulkTerms, setBulkTerms] = useState<string[] | null>(null);

  useEffect(() => {
    void favorites.all().then(setFavs);
  }, []);
  const reloadFavs = async () => setFavs(await favorites.all());
  const isFav = (p: NewPlace) => favs.some((f) => f.id === favoriteId(p));
  const toggleFav = async (p: NewPlace) => {
    if (isFav(p)) await favorites.remove(favoriteId(p));
    else await favorites.put(toFavorite(p));
    await reloadFavs();
  };
  /** Add respecting the lodging-only context (e.g. when picking a night's lodging). */
  const pick = (p: NewPlace) => onPick(lodgingOnly ? { ...p, category: 'LODGING' } : p);

  /** Adds a place by name only; the car finds its exact location in the Hyundai navigation. */
  const addByName = () => {
    const name = q.trim();
    if (!name) return;
    const p = byName(name);
    onPick(lodgingOnly ? { ...p, category: 'LODGING' } : p);
    setQ('');
    setNote(null);
    setHits(null);
    setSearchError(false);
  };

  const run = async (query?: string) => {
    const term = (query ?? q).trim();
    if (!term) return;
    setBusy(true);
    setNote(null);
    setSearchError(false);
    try {
      setHits(await searchPlaces(term));
      setUnavailable(false);
    } catch (e) {
      setHits(null);
      const off = e instanceof ApiError && e.status === 503;
      setUnavailable(off);
      setSearchError(true);
      setNote(off ? t('place.search.unavailable') : t('place.search.failed'));
    } finally {
      setBusy(false);
    }
  };

  /** Best-effort: pull the copied map text straight from the clipboard (falls back to manual paste if blocked). */
  const readClipboard = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt.trim()) setPaste(txt);
      else setNote(t('place.paste.clipboardEmpty'));
    } catch {
      setNote(t('place.paste.clipboardFail'));
    }
  };

  /**
   * Turn pasted map text into a search. Several lines (and onPickMany available) → open the bulk review dialog to pick
   * an address per name and add them all at once. A single line → the normal single search.
   */
  const runPaste = async () => {
    const terms = parsePastedPlaces(paste);
    if (terms.length === 0) {
      // No name in the text, but a share link? Ask the server to read the place name from it, then search.
      const u = parsePastedPlace(paste).url;
      if (u) {
        setNote(null);
        setBusy(true);
        try {
          const name = (await resolvePlace(u)).name;
          setShowPaste(false);
          setPaste('');
          setQ(name);
          await run(name);
        } catch {
          setNote(t('place.resolve.failed'));
        } finally {
          setBusy(false);
        }
        return;
      }
      setNote(t('place.paste.noName'));
      return;
    }
    if (onPickMany && terms.length > 1) {
      setBulkTerms(terms);
      setShowPaste(false);
      setPaste('');
      return;
    }
    const term = terms[0];
    setQ(term);
    setShowPaste(false);
    setPaste('');
    await run(term);
  };

  // A picker that needs coordinates can't use a name-only favorite.
  const shownFavs = requireCoords ? favs.filter((f) => f.latE7 !== null && f.lonE7 !== null) : favs;
  // Offer "add by name" when search failed or found nothing — never where a real location is required.
  const canAddByName = !requireCoords && !!q.trim() && (searchError || hits?.length === 0);

  return (
    <VStack gap={2}>
      {shownFavs.length > 0 && (
        <VStack gap={1}>
          <HStack gap={2} vAlign="center">
            <StackItem size="fill">
              <Text type="label">{t('favorites.title')}</Text>
            </StackItem>
            <Button label={manageFavs ? t('favorites.done') : t('favorites.manage')} variant="ghost" size="sm" onClick={() => setManageFavs((m) => !m)} />
          </HStack>
          <HStack gap={2} wrap="wrap">
            {shownFavs.map((f) =>
              manageFavs ? (
                // Token's remove button carries a localized "remove {name}" label for screen readers.
                <Token key={f.id} label={f.name} onRemove={() => void (async () => { await favorites.remove(f.id); await reloadFavs(); })()} />
              ) : (
                <Button key={f.id} label={f.name} variant="secondary" size="sm" onClick={() => pick(asNewPlace(f))} />
              ),
            )}
          </HStack>
        </VStack>
      )}
      <HStack gap={2} vAlign="end">
        <StackItem size="fill">
          <TextInput label={label} value={q} onChange={setQ} onEnter={() => run()} placeholder={t('place.search.placeholder')} hasClear />
        </StackItem>
        <Button label={t('place.search.action')} variant="secondary" isLoading={busy} onClick={() => run()} />
      </HStack>
      {note && <Banner status="info" title={note} />}
      {hits && hits.length === 0 && <Banner status="info" title={t('place.search.noResults')} />}
      {canAddByName && <Button label={t('place.search.addByName', { query: q.trim().slice(0, 20) })} variant="primary" size="sm" onClick={addByName} />}
      {hits && hits.length > 0 && (
        <Card pad={0}>
        <List hasDividers>
          {hits.map((h) => (
            <ListItem
              key={h.externalId}
              label={h.name}
              description={`${CATEGORY_LABEL[h.category]} · ${h.address}`}
              endContent={
                <IconButton
                  label={isFav(fromHit(h)) ? t('favorites.remove') : t('favorites.add')}
                  icon={<span>{isFav(fromHit(h)) ? '★' : '☆'}</span>}
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleFav(fromHit(h));
                  }}
                />
              }
              onClick={() => {
                onPick({ ...fromHit(h), category: lodgingOnly ? 'LODGING' : h.category });
                setHits(null);
                setQ('');
              }}
            />
          ))}
        </List>
        </Card>
      )}
      <HStack gap={2} wrap="wrap">
        {!requireCoords && <Button label={unavailable ? t('place.manual.searchOff') : t('place.manual.open')} variant="ghost" size="sm" onClick={() => setManual(true)} />}
        <Button label={t('place.paste.open')} variant="ghost" size="sm" onClick={() => setShowPaste((v) => !v)} />
      </HStack>
      {showPaste && (
        <VStack gap={2}>
          <TextArea label={t('place.paste.label')} value={paste} onChange={setPaste} placeholder={t('place.paste.placeholder')} rows={3} isOptional />
          {onPickMany && (
            <Text type="supporting" color="secondary">
              {t('place.bulk.hint')}
            </Text>
          )}
          <HStack gap={2}>
            <Button label={t('place.paste.fromClipboard')} variant="ghost" size="sm" onClick={() => void readClipboard()} />
            <Button label={t('place.paste.find')} variant="primary" size="sm" isDisabled={!paste.trim()} onClick={() => void runPaste()} />
          </HStack>
        </VStack>
      )}
      <ManualPlaceDialog isOpen={manual} lodgingOnly={lodgingOnly} onClose={() => setManual(false)} onSave={(p) => (onPick(p), setManual(false))} />
      {onPickMany && bulkTerms && (
        <BulkAddDialog isOpen terms={bulkTerms} lodgingOnly={lodgingOnly} onClose={() => setBulkTerms(null)} onAdd={(places) => onPickMany(places)} />
      )}
    </VStack>
  );
}

function ManualPlaceDialog({ isOpen, onClose, onSave, lodgingOnly }: { isOpen: boolean; onClose: () => void; onSave: (p: NewPlace) => void; lodgingOnly: boolean }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<Place['category']>(lodgingOnly ? 'LODGING' : 'SIGHT');
  const valid = name.trim().length > 0;

  // The dialog stays mounted between uses; start each opening blank so the last place isn't offered again.
  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setAddress('');
    setCategory(lodgingOnly ? 'LODGING' : 'SIGHT');
  }, [isOpen, lodgingOnly]);

  // Coordinates are no longer entered by hand — the car finds the exact spot from the name/address in its navigation.
  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => !o && onClose()} width={480}>
      <DialogHeader title={t('place.manual.title')} onOpenChange={(o) => !o && onClose()} />
      <VStack gap={4}>
        <FormLayout>
          <TextInput label={t('place.manual.name')} value={name} onChange={setName} isRequired />
          <TextInput label={t('place.manual.address')} value={address} onChange={setAddress} isOptional />
          {!lodgingOnly && <Selector label={t('common.type')} options={CATEGORY_OPTIONS} value={category} onChange={(v) => setCategory(v as Place['category'])} />}
        </FormLayout>
        <HStack gap={2}>
          <Button label={t('common.cancel')} variant="secondary" onClick={onClose} />
          <StackItem size="fill">
          <Button
            label={t('place.manual.add')}
            variant="primary"
            width="100%"
            isDisabled={!valid}
            onClick={() =>
              onSave({
                name: name.trim().slice(0, 60),
                address: address.trim().slice(0, 120),
                latE7: null,
                lonE7: null,
                category,
                source: { provider: 'MANUAL', externalId: null },
                naviPoi: null,
                hours: { status: 'UNKNOWN' },
              })
            }
          />
          </StackItem>
        </HStack>
      </VStack>
    </Dialog>
  );
}
