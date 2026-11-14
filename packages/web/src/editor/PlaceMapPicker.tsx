import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { List, ListItem } from '@astryxdesign/core/List';
import { TextInput } from '@astryxdesign/core/TextInput';
import type { Trip } from '@tteonaljido/shared';
import { Card } from '../components/toss/Card';
import { ChevronIcon, CloseIcon, SearchIcon } from '../components/shell/icons';
import { Tag } from '../components/shell/Tag';
import { t } from '../lib/i18n';
import { JS_KEY, loadKakao } from '../lib/kakaoSdk';
import { clampRect, distanceText, nearestTripM, startPoints, tooWide, tripMatch, tripPins } from '../lib/mapPick';
import { ApiError, searchPlaces, type MapCategory, type MapRect, type PlaceHit } from '../lib/pairing';
import { CATEGORY_LABEL, fromHit, type NewPlace } from './PlaceSearch';
import './mapPicker.css';
import './searchBar.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

const CHIPS: { value: MapCategory; label: string }[] = [
  { value: 'SIGHT', label: t('mapPick.chip.sight') },
  { value: 'FOOD', label: t('mapPick.chip.food') },
  { value: 'CAFE', label: t('mapPick.chip.cafe') },
  { value: 'LODGING', label: t('mapPick.chip.lodging') },
];

/** The middle of South Korea, zoomed out to the whole country: where the map waits when the trip has no coordinates yet. */
const KOREA_CENTER = { lat: 36.35, lon: 127.85, level: 13 };

type Search = { q: string; category: MapCategory | null };

/** The static check mark inside an added pin (no user text in it). */
const CHECK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * 지도에서 보고 담기: the add-place sheet's 지도 view. The user looks at a part of the map, taps a chip (관광 · 맛집 ·
 * 카페 · 숙소) or types a name, and the relay searches **that part of the map** — the bounds of what is on screen, never
 * the user's own location. Results are accent dots; the trip's own places are small ink dots so the route stays in
 * view. Tapping a dot opens a card with 담기; a place already in the trip reads 담김. The same results are listed under
 * the map (목록으로 보기) for anyone who cannot or would rather not use the map.
 *
 * Needs the Kakao map SDK (`VITE_KAKAO_JS_KEY`); the sheet hides the 지도 toggle without it and comes back to 목록
 * if the SDK fails to load (`onMapFailed`) or search is switched off on the relay (`onUnavailable`, a 503).
 */
