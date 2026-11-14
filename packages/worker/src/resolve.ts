import { json } from './http';
import { categoryOf } from './kakao';
import { wcongToWgs84 } from './wcong';

/**
 * 공유 링크 해석 (resolve a map-app share link). Naver/Kakao "share → copy" gives a short link (naver.me, kko.to, …)
 * that the browser can't open cross-origin under the strict CSP, so the Worker follows it and reads the place name and
 * address from the page's Open Graph tags. Coordinates are NOT read here — the client resolves them with the existing
 * Kakao keyword search. Only allow-listed hosts are fetched (SSRF guard), redirects are followed manually with each
 * hop re-checked, and the URL and page content are never logged or stored. A Naver saved-list link is read from the
 * list's JSON instead (names, addresses and coordinates only — see parseNaverFolder); a Kakao folder link is not fetched.
 */

// host must equal, or be a subdomain of, one of these
const ALLOW = [/(^|\.)naver\.me$/, /(^|\.)naver\.com$/, /^kko\.to$/, /(^|\.)kakao\.com$/];
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

/** Drops a trailing site suffix a provider may append to og:title (e.g. "경포호 : 네이버", "… | 카카오맵"). */
const stripSuffix = (name: string) => name.replace(/\s*[-:|]\s*(네이버\s*지도|네이버|카카오\s*맵|카카오맵|kakao\s*map|naver\s*map)\s*$/i, '').trim();

/** A title that is only the map app's name — what a link to the app's home page (not a place) carries. */
const APP_ONLY = /^(네이버\s*지도|네이버|카카오\s*맵|카카오맵|카카오|kakao\s*map|naver\s*map|naver|kakao)$/i;

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

/**
 * A Kakao Map favorites folder (`applink.map.kakao.com/collection?folderid=…`, `map.kakao.com/?folderid=…`). Kakao's
 * data endpoints answer automated clients with "Restricted User Agent" — a deliberate block that is respected: only the
 * folder's public share page (the one a messenger reads for its link preview) is fetched, once, and nothing else.
 */
export function isKakaoFolder(u: URL): boolean {
  return kakaoFolderId(u) !== null;
}

/** The folder id of a Kakao favorites-folder link, or null. */
export function kakaoFolderId(u: URL): string | null {
  const host = u.hostname.toLowerCase();
  const folder = (host === 'applink.map.kakao.com' && /^\/collection\/?$/.test(u.pathname)) || host === 'map.kakao.com' || host === 'm.map.kakao.com';
  if (!folder) return null;
  const id = u.searchParams.get('folderid');
  return id && /^\d{1,15}$/.test(id) ? id : host === 'applink.map.kakao.com' && /^\/collection\/?$/.test(u.pathname) ? '' : null;
}

/** The folder's public share page, built from the id only (both link forms land on the same page). */
export const kakaoFolderPage = (id: string) => new URL(`https://map.kakao.com/?folderid=${id}&target=other&page=bookmark`);

/** The saved places' map points from a share page's og:image (a static map with one marker per place), at most 100. */
export function kakaoMarkers(html: string): { x: number; y: number }[] {
  const img = meta(html, 'og:image');
  let u: URL;
  try {
    u = new URL(img);
  } catch {
    return [];
  }
  if ((u.searchParams.get('srs') ?? '').toUpperCase() !== 'WCONGNAMUL') return [];
  const out: { x: number; y: number }[] = [];
  for (const m of u.searchParams.getAll('markers')) {
    const loc = m.match(/(?:^|\|)location:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:\||$)/);
    if (!loc) continue;
    const x = Number(loc[1]);
    const y = Number(loc[2]);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
  }
  return out;
}

/** The folder name and its places' points from the share page, or null when the page is the generic app page. */
export function parseKakaoFolder(html: string): { title: string; points: { lat: number; lon: number }[] } | null {
  const title = clean(meta(html, 'og:title')).slice(0, 60);
  if (!title || APP_ONLY.test(title)) return null;
  const points = kakaoMarkers(html)
    .map((m) => wcongToWgs84(m.x, m.y))
    .filter((p) => p.lat > 32 && p.lat < 40 && p.lon > 123 && p.lon < 133);
  return points.length ? { title, points } : null;
}

/** Groups looked up around each point, in order (two calls), before falling back to the address. */
const NEAR_GROUPS = ['FD6', 'CE7'];

interface NearDoc {
  place_name?: string;
  category_group_code?: string;
  category_name?: string;
  road_address_name?: string;
  address_name?: string;
  x?: string;
  y?: string;
  distance?: string;
}

/**
 * Names one saved point with Kakao's official Local API: the nearest restaurant or cafe within 30 m (two category
 * calls, side by side), else the road address there (coord2address). At most 3 calls; Kakao's ids are not kept.
 */
