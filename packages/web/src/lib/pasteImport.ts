import type { Place } from '@tteonaljido/shared';
import { resolvePlace, resolvedName, type ListPlace, type ResolvedList } from './pairing';
import { isKakaoLink, parsePastedPlace, parsePastedPlaces } from './placeShare';

/**
 * What a paste (or the clipboard) turns into. A Naver Map link is asked to the server first, because the same short
 * link can be a single place or a whole 저장 목록; a Kakao Map link is not imported (map-app sharing is Naver Map only)
 * and is never sent; plain names (one per line) go to the search as before.
 */
export type PasteOutcome =
  | { kind: 'list'; list: ResolvedList }
  | { kind: 'terms'; terms: string[] }
  | { kind: 'kakao' } // a Kakao Map share link: not imported
  | { kind: 'failed' } // a link the server could not read, and no name beside it
  | { kind: 'empty' }; // neither a name nor a link

type Resolver = typeof resolvePlace;

export async function readPaste(text: string, resolve: Resolver = resolvePlace): Promise<PasteOutcome> {
  const terms = parsePastedPlaces(text);
  const url = parsePastedPlace(text).url;
  // Several names: a list typed or copied by hand; the link (if any) is one of many lines and is not followed. Up to
  // two lines beside a link can still be a share's header ("[네이버 지도]", the list's name, a count), so it is read.
  if (isKakaoLink(url) || /https?:\/\/(?:kko\.to|[^\s/]*kakao\.com)\b/i.test(text)) return { kind: 'kakao' };
  if (!url || terms.length > 2) return terms.length ? { kind: 'terms', terms } : { kind: 'empty' };
  try {
    const r = await resolve(url);
    if (r.kind === 'list') return r.places.length ? { kind: 'list', list: r } : { kind: 'failed' };
    // A single place: the name the user copied wins over the page's title (same as before links were read).
    if (terms.length) return { kind: 'terms', terms };
    const name = resolvedName(r);
    return name ? { kind: 'terms', terms: [name.slice(0, 60)] } : { kind: 'failed' };
  } catch {
    return terms.length ? { kind: 'terms', terms } : { kind: 'failed' };
  }
}

type Point = { latE7: number; lonE7: number };

/** Straight-line distance in metres (haversine). */
export function metres(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const la1 = (a.latE7 / 1e7) * rad;
  const la2 = (b.latE7 / 1e7) * rad;
  const dLon = ((b.lonE7 - a.lonE7) / 1e7) * rad;
  const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/** Places that count as "already in the trip": same name within 50 m, or the same (non-empty) address. */
export function inTrip(places: readonly Place[], p: { name: string; address: string; latE7: number | null; lonE7: number | null }): boolean {
  const name = squash(p.name);
  const address = squash(p.address);
  return places.some((q) => {
    if (address && squash(q.address) === address) return true;
    if (squash(q.name) !== name) return false;
    if (q.latE7 === null || q.lonE7 === null || p.latE7 === null || p.lonE7 === null) return false;
    return metres({ latE7: q.latE7, lonE7: q.lonE7 }, { latE7: p.latE7, lonE7: p.lonE7 }) <= 50;
  });
}

/**
 * The same place as a shared one (the /add landing): the same Kakao place, or the same name within 50 m (or the same
 * name when neither has a location). The address
 * is not compared here — a search hit's address is the street of a whole building, which several places share.
 */
export function sameAsShared(places: readonly Place[], p: Omit<Place, 'placeRef'>): Place | null {
  const id = p.source.provider === 'KAKAO' ? p.source.externalId : null;
  const name = squash(p.name);
  return (
    places.find((q) => {
      if (id && q.source.provider === 'KAKAO' && q.source.externalId === id) return true;
      if (squash(q.name) !== name) return false;
      if (q.latE7 === null && p.latE7 === null) return true; // both added by name only (search off): the name is all there is
      if (q.latE7 === null || q.lonE7 === null || p.latE7 === null || p.lonE7 === null) return false;
      return metres({ latE7: q.latE7, lonE7: q.lonE7 }, { latE7: p.latE7, lonE7: p.lonE7 }) <= 50;
    }) ?? null
  );
}

/**
 * A saved-list place as a trip place. Naver's place id is not kept (the transfer format knows Kakao and manual places
 * only), so it travels as a manual place with the coordinates the list gave; the car still confirms it in its navigation.
 */
export const fromListPlace = (p: ListPlace): Omit<Place, 'placeRef'> => ({
  name: p.name.slice(0, 60),
  address: p.address.slice(0, 120),
  latE7: p.latE7,
  lonE7: p.lonE7,
  category: p.category,
  source: { provider: 'MANUAL', externalId: null },
  naviPoi: null,
  hours: { status: 'UNKNOWN' },
});

/**
 * A paste handed from one screen to another (the share landing → the 장소 tab, for a whole list) — kept in memory only,
 * so the link never sits in a URL or in storage. Taken once.
 */
let handed: string | null = null;
export const handOffPaste = (text: string) => {
  handed = text;
};
export const takeHandOff = (): string | null => {
  const v = handed;
  handed = null;
  return v;
};
