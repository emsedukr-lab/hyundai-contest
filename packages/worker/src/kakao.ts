import { error, json } from './http';

/**
 * Place search for the trip editor, proxied so the Kakao REST key never reaches the browser.
 * Search terms are not logged. Results are hints only: the car re-confirms each place in the Hyundai navigation.
 */
interface KakaoDoc {
  id: string;
  place_name: string;
  category_group_code: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
}

const CATEGORY: Record<string, string> = { FD6: 'FOOD', CE7: 'CAFE', AD5: 'LODGING', AT4: 'SIGHT', CT1: 'SIGHT' };
/** Leaves of "음식점 > 간식" that are a dessert stop (카페·디저트); the rest of 간식 — 떡,한과 and the like — is a shop. */
const DESSERT = ['제과', '베이커리', '아이스크림', '도넛', '초콜릿', '와플', '빙수'];

/**
 * A place's kind from Kakao's group code and its category path ("음식점 > 간식 > 떡,한과"). Kakao files everything
 * that sells food under 음식점 (FD6), but its 간식 branch is not somewhere to have a meal: a hangwa or rice-cake shop
 * is a shop (OTHER), a bakery or an ice-cream place a dessert stop (CAFE). Only the rest of 음식점 is a meal (FOOD).
 */
export function categoryOf(group: string, path: string): string {
  const parts = path.split('>').map((p) => p.trim());
  if (group === 'FD6' && parts[1] === '간식') return DESSERT.some((word) => (parts[2] ?? '').includes(word)) ? 'CAFE' : 'OTHER';
  return CATEGORY[group] ?? 'OTHER';
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** The map-search kinds the phone offers as chips, and Kakao's group code for each. */
export const GROUP_OF: Record<string, string> = { FOOD: 'FD6', CAFE: 'CE7', LODGING: 'AD5', SIGHT: 'AT4' };

/**
 * Korea and its seas, a little wide: the only area a map search may cover. A rect is the part of the map the user is
 * looking at (never their own location), as [minLon, minLat, maxLon, maxLat].
 */
const KOREA = { minLon: 124, maxLon: 132, minLat: 33, maxLat: 39.5 };

export type Rect = [number, number, number, number];

/** A valid map rect, or null: four finite numbers, min below max, inside {@link KOREA}. */
export function parseRect(v: unknown): Rect | null {
  if (!Array.isArray(v) || v.length !== 4 || !v.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  const [minLon, minLat, maxLon, maxLat] = v as Rect;
  if (!(minLon < maxLon && minLat < maxLat)) return null;
  if (minLon < KOREA.minLon || maxLon > KOREA.maxLon || minLat < KOREA.minLat || maxLat > KOREA.maxLat) return null;
  return [minLon, minLat, maxLon, maxLat];
}

const fixed = (n: number) => String(Math.round(n * 1e6) / 1e6);

/**
 * `body` is the POST JSON `{ q?, rect?, category?, x?, y? }`; the term never appears in a URL on our side.
 * - `q` alone: keyword search, as before (10 results).
 * - `q` + `rect`: keyword search inside the part of the map on screen (15 results); with `category` too, only that kind.
 * - `category` + `rect` (no `q`): that kind of place inside the rect, nearest the rect's centre first (15 results).
 * Anything else — a bad rect, an unknown category, a category without a rect — is a 400.
 */
export async function searchPlaces(body: Record<string, unknown>, key: string | undefined, fetcher: typeof fetch = fetch): Promise<Response> {
  const q = str(body.q).trim();
  const hasRect = body.rect !== undefined && body.rect !== null;
  const rect = hasRect ? parseRect(body.rect) : null;
  if (hasRect && !rect) return error('BAD_REQUEST');
  const hasCategory = body.category !== undefined && body.category !== null;
  const group = hasCategory ? (typeof body.category === 'string' && Object.hasOwn(GROUP_OF, body.category) ? GROUP_OF[body.category] : null) : null;
  if (hasCategory && (!group || !rect)) return error('BAD_REQUEST');
  if (q.length > 60 || (q.length < 1 && !group)) return error('BAD_REQUEST');
  if (!key) return json({ error: 'SEARCH_UNAVAILABLE' }, 503);

  const byCategory = !q && !!group;
  const upstream = new URL(`https://dapi.kakao.com/v2/local/search/${byCategory ? 'category' : 'keyword'}.json`);
  if (q) upstream.searchParams.set('query', q);
  if (group) upstream.searchParams.set('category_group_code', group);
  upstream.searchParams.set('page', '1');
  upstream.searchParams.set('size', rect ? '15' : '10');
  if (rect) {
    upstream.searchParams.set('rect', rect.map(fixed).join(','));
    if (byCategory) {
      // No term to rank by: the places nearest the middle of the map come first.
      upstream.searchParams.set('x', fixed((rect[0] + rect[2]) / 2));
      upstream.searchParams.set('y', fixed((rect[1] + rect[3]) / 2));
      upstream.searchParams.set('sort', 'distance');
    } else upstream.searchParams.set('sort', 'accuracy');
  } else {
    const x = str(body.x);
    const y = str(body.y);
    if (x && y && /^-?\d+(\.\d+)?$/.test(x) && /^-?\d+(\.\d+)?$/.test(y)) {
      upstream.searchParams.set('x', x);
      upstream.searchParams.set('y', y);
    }
  }
  // Any upstream trouble (timeout, non-JSON, odd document) is one JSON answer, never a bare 500.
  try {
    const res = await fetcher(upstream, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return json({ error: 'SEARCH_UNAVAILABLE' }, 502);
    const data = (await res.json()) as { documents?: Partial<KakaoDoc>[] };
    const results = (data.documents ?? [])
      .filter((d) => typeof d.place_name === 'string' && Number.isFinite(Number(d.x)) && Number.isFinite(Number(d.y)))
      .map((d) => ({
        externalId: str(d.id).slice(0, 40),
        name: str(d.place_name).slice(0, 60),
        address: (str(d.road_address_name) || str(d.address_name)).slice(0, 120),
        latE7: Math.round(Number(d.y) * 1e7),
        lonE7: Math.round(Number(d.x) * 1e7),
        category: categoryOf(str(d.category_group_code), str(d.category_name)),
      }));
    return json({ provider: 'KAKAO', results });
  } catch {
    return json({ error: 'SEARCH_UNAVAILABLE' }, 502);
  }
}
