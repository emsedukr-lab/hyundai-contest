import { useEffect, useMemo, useRef, useState } from 'react';
import { ToastNotice } from '../components/ToastNotice';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { Divider } from '@astryxdesign/core/Divider';
import { List, ListItem } from '@astryxdesign/core/List';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TRANSFER_LIMITS, type Place } from '@tteonaljido/shared';
import { Tag } from '../components/shell/Tag';
import { Card } from '../components/toss/Card';
import { JS_KEY, loadKakao, numberPin } from '../lib/kakaoSdk';
import { t } from '../lib/i18n';
import { ApiError, searchPlaces, type PlaceHit, type ResolvedList } from '../lib/pairing';
import { fromListPlace, inTrip } from '../lib/pasteImport';
import { Sheet } from './Sheet';
import { byName, CATEGORY_LABEL, fromHit, type NewPlace } from './PlaceSearch';

/* eslint-disable @typescript-eslint/no-explicit-any */

const NAME = '__name__';
const NONE: readonly Place[] = [];
const SKIP = '__skip__';
type Choice = number | typeof NAME | typeof SKIP;

interface Row {
  term: string;
  hits: PlaceHit[];
  choice: Choice;
}

/** Runs the async `fn` over `items` with at most `limit` in flight, so a big paste stays under the search rate limit. */
async function pool<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>): Promise<void> {
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

/**
 * 여러 곳 한번에 추가 (bulk add): searches each pasted name, lets the user pick an address per name, shows the chosen
 * set on a Kakao map, then adds them all in one go. Only clean `NewPlace` objects reach the trip (fromHit/byName).
 */
export function BulkAddDialog({
  isOpen,
  terms = [],
  list,
  existing = NONE,
  room = Infinity,
  lodgingOnly,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  /** Search mode: pasted names, each searched. */
  terms?: string[];
  /** List mode: a Naver 저장 목록 the server already read — no searches, the rows are the list. */
  list?: ResolvedList;
  /** The trip's places, so list rows already in it show 담김. */
  existing?: readonly Place[];
  /** How many more places the trip can take (placeRoom). */
  room?: number;
  lodgingOnly: boolean;
  onClose: () => void;
  onAdd: (places: NewPlace[]) => void;
}) {
  if (list) return <ListAddDialog isOpen={isOpen} list={list} existing={existing} room={room} onClose={onClose} onAdd={onAdd} />;
  return <SearchAddDialog isOpen={isOpen} terms={terms} lodgingOnly={lodgingOnly} onClose={onClose} onAdd={onAdd} />;
}

/**
 * A numbered overview map of the given places (only with the Kakao map key). The box appears only once the map SDK has
 * loaded, so a phone that can't load it (offline, a blocked script) never shows an empty 200px gap.
 */
function useOverviewMap(isOpen: boolean, coords: readonly (NewPlace & { latE7: number; lonE7: number; n?: number })[]) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [kakao, setKakao] = useState<any>(null);
  const wanted = !!JS_KEY && isOpen && coords.length > 0;
  useEffect(() => {
    if (!wanted || kakao) return;
    let cancelled = false;
    loadKakao(JS_KEY!)
      .then((k) => {
        if (!cancelled && k?.maps?.LatLng) setKakao(k);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wanted, kakao]);
  useEffect(() => {
    if (!kakao || !mapRef.current || coords.length === 0) return;
    mapRef.current.innerHTML = '';
    try {
      const map = new kakao.maps.Map(mapRef.current, { center: new kakao.maps.LatLng(coords[0].latE7 / 1e7, coords[0].lonE7 / 1e7), level: 7 });
      const bounds = new kakao.maps.LatLngBounds();
      coords.forEach((p, i) => {
        const ll = new kakao.maps.LatLng(p.latE7 / 1e7, p.lonE7 / 1e7);
        bounds.extend(ll);
        new kakao.maps.CustomOverlay({ position: ll, content: numberPin(p.n ?? i + 1, p.name), xAnchor: 0.5, yAnchor: 0.5, map, zIndex: 3 });
      });
      if (coords.length > 1) map.setBounds(bounds);
    } catch {
      /* a half-loaded SDK: leave the box empty rather than break the dialog */
    }
  }, [kakao, coords]);
  return { mapRef, showMap: wanted && !!kakao };
}

/**
 * 저장 목록 가져오기 (list mode): the rows are the shared list itself, already located, so nothing is searched (the 30 a
 * minute search budget stays untouched). Every row starts checked except those already in the trip (담김, disabled),
 * and no more than the trip has room for.
 */
function ListAddDialog({ isOpen, list, existing, room, onClose, onAdd }: { isOpen: boolean; list: ResolvedList; existing: readonly Place[]; room: number; onClose: () => void; onAdd: (places: NewPlace[]) => void }) {
  const base = useMemo(() => list.places.map((lp) => fromListPlace(lp)), [list]);
  const rows = useMemo(() => base.map((place, i) => ({ key: String(i), place, already: inTrip(existing, place) })), [base, existing]);
  const fresh = useMemo(() => rows.filter((r) => !r.already), [rows]);
  const [checked, setChecked] = useState<string[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    setChecked(base.filter((p) => !inTrip(existing, p)).slice(0, Math.max(0, room)).map((p) => String(base.indexOf(p))));
  }, [isOpen, base]); // eslint-disable-line react-hooks/exhaustive-deps -- only on opening
  const chosen = useMemo(() => rows.filter((r) => checked.includes(r.key) && !r.already), [rows, checked]);
  const over = chosen.length > room;
  // Pins keep the row's number, so "3" on the map is the third row whatever is ticked.
  const coords = useMemo(() => chosen.map((r) => ({ ...(r.place as NewPlace & { latE7: number; lonE7: number }), n: Number(r.key) + 1 })), [chosen]);
  const { mapRef, showMap } = useOverviewMap(isOpen, coords);
  const skipped = list.total - list.places.length;

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={t('bulk.list.title', { title: list.title || t('bulk.list.untitled'), n: list.places.length })} height="tall" footer={
        <HStack gap={2}>
          <Button label={t('common.cancel')} variant="secondary" onClick={onClose} />
          <StackItem size="fill">
            <Button
              label={t('bulk.list.addN', { n: chosen.length })}
              variant="primary"
              width="100%"
              isDisabled={chosen.length === 0 || over}
              onClick={() => {
                onAdd(chosen.map((r) => r.place));
                onClose();
              }}
            />
          </StackItem>
        </HStack>
    }>
      <VStack gap={4}>
        <Text color="secondary">{t('bulk.list.source')}</Text>
        {skipped > 0 && <ToastNotice status="info" title={t('bulk.list.skipped', { n: skipped })} />}
        {fresh.length === 0 && <ToastNotice status="info" title={t('bulk.list.allIn')} />}
        {fresh.length > room && <ToastNotice status="warning" title={room > 0 ? t('bulk.list.room', { n: room }) : t('trip.placeLimit', { n: TRANSFER_LIMITS.maxPlaces })} />}
        {showMap && <div ref={mapRef} style={{ width: '100%', height: 200 }} role="img" aria-label={t('map.bulkAria')} />}
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Button label={t('bulk.list.selectAll')} variant="secondary" size="sm" isDisabled={fresh.length === 0 || chosen.length === fresh.length} onClick={() => setChecked(fresh.map((r) => r.key))} />
          <Button label={t('bulk.list.clear')} variant="ghost" size="sm" isDisabled={chosen.length === 0} onClick={() => setChecked([])} />
          <span style={{ marginInlineStart: 'auto', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            <Text color="secondary" aria-label={t('bulk.list.selected', { n: chosen.length, total: rows.length })}>{chosen.length}/{rows.length}</Text>
          </span>
        </HStack>
        <Card pad={0}>
          <CheckboxList label={t('bulk.list.pick')} isLabelHidden value={checked} onChange={setChecked} hasDividers>
            {rows.map((r, i) => (
              <CheckboxListItem
                key={r.key}
                value={r.key}
                label={`${i + 1}. ${r.place.name}`}
                description={[CATEGORY_LABEL[r.place.category], r.place.address].filter(Boolean).join(' · ')}
                isDisabled={r.already}
                endContent={r.already ? <Tag>{t('tl.inTrip')}</Tag> : undefined}
              />
            ))}
          </CheckboxList>
        </Card>
      </VStack>
    </Sheet>
  );
}

function SearchAddDialog({ isOpen, terms, lodgingOnly, onClose, onAdd }: { isOpen: boolean; terms: string[]; lodgingOnly: boolean; onClose: () => void; onAdd: (places: NewPlace[]) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [searchOff, setSearchOff] = useState(false);
  const [failed, setFailed] = useState(0); // searches that errored (e.g. rate-limited) — not the same as "no match"

  // Search every term when the dialog opens (concurrency-limited).
  useEffect(() => {
    if (!isOpen || terms.length === 0) return;
    let cancelled = false;
    setRows(null);
    setSearchOff(false);
    setFailed(0);
    const result: Row[] = terms.map((term) => ({ term, hits: [], choice: NAME }));
    void (async () => {
      let off = false;
      let errors = 0;
      await pool(terms, 4, async (term, i) => {
        try {
          const hits = await searchPlaces(term);
          result[i] = { term, hits, choice: hits.length > 0 ? 0 : NAME };
        } catch (e) {
          if (e instanceof ApiError && e.status === 503) off = true;
          else errors++;
          result[i] = { term, hits: [], choice: NAME };
        }
      });
      if (cancelled) return;
      setSearchOff(off);
      setFailed(errors);
      setRows([...result]);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, terms]);

  const setChoice = (i: number, choice: Choice) => setRows((rs) => rs && rs.map((r, k) => (k === i ? { ...r, choice } : r)));

  // The places currently selected (for the count, the map and the final add).
  const selected = useMemo<NewPlace[]>(() => {
    if (!rows) return [];
    const out: NewPlace[] = [];
    for (const r of rows) {
      if (r.choice === SKIP) continue;
      const p = r.choice === NAME ? byName(r.term) : fromHit(r.hits[r.choice as number]);
      out.push(lodgingOnly ? { ...p, category: 'LODGING' } : p);
    }
    return out;
  }, [rows, lodgingOnly]);

  const located = useMemo(() => selected.filter((p): p is NewPlace & { latE7: number; lonE7: number } => p.latE7 !== null && p.lonE7 !== null), [selected]);
  const sig = useMemo(() => located.map((c) => `${c.latE7},${c.lonE7},${c.name}`).join('|'), [located]);
  // Same pins ⇒ same array, so switching a row between "by name" and "skip" doesn't rebuild the map.
  const coords = useMemo(() => located, [sig]);

  // Overview map: a numbered pin for each selected place that has coordinates.
  const { mapRef, showMap } = useOverviewMap(isOpen, coords);

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={t('bulk.title')} height="tall" footer={
        <HStack gap={2}>
          <Button label={t('common.cancel')} variant="secondary" onClick={onClose} />
          <StackItem size="fill">
            <Button
              label={t('bulk.addN', { n: selected.length })}
              variant="primary"
              width="100%"
              isDisabled={selected.length === 0}
              onClick={() => {
                onAdd(selected);
                onClose();
              }}
            />
          </StackItem>
        </HStack>
    }>
      <VStack gap={4}>
        {!rows ? (
          <HStack gap={2} vAlign="center">
            <Spinner />
            <Text color="secondary">{t('bulk.searching')}</Text>
          </HStack>
        ) : (
          <>
            {searchOff && <ToastNotice status="info" title={t('bulk.searchOff')} />}
            {!searchOff && failed > 0 && <ToastNotice status="warning" title={t('bulk.someFailed')} />}
            {showMap && <div ref={mapRef} style={{ width: '100%', height: 220 }} role="img" aria-label={t('map.bulkAria')} />}
            <Card>
              <VStack gap={3}>
                {rows.map((r, i) => (
                  <VStack key={i} gap={1}>
                    {i > 0 && <Divider />}
                    <Text type="label">{r.term}</Text>
                    <Selector
                      label={`${r.term} · ${t('bulk.pickAddress')}`}
                      isLabelHidden
                      value={String(r.choice)}
                      options={[...r.hits.map((h, k) => ({ value: String(k), label: `${h.name} · ${h.address}` })), { value: NAME, label: t('bulk.byName') }, { value: SKIP, label: t('bulk.skip') }]}
                      onChange={(v) => setChoice(i, v === NAME || v === SKIP ? v : Number(v))}
                    />
                  </VStack>
                ))}
              </VStack>
            </Card>
          </>
        )}
      </VStack>
    </Sheet>
  );
}
