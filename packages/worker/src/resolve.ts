import { json } from './http';

/**
 * 공유 링크 해석 (resolve a map-app share link). Only Naver Map links are read (decided 2026-11-15: places come from a
 * Naver Map share or a pasted name; Kakao Map share links are not imported). Naver's "share → copy" gives a short link
 * (naver.me) that the browser can't open cross-origin under the strict CSP, so the Worker follows it and reads the place
 * name and address from the page's Open Graph tags. Coordinates are NOT read here — the client resolves them with the
 * existing keyword search. Only allow-listed hosts are fetched (SSRF guard), redirects are followed manually with each
 * hop re-checked, and the URL and page content are never logged or stored. A Naver saved-list link is read from the
 * list's JSON instead (names, addresses and coordinates only — see parseNaverFolder).
 */

// host must equal, or be a subdomain of, one of these
const ALLOW = [/(^|\.)naver\.me$/, /(^|\.)naver\.com$/];
export const allowedHost = (host: string) => ALLOW.some((re) => re.test(host.toLowerCase()));

const str = (v: unknown) => (typeof v === 'string' ? v : '');

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodes the entities found in og tags: the common named ones and any numeric one (`&#44;`, `&#xAC00;`). */
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== '#') return NAMED[e.toLowerCase()] ?? m;
    const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
  });

/**
 * Reads an Open Graph / meta tag's content, tolerating either attribute order. The closing quote must match the
 * opening one, so an apostrophe inside `content="Mom's Touch"` doesn't cut the value short.
 */
