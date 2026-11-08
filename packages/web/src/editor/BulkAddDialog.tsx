import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Divider } from '@astryxdesign/core/Divider';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Card } from '../components/toss/Card';
import { JS_KEY, loadKakao, numberPin } from '../lib/kakaoSdk';
import { t } from '../lib/i18n';
import { ApiError, searchPlaces, type PlaceHit } from '../lib/pairing';
import { byName, fromHit, type NewPlace } from './PlaceSearch';

/* eslint-disable @typescript-eslint/no-explicit-any */

const NAME = '__name__';
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
export function BulkAddDialog({ isOpen, terms, lodgingOnly, onClose, onAdd }: { isOpen: boolean; terms: string[]; lodgingOnly: boolean; onClose: () => void; onAdd: (places: NewPlace[]) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [searchOff, setSearchOff] = useState(false);
  const [failed, setFailed] = useState(0); // searches that errored (e.g. rate-limited) — not the same as "no match"
  const mapRef = useRef<HTMLDivElement>(null);

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
  useEffect(() => {
    if (!JS_KEY || !isOpen || !mapRef.current || coords.length === 0) return;
    let cancelled = false;
    loadKakao(JS_KEY)
      .then((kakao) => {
        if (cancelled || !mapRef.current) return;
        mapRef.current.innerHTML = '';
        const map = new kakao.maps.Map(mapRef.current, { center: new kakao.maps.LatLng(coords[0].latE7 / 1e7, coords[0].lonE7 / 1e7), level: 7 });
        const bounds = new kakao.maps.LatLngBounds();
        coords.forEach((p, i) => {
          const ll = new kakao.maps.LatLng(p.latE7 / 1e7, p.lonE7 / 1e7);
          bounds.extend(ll);
          new kakao.maps.CustomOverlay({ position: ll, content: numberPin(i + 1, p.name), xAnchor: 0.5, yAnchor: 0.5, map, zIndex: 3 });
        });
        if (coords.length > 1) map.setBounds(bounds);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, coords]);

  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => !o && onClose()} width={640}>
      <DialogHeader title={t('bulk.title')} onOpenChange={(o) => !o && onClose()} />
      <VStack gap={4}>
        {!rows ? (
          <HStack gap={2} vAlign="center">
            <Spinner />
            <Text color="secondary">{t('bulk.searching')}</Text>
          </HStack>
        ) : (
          <>
            {searchOff && <Banner status="info" title={t('bulk.searchOff')} />}
            {!searchOff && failed > 0 && <Banner status="warning" title={t('bulk.someFailed')} />}
            {JS_KEY && coords.length > 0 && <div ref={mapRef} style={{ width: '100%', height: 220 }} role="img" aria-label={t('map.bulkAria')} />}
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
      </VStack>
    </Dialog>
  );
}
