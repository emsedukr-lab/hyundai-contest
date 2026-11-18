import { useEffect, useRef, useState } from 'react';
import { ToastNotice } from '../components/ToastNotice';
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
import { SearchIcon } from '../components/shell/icons';
import { t } from '../lib/i18n';
import { ApiError, searchPlaces, type PlaceHit, type ResolvedList } from '../lib/pairing';
import { readPaste } from '../lib/pasteImport';
import { naverShareText } from '../lib/placeShare';
import { BulkAddDialog } from './BulkAddDialog';
import './searchBar.css';

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
  placeholder,
  isLabelHidden = false,
  compact = false,
  hideFavorites = false,
  favoritesVersion = 0,
  onFavoritesChange,
  tripPlaces,
  room,
}: {
  onPick: (p: NewPlace) => void;
  onPickMany?: (places: NewPlace[]) => void;
  label?: string;
  lodgingOnly?: boolean;
  requireCoords?: boolean;
  /** Text inside the empty search field (defaults to the example names). */
  placeholder?: string;
  /** Keep the label for screen readers only; the placeholder says what the field is. */
  isLabelHidden?: boolean;
  /** Just the search field and its results: no favorites row, manual entry or paste panel. */
  compact?: boolean;
  /** No favorites row above the field (the place sheet lists them below the search instead). */
  hideFavorites?: boolean;
  /** Bump to re-read favorites changed elsewhere (the place sheet's own list), so the ☆/★ on results stay right. */
  favoritesVersion?: number;
  /** A result's ☆/★ was toggled: lets the place sheet refresh its favorites list. */
  onFavoritesChange?: () => void;
  /** The trip's places (a pasted saved list marks those already in it 담김). */
  tripPlaces?: readonly Place[];
  /** How many more places the trip can take. */
  room?: number;
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
  const [bulkList, setBulkList] = useState<ResolvedList | null>(null);
  const [reading, setReading] = useState(false);
  const searchId = useRef(0);
  useEffect(() => () => { searchId.current++; }, []);
  const changeQuery = (value: string) => {
    searchId.current++;
    setQ(value);
    setBusy(false);
    if (!value.trim()) {
      setHits(null);
      setNote(null);
      setSearchError(false);
    }
  };

  useEffect(() => {
    void favorites.all().then(setFavs);
  }, [favoritesVersion]);
  const reloadFavs = async () => setFavs(await favorites.all());
  const isFav = (p: NewPlace) => favs.some((f) => f.id === favoriteId(p));
  const toggleFav = async (p: NewPlace) => {
    if (isFav(p)) await favorites.remove(favoriteId(p));
    else await favorites.put(toFavorite(p));
    await reloadFavs();
    onFavoritesChange?.();
  };
  /** Add respecting the lodging-only context (e.g. when picking a night's lodging). */
  const pick = (p: NewPlace) => onPick(lodgingOnly ? { ...p, category: 'LODGING' } : p);

  /** Adds a place by name only; the car finds its exact location in the Hyundai navigation. */
  const addByName = () => {
    const name = q.trim();
    if (!name) return;
    const p = byName(name);
    onPick(lodgingOnly ? { ...p, category: 'LODGING' } : p);
    changeQuery('');
  };

  const run = async (query?: string) => {
    const term = (query ?? q).trim();
    if (!term) return;
    const id = ++searchId.current;
    setBusy(true);
    setNote(null);
    setSearchError(false);
    try {
      const results = await searchPlaces(term);
      if (id !== searchId.current) return;
      setHits(results);
      setUnavailable(false);
    } catch (e) {
      if (id !== searchId.current) return;
      setHits(null);
      // Three different troubles, three answers: search is switched off here (503), the request never left the
      // phone (no status: the network), or the server or Kakao could not answer just now. A search that worked and
      // found nothing is not an error at all — that is the 'no results' line below.
      const off = e instanceof ApiError && e.status === 503;
      const offline = !(e instanceof ApiError) || e.status === 0;
      setUnavailable(off);
      setSearchError(true);
      setNote(off ? t('place.search.unavailable') : offline ? t('place.search.failed') : t('place.search.busy'));
    } finally {
      if (id === searchId.current) setBusy(false);
    }
  };

  /** Best-effort: pull the copied map text straight from the clipboard (falls back to manual paste if blocked). */
  const readClipboard = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      const share = naverShareText(txt);
      if (share) setPaste(share);
      else setNote(t(txt.trim() ? 'place.paste.naverOnly' : 'place.paste.clipboardEmpty'));
    } catch {
      setNote(t('place.paste.clipboardFail'));
    }
  };

  /**
   * The saved-list button reads the clipboard and runs the paste at once. When the browser won't hand
   * the clipboard over (permission denied, or an empty clipboard), the paste box opens instead.
   */
  const pasteFromClipboard = async () => {
    let txt = '';
    try {
      txt = await navigator.clipboard.readText();
    } catch {
      setShowPaste(true);
      setNote(t('place.paste.clipboardFail'));
      return;
    }
    if (!txt.trim()) {
      setShowPaste(true);
      setNote(t('place.paste.clipboardEmpty'));
      return;
    }
    const share = naverShareText(txt);
    if (!share) return setNote(t('place.paste.naverOnly'));
    await runPaste(share);
  };

  /**
   * Turn pasted map text into places. A Naver Map link is read by the server first: a 저장 목록 opens the list dialog (no
   * searches), a single place is searched by its name; a Kakao Map link gets a clear message (not imported). Several lines (and
   * onPickMany available) → the bulk dialog searches each name. A single name → the normal single search.
   */
  const runPaste = async (text = paste) => {
    setNote(null);
    setReading(true);
    let out;
    try {
      out = await readPaste(text);
    } finally {
      setReading(false);
    }
    if (out.kind === 'empty') return setNote(t('place.paste.noName'));
    if (out.kind === 'failed') return setNote(t('place.resolve.failed'));
    if (out.kind === 'kakao') {
      // Keep the paste box open: the place names can still be pasted (one per line).
      setShowPaste(true);
      setPaste('');
      return setNote(t('place.paste.kakao'));
    }
    if (out.kind === 'list') {
      if (!onPickMany) return setNote(t('place.paste.listHere'));
      setBulkList(out.list);
      setShowPaste(false);
      setPaste('');
      return;
    }
    const terms = out.terms;
    if (onPickMany && terms.length > 1) {
      setBulkTerms(terms);
      setShowPaste(false);
      setPaste('');
      return;
    }
    const term = terms[0];
    changeQuery(term);
    setShowPaste(false);
    setPaste('');
    await run(term);
  };

  // A picker that needs coordinates can't use a name-only favorite.
  const shownFavs = requireCoords ? favs.filter((f) => f.latE7 !== null && f.lonE7 !== null) : favs;
  // Offer "add by name" when search failed or found nothing — never where a real location is required.
  const canAddByName = !requireCoords && !!q.trim() && (searchError || hits?.length === 0);
  const manualLabel = onPickMany ? t('place.manual.short') : unavailable ? t('place.manual.searchOff') : t('place.manual.open');

  return (
    <VStack gap={2}>
      {!compact && !hideFavorites && shownFavs.length > 0 && (
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
      {/* Enter runs the search; the full field stays available for typing. */}
      <div role="search">
        <TextInput
          label={label}
          isLabelHidden={isLabelHidden}
          value={q}
          onChange={changeQuery}
          onEnter={() => run()}
          enterKeyHint="search"
          placeholder={placeholder ?? t('place.search.placeholder')}
          startIcon={<SearchIcon />}
          isLoading={busy}
          hasClear
          controlClassName="tn-searchbar"
        />
      </div>
      {!compact && (
        <HStack gap={2} wrap="wrap" className={onPickMany ? 'ps-place-actions' : undefined}>
          {onPickMany && <Button label={t('place.paste.quick')} variant="primary" width="100%" isLoading={reading} onClick={() => void pasteFromClipboard()}><span className="ps-action-label">{t('place.paste.quick')}</span></Button>}
          {!requireCoords && <Button label={manualLabel} variant="secondary" size={onPickMany ? 'md' : 'sm'} onClick={() => setManual(true)}>{onPickMany ? <span className="ps-action-label">{manualLabel}</span> : undefined}</Button>}
          {!onPickMany && <Button label={t('place.paste.open')} variant="ghost" size="sm" onClick={() => setShowPaste((v) => !v)} />}
        </HStack>
      )}
      {note && <ToastNotice status="info" title={note} onDismiss={() => setNote(null)} />}
      {hits && hits.length === 0 && !busy && <ToastNotice status="info" title={t('place.search.noResults')} />}
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
                changeQuery('');
              }}
            />
          ))}
        </List>
        </Card>
      )}
      {!compact && showPaste && (
        <VStack gap={2}>
          <TextArea label={t('place.paste.label')} value={paste} onChange={setPaste} placeholder={t('place.paste.placeholder')} rows={3} isOptional />
          {onPickMany && (
            <Text type="supporting" color="secondary">
              {t('place.bulk.hint')}
            </Text>
          )}
          <HStack gap={2}>
            <Button label={t('place.paste.fromClipboard')} variant="ghost" size="sm" onClick={() => void readClipboard()} />
            <Button label={t('place.paste.find')} variant="primary" size="sm" isDisabled={!paste.trim()} isLoading={reading} onClick={() => void runPaste()} />
          </HStack>
        </VStack>
      )}
      <ManualPlaceDialog isOpen={manual} lodgingOnly={lodgingOnly} onClose={() => setManual(false)} onSave={(p) => (onPick(p), setManual(false))} />
      {onPickMany && bulkTerms && (
        <BulkAddDialog isOpen terms={bulkTerms} lodgingOnly={lodgingOnly} onClose={() => setBulkTerms(null)} onAdd={(places) => onPickMany(places)} />
      )}
      {onPickMany && bulkList && (
        <BulkAddDialog isOpen list={bulkList} existing={tripPlaces} room={room} lodgingOnly={lodgingOnly} onClose={() => setBulkList(null)} onAdd={(places) => onPickMany(places)} />
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