function meta(html: string, prop: string): string {
  const a = html.match(new RegExp(`<meta\\b[^>]*?(?:property|name)\\s*=\\s*["']${prop}["'][^>]*?\\bcontent\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  const b = a ?? html.match(new RegExp(`<meta\\b[^>]*?\\bcontent\\s*=\\s*(["'])(.*?)\\1[^>]*?(?:property|name)\\s*=\\s*["']${prop}["']`, 'i'));
  return b ? decode(b[2]) : '';
}

/** Drops a trailing site suffix Naver may append to og:title (e.g. "경포호 : 네이버"). */
const stripSuffix = (name: string) => name.replace(/\s*[-:|]\s*(네이버\s*지도|네이버|naver\s*map)\s*$/i, '').trim();

/** A title that is only the map app's name — what a link to the app's home page (not a place) carries. */
const APP_ONLY = /^(네이버\s*지도|네이버|naver\s*map|naver)$/i;

/** Control characters some pages leave in their tags (Naver ends og:title with U+001C) would keep the suffix on. */
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Naver puts review counts in og:description ("방문자리뷰 20,158 · 블로그리뷰 9,839"), not the address. */
const NOT_ADDRESS = /^(방문자\s*리뷰|블로그\s*리뷰|리뷰)(\s|\d|$)|^(visitor|blog)\s+reviews?\b/i; // (\b is ASCII-only in JS)

/** The place name and address from a shared page's og tags, or null when the page names no place. */
export function parseOg(html: string): { name: string; address: string } | null {
  const name = stripSuffix(clean(meta(html, 'og:title'))).slice(0, 60);
  const desc = clean(meta(html, 'og:description'));
  const address = NOT_ADDRESS.test(desc) ? '' : desc.slice(0, 120);
  if (!name || APP_ONLY.test(name)) return null;
  return { name, address };
}

/**
 * Naver's share link lands on the map app (`map.naver.com/p/entry/place/{id}`, or `/p/search/…/place/{id}`), a script
 * page with no place tags; the same place's mobile page (`m.place.naver.com/place/{id}/home`) carries them.
 */
export function naverPlacePage(u: URL): URL | null {
  if (u.hostname !== 'map.naver.com') return null;
  const id = u.pathname.match(/\/place\/(\d{1,15})(?:\/|$)/)?.[1];
  return id ? new URL(`https://m.place.naver.com/place/${id}/home`) : null;
}

const UA = 'Mozilla/5.0 (compatible; TteonaljidoBot/1.0; +https://tteonaljido.tteonaljido-worker.workers.dev)';

/**
 * A Naver "저장 목록" (saved-places folder) share: `naver.me/…` lands on `map.naver.com/p/favorite/sharedPlace/folder/{id}`,
 * a script page; the folder's places come from Naver's own (unofficial, may change) JSON for that page, built here from
 * the 32-hex share id only — nothing else from the shared URL reaches the request.
 */
const SHARE_ID = /^[0-9a-f]{32}$/i;
export function naverFolderApi(u: URL): URL | null {
  const host = u.hostname.toLowerCase();
  let id: string | undefined;
  if (host === 'map.naver.com' || host === 'm.map.naver.com') id = u.pathname.match(/\/favorite\/sharedPlace\/folder\/([0-9a-f]{32})(?:\/|$)/i)?.[1];
  else if (host === 'pages.map.naver.com') id = u.pathname.match(/\/shares\/([0-9a-f]{32})(?:\/|$)/i)?.[1] ?? u.searchParams.get('shareId') ?? undefined;
  if (!id || !SHARE_ID.test(id)) return null;
  return new URL(`https://pages.map.naver.com/save-pages/api/maps-bookmark/v3/shares/${id.toLowerCase()}/bookmarks?start=0&limit=100&sort=lastUseTime`);
}

export type ListCategory = 'SIGHT' | 'FOOD' | 'CAFE' | 'LODGING' | 'OTHER';

const MCID: Record<string, ListCategory> = {
  DINING: 'FOOD',
  RESTAURANT: 'FOOD',
  FOOD: 'FOOD',
  CAFE: 'CAFE',
  ACCOMMODATION: 'LODGING',
  LODGING: 'LODGING',
  HOTEL: 'LODGING',
  STAY: 'LODGING',
  TRAVEL: 'SIGHT',
  ATTRACTION: 'SIGHT',
  CULTURE: 'SIGHT',
  TOUR: 'SIGHT',
  TOURISM: 'SIGHT',
  LANDMARK: 'SIGHT',
  PARK: 'SIGHT',
};

/** Naver's category code first, then the words of its category name. */
export function naverCategory(mcid: string, mcidName: string): ListCategory {
  const byCode = MCID[mcid.trim().toUpperCase()];
  if (byCode) return byCode;
  if (/음식점|식당|맛집/.test(mcidName)) return 'FOOD';
  if (/카페|디저트|커피/.test(mcidName)) return 'CAFE';
  if (/숙박|호텔|펜션|모텔|리조트|게스트하우스|민박/.test(mcidName)) return 'LODGING';
  if (/관광|명소|여행|공원|박물관|미술관|해수욕장/.test(mcidName)) return 'SIGHT';
  return 'OTHER';
}

export interface ListPlace {
  name: string;
  address: string;
  latE7: number;
  lonE7: number;
  category: ListCategory;
}

export const MAX_LIST = 100;

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);

/**
 * Turns Naver's folder JSON into the list the phone gets — a whitelist: the folder's name and count, and per place only
 * its name, address, coordinates and kind. The owner's profile, nickname, ids, memos and links are never copied.
 * Entries that are not places, are marked unavailable, or have no usable coordinates are skipped; at most 100.
 */
export function parseNaverFolder(data: unknown): { kind: 'list'; source: 'naver'; title: string; total: number; places: ListPlace[] } | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const folder = (d.folder && typeof d.folder === 'object' ? d.folder : {}) as Record<string, unknown>;
  const list = Array.isArray(d.bookmarkList) ? (d.bookmarkList as unknown[]) : null;
  if (!list) return null;
  const places: ListPlace[] = [];
  for (const raw of list) {
    if (places.length >= MAX_LIST) break;
    if (!raw || typeof raw !== 'object') continue;
    const b = raw as Record<string, unknown>;
    if (b.type !== 'place' || b.available === false) continue;
    const name = clean(str(b.displayName) || str(b.name)).slice(0, 60);
    const lon = num(b.px);
    const lat = num(b.py);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) continue;
    places.push({
      name,
      address: clean(str(b.address)).slice(0, 120),
      latE7: Math.round(lat * 1e7),
      lonE7: Math.round(lon * 1e7),
      category: naverCategory(str(b.mcid), str(b.mcidName)),
    });
  }
  const count = num(folder.bookmarkCount);
  return { kind: 'list', source: 'naver', title: clean(str(folder.name)).slice(0, 60), total: Number.isFinite(count) && count >= 0 ? Math.floor(count) : list.length, places };
}