export function PlaceMapPicker({
  plan,
  onAdd,
  onUndo,
  onUnavailable,
  onMapFailed,
  primary = true,
}: {
  plan: Trip;
  /** Saves the place to the trip; returns its placeRef, or null if the trip is full (the caller says so). */
  onAdd: (p: NewPlace) => string | null;
  /** 되돌리기 after 담기: takes the place out of the trip again. */
  onUndo: (placeRef: string) => void;
  onUnavailable: () => void;
  onMapFailed: () => void;
  /** 담기 is the screen's one blue button; false where the screen already has one (the new-trip 다음). */
  primary?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const kakaoRef = useRef<any>(null);
  const overlays = useRef<any[]>([]);
  /** A move made by code (fitting results) is not the user panning: no 다시 찾기 for it. */
  const quiet = useRef(false);
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<MapCategory | null>(null);
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [last, setLast] = useState<Search | null>(null);
  const [moved, setMoved] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  /** Results this view put into the trip: externalId → placeRef, for 되돌리기. */
  const [added, setAdded] = useState<Record<string, string>>({});
  const [listOpen, setListOpen] = useState(false);

  // The map, once. Its first view: the trip's places, else its lodging, else the whole country until a search.
  useEffect(() => {
    if (!JS_KEY) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    // The SDK can load its first file and then stall on the next (blocked, offline half-way): its ready callback never
    // comes and the promise never settles. Give it 10 s, then go back to the list like any other failure.
    const stall = setTimeout(() => {
      if (cancelled || mapRef.current) return;
      cancelled = true;
      onMapFailed();
    }, 10_000);
    loadKakao(JS_KEY)
      .then((kakao) => {
        clearTimeout(stall);
        if (cancelled || !boxRef.current) return;
        kakaoRef.current = kakao;
        const first = startPoints(plan);
        const ll = (latE7: number, lonE7: number) => new kakao.maps.LatLng(latE7 / 1e7, lonE7 / 1e7);
        const map = new kakao.maps.Map(boxRef.current, {
          center: first.length ? ll(first[0].latE7, first[0].lonE7) : new kakao.maps.LatLng(KOREA_CENTER.lat, KOREA_CENTER.lon),
          level: first.length ? 5 : KOREA_CENTER.level,
        });
        mapRef.current = map;
        if (first.length > 1) {
          const b = new kakao.maps.LatLngBounds();
          for (const p of first) b.extend(ll(p.latE7, p.lonE7));
          map.setBounds(b, 56, 24, 24, 24);
        }
        const userMoved = () => !quiet.current && setMoved(true);
        kakao.maps.event.addListener(map, 'dragend', userMoved);
        kakao.maps.event.addListener(map, 'zoom_changed', userMoved);
        kakao.maps.event.addListener(map, 'idle', () => (quiet.current = false));
        kakao.maps.event.addListener(map, 'click', () => setSelected(null));
        // The sheet rises while the map is made; Kakao needs telling when its box settles.
        observer = new ResizeObserver(() => map.relayout());
        observer.observe(boxRef.current);
        setReady(true);
      })
      .catch(() => {
        clearTimeout(stall);
        if (!cancelled) onMapFailed();
      });
    return () => {
      cancelled = true;
      clearTimeout(stall);
      observer?.disconnect();
      for (const o of overlays.current) o.setMap(null);
      overlays.current = [];
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- made once; later plan changes only redraw the pins
  }, []);

  const inTrip = useMemo(() => new Map((hits ?? []).map((h) => [h.externalId, tripMatch(plan, h)])), [hits, plan]);

  // Pins: the trip's places (ink, under everything), then the results (accent; added ones ink with a check).
  useEffect(() => {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    if (!ready || !kakao || !map) return;
    for (const o of overlays.current) o.setMap(null);
    overlays.current = [];
    const at = (latE7: number, lonE7: number) => new kakao.maps.LatLng(latE7 / 1e7, lonE7 / 1e7);
    for (const p of tripPins(plan)) {
      const el = document.createElement('span');
      el.className = 'mp-trip';
      el.title = p.name;
      overlays.current.push(new kakao.maps.CustomOverlay({ position: at(p.latE7, p.lonE7), content: el, xAnchor: 0.5, yAnchor: 0.5, map, zIndex: 1 }));
    }
    for (const h of hits ?? []) {
      const mine = !!inTrip.get(h.externalId);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `mp-pin${mine ? ' is-added' : ''}${selected === h.externalId ? ' is-selected' : ''}`;
      el.setAttribute('aria-label', mine ? t('mapPick.pinInTrip', { name: h.name }) : h.name);
      el.setAttribute('aria-pressed', String(selected === h.externalId));
      const dot = document.createElement('span');
      dot.className = 'mp-dot';
      if (mine) dot.innerHTML = CHECK_SVG;
      el.appendChild(dot);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelected(h.externalId);
      });
      overlays.current.push(new kakao.maps.CustomOverlay({ position: at(h.latE7, h.lonE7), content: el, xAnchor: 0.5, yAnchor: 0.5, map, zIndex: selected === h.externalId ? 4 : 3, clickable: true }));
    }
  }, [ready, hits, plan, selected, inTrip]);

  /** What is on screen, as the relay takes it (cut to Korea); null when the map is not up or shows no part of Korea. */
  const viewRect = (): MapRect | null => {
    const b = mapRef.current?.getBounds();
    if (!b) return null;
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    const r6 = (n: number) => Math.round(n * 1e6) / 1e6; // ~10 cm: plenty, and a short body
    return clampRect([r6(sw.getLng()), r6(sw.getLat()), r6(ne.getLng()), r6(ne.getLat())]);
  };

  const run = async (s: Search, again = false) => {
    if ((!s.q && !s.category) || !mapRef.current) return; // nothing to search, or no map yet to say where
    const rect = viewRect();
    if (s.category && (!rect || tooWide(rect))) {
      setNote(t('mapPick.zoomIn'));
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const found = await searchPlaces(s.q, { rect: rect ?? undefined, category: s.category ?? undefined });
      setHits(found);
      setLast(s);
      setMoved(false);
      setSelected(null);
      // A typed name may be anywhere on screen: bring the results into view. A chip (or 다시 찾기) keeps the map where the user put it.
      const kakao = kakaoRef.current;
      if (!again && s.q && found.length && kakao && mapRef.current) {
        const b = new kakao.maps.LatLngBounds();
        for (const h of found) b.extend(new kakao.maps.LatLng(h.latE7 / 1e7, h.lonE7 / 1e7));
        quiet.current = true;
        mapRef.current.setBounds(b, 56, 24, 24, 24);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) return onUnavailable();
      const offline = !(e instanceof ApiError) || e.status === 0;
      setNote(offline ? t('mapPick.failed') : t('mapPick.busy'));
    } finally {
      setBusy(false);
    }
  };

  const tapChip = (c: MapCategory) => {
    if (!ready) return;
    if (chip === c) return setChip(null); // a second tap lets go of the chip; the pins stay
    setChip(c);
    setQ('');
    void run({ q: '', category: c });
  };
  const searchTyped = () => {
    const term = q.trim();
    if (!term || !ready) return;
    setChip(null);
    void run({ q: term, category: null });
  };

  /** Selects a result from the list below the map and brings its pin into view. */
  const show = (h: PlaceHit) => {
    setSelected(h.externalId);
    const kakao = kakaoRef.current;
    if (kakao && mapRef.current) {
      quiet.current = true;
      mapRef.current.panTo(new kakao.maps.LatLng(h.latE7 / 1e7, h.lonE7 / 1e7));
    }
  };

  const add = (h: PlaceHit) => {
    const ref = onAdd(fromHit(h));
    if (ref) setAdded((a) => ({ ...a, [h.externalId]: ref }));
  };
  const undo = (h: PlaceHit) => {
    const ref = added[h.externalId];
    if (!ref) return;
    onUndo(ref);
    setAdded(({ [h.externalId]: _, ...rest }) => rest);
  };

  const card = hits?.find((h) => h.externalId === selected) ?? null;
  const status = note ?? (hits && hits.length === 0 ? t('mapPick.empty') : hits === null && !busy ? t('mapPick.hint') : null);

  /** 담기, or what has become of the place: just added here (담았어요 + 되돌리기), or in the trip already (담김). */
  const action = (h: PlaceHit, where: 'card' | 'list') => {
    if (added[h.externalId] && inTrip.get(h.externalId))
      return (
        <span className="mp-done">
          {where === 'card' && <span className="mp-done-text">{t('mapPick.added')}</span>}
          <Button label={t('mapPick.undo')} variant="ghost" size="sm" onClick={(e) => (e.stopPropagation(), undo(h))} />
        </span>
      );
    if (inTrip.get(h.externalId)) return where === 'card' ? <span className="mp-intrip">{t('tl.inTrip')}</span> : <Tag>{t('tl.inTrip')}</Tag>;
    return <Button label={t('mapPick.add')} variant={where === 'card' && primary ? 'primary' : 'secondary'} size={where === 'card' ? 'md' : 'sm'} onClick={(e) => (e.stopPropagation(), add(h))} />;
  };
  const near = (h: PlaceHit) => {
    const m = nearestTripM(plan, h);
    return m === null ? null : t('mapPick.near', { distance: distanceText(m) });
  };

  return (
    <div className="mp">
      <div role="search">
        <TextInput
          label={t('mapPick.search')}
          isLabelHidden
          value={q}
          onChange={setQ}
          onEnter={searchTyped}
          enterKeyHint="search"
          placeholder={t('place.search.placeholder')}
          startIcon={<SearchIcon />}
          isLoading={busy}
          hasClear
          controlClassName="tn-searchbar"
        />
      </div>
      <div className="mp-chips" role="group" aria-label={t('mapPick.kinds')}>
        {CHIPS.map((c) => (
          <button key={c.value} type="button" className={`tl-chip mp-chip${chip === c.value ? ' is-on' : ''}`} aria-pressed={chip === c.value} onClick={() => tapChip(c.value)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="mp-frame">
        <div ref={boxRef} className="mp-map" role="application" aria-label={t('mapPick.aria')} />
        <div className="mp-top">
          {status && (
            <p className="mp-status" role="status">
              {status}
            </p>
          )}
          {moved && last && (
            <button type="button" className="mp-rerun" onClick={() => void run(last, true)}>
              <SearchIcon />
              {t('mapPick.rerun')}
            </button>
          )}
        </div>
        {card && (
          <section className="mp-card" aria-label={card.name}>
            <div className="mp-card-text">
              <h3 className="mp-card-name">{card.name}</h3>
              <p className="mp-card-meta">{[CATEGORY_LABEL[card.category], card.address].filter(Boolean).join(' · ')}</p>
              {near(card) && <p className="mp-card-near">{near(card)}</p>}
            </div>
            <button type="button" className="tn-iconbtn mp-card-close" aria-label={t('common.close')} onClick={() => setSelected(null)}>
              <CloseIcon />
            </button>
            <div className="mp-card-action">{action(card, 'card')}</div>
          </section>
        )}
      </div>

      {hits && hits.length > 0 && (
        <>
          <button type="button" className="mp-listtoggle" aria-expanded={listOpen} onClick={() => setListOpen((o) => !o)}>
            <span>{t(listOpen ? 'mapPick.hideList' : 'mapPick.showList', { n: hits.length })}</span>
            <span className={`mp-chev${listOpen ? ' is-open' : ''}`} aria-hidden="true">
              <ChevronIcon />
            </span>
          </button>
          {listOpen && (
            <Card pad={0}>
              <List hasDividers>
                {hits.map((h) => (
                  <ListItem
                    key={h.externalId}
                    label={h.name}
                    description={[CATEGORY_LABEL[h.category], near(h)].filter(Boolean).join(' · ')}
                    isSelected={selected === h.externalId}
                    onClick={() => show(h)}
                    endContent={action(h, 'list')}
                  />
                ))}
              </List>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