export async function nameNear(p: { lat: number; lon: number }, key: string, fetcher: typeof fetch): Promise<ListPlace & { guessed: true }> {
  const x = p.lon.toFixed(6);
  const y = p.lat.toFixed(6);
  const base = { latE7: Math.round(p.lat * 1e7), lonE7: Math.round(p.lon * 1e7), guessed: true as const };
  const get = async (url: URL) => {
    try {
      const res = await fetcher(url, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(5_000) });
      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        return null;
      }
      return ((await res.json()) as { documents?: unknown[] }).documents ?? null;
    } catch {
      return null;
    }
  };
  const hits = await Promise.all(
    NEAR_GROUPS.map((g) => {
      const u = new URL('https://dapi.kakao.com/v2/local/search/category.json');
      for (const [k, v] of Object.entries({ category_group_code: g, x, y, radius: '30', sort: 'distance', size: '1' })) u.searchParams.set(k, v);
      return get(u);
    }),
  );
  const best = hits
    .flatMap((d) => (d ?? []) as NearDoc[])
    .filter((d) => typeof d.place_name === 'string' && d.place_name && Number.isFinite(Number(d.x)) && Number.isFinite(Number(d.y)))
    .sort((a, b) => Number(a.distance ?? 1e9) - Number(b.distance ?? 1e9))[0];
  if (best && Number(best.distance ?? 1e9) <= 30) {
    return {
      ...base,
      name: clean(str(best.place_name)).slice(0, 60),
      address: clean(str(best.road_address_name) || str(best.address_name)).slice(0, 120),
      latE7: Math.round(Number(best.y) * 1e7),
      lonE7: Math.round(Number(best.x) * 1e7),
      category: categoryOf(str(best.category_group_code), str(best.category_name)) as ListCategory,
    };
  }
  const u = new URL('https://dapi.kakao.com/v2/local/geo/coord2address.json');
  u.searchParams.set('x', x);
  u.searchParams.set('y', y);
  const doc = ((await get(u)) ?? [])[0] as { road_address?: { address_name?: string; building_name?: string } | null; address?: { address_name?: string } | null } | undefined;
  const road = clean(str(doc?.road_address?.address_name));
  const building = clean(str(doc?.road_address?.building_name));
  const lot = clean(str(doc?.address?.address_name));
  const address = (road || lot).slice(0, 120);
  return { ...base, name: (building || address).slice(0, 60), address, category: 'OTHER' };
}

/** Runs `fn` over `items`, `limit` at a time, keeping the order. */
async function pooled<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

/**
 * A Kakao favorites folder, from its public share page only: the folder name (og:title) and one marker per place in the
 * link-preview map (og:image). Names are not on the page, so each point is named by what Kakao's official Local API
 * finds there (`guessed: true`); without the REST key the names stay empty and the phone labels them. A 403, a
 * generic page or no markers is `unsupported` — never retried, no other Kakao endpoint is called.
 */
async function kakaoList(id: string, key: string | undefined, fetcher: typeof fetch): Promise<Response> {
  if (!id) return unsupportedKakao();
  const res = await fetcher(kakaoFolderPage(id).toString(), { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(5_000) });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return unsupportedKakao();
  }
  const html = (await readCapped(res, 512 * 1024, true)) ?? '';
  const folder = parseKakaoFolder(html);
  if (!folder) return unsupportedKakao();
  const points = folder.points.slice(0, MAX_LIST);
  const places = key
    ? await pooled(points, 4, (p) => nameNear(p, key, fetcher))
    : points.map((p) => ({ name: '', address: '', latE7: Math.round(p.lat * 1e7), lonE7: Math.round(p.lon * 1e7), category: 'OTHER' as ListCategory, guessed: true as const }));
  return json({ kind: 'list', source: 'kakao', title: folder.title, total: folder.points.length, places });
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

const unsupportedKakao = () => json({ kind: 'unsupported', source: 'kakao' });

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
 * Three answers: `{kind:'place', name, address}` for a single place, `{kind:'list', source:'naver'|'kakao', …}` for a
 * Naver saved list or a Kakao favorites folder (from its share page's preview, names found by location), and
 * `{kind:'unsupported', source:'kakao'}` for a Kakao folder whose share page shows no places. `kakaoKey` is the Local
 * API key used to name a Kakao folder's points.
 */
export async function resolveShare(body: Record<string, unknown>, fetcher: typeof fetch = fetch, kakaoKey?: string): Promise<Response> {
  let url: URL;
  try {
    url = new URL(str(body.url).trim());
  } catch {
    return json({ error: 'BAD_REQUEST' }, 400);
  }
  if (url.protocol !== 'https:' || !allowedHost(url.hostname)) return json({ error: 'BAD_REQUEST' }, 400);

  try {
    const folderId = kakaoFolderId(url);
    if (folderId !== null) return await kakaoList(folderId, kakaoKey, fetcher);
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
        const nextFolder = kakaoFolderId(next);
        if (nextFolder !== null) return await kakaoList(nextFolder, kakaoKey, fetcher);
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