/** Reads at most `cap` bytes of a body as text, or null when it is larger (the rest is not read). */
async function readCapped(res: Response, cap: number, truncate: boolean): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return res.text();
  const dec = new TextDecoder();
  let text = '';
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > cap) {
      await reader.cancel();
      if (!truncate) return null;
      break;
    }
    text += dec.decode(value, { stream: true });
  }
  return text + dec.decode(); // flush a multi-byte character split across the last chunk
}

/** Fetches a Naver saved-list's JSON (fixed URL, no redirects, 1 MB cap) and maps it. */
async function naverList(api: URL, fetcher: typeof fetch): Promise<Response> {
  const res = await fetcher(api.toString(), { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(5_000) });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return json({ error: 'RESOLVE_FAILED' }, 422);
  }
  const text = await readCapped(res, 1024 * 1024, false);
  if (text === null) return json({ error: 'RESOLVE_FAILED' }, 422);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return json({ error: 'RESOLVE_FAILED' }, 422);
  }
  const list = parseNaverFolder(data);
  return list && list.places.length > 0 ? json(list) : json({ error: 'RESOLVE_FAILED' }, 422);
}

/**
 * Two answers: `{kind:'place', name, address}` for a single Naver place and `{kind:'list', source:'naver', …}` for a
 * Naver saved list. Any other host (Kakao included) is refused with 400 before anything is fetched.
 */
export async function resolveShare(body: Record<string, unknown>, fetcher: typeof fetch = fetch): Promise<Response> {
  let url: URL;
  try {
    url = new URL(str(body.url).trim());
  } catch {
    return json({ error: 'BAD_REQUEST' }, 400);
  }
  if (url.protocol !== 'https:' || !allowedHost(url.hostname)) return json({ error: 'BAD_REQUEST' }, 400);

  try {
    const direct = naverFolderApi(url);
    if (direct) return await naverList(direct, fetcher);

    // Follow redirects by hand so every hop's host is re-checked; cap the chain.
    let current = naverPlacePage(url) ?? url;
    let res: Response | null = null;
    for (let i = 0; i < 6; i++) {
      res = await fetcher(current.toString(), { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(5_000) });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('Location');
        await res.body?.cancel().catch(() => {}); // a redirect's body is never read; release it
        if (!loc) break;
        const next = new URL(loc, current);
        if (next.protocol !== 'https:' || !allowedHost(next.hostname)) return json({ error: 'RESOLVE_FAILED' }, 422);
        const folder = naverFolderApi(next);
        if (folder) return await naverList(folder, fetcher);
        current = naverPlacePage(next) ?? next;
        continue;
      }
      break;
    }
    if (!res || !res.ok) {
      await res?.body?.cancel().catch(() => {});
      return json({ error: 'RESOLVE_FAILED' }, 422);
    }

    // Read at most ~512KB of HTML; the og tags are near the top anyway.
    const html = (await readCapped(res, 512 * 1024, true)) ?? '';
    const place = parseOg(html);
    return place ? json({ kind: 'place', ...place }) : json({ error: 'RESOLVE_FAILED' }, 422);
  } catch {
    return json({ error: 'RESOLVE_FAILED' }, 422);
  }
}
