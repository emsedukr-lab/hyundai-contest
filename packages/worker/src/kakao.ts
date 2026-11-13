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

/** `body` is the POST JSON `{ q, x?, y? }`; the term never appears in a URL on our side. */
export async function searchPlaces(body: Record<string, unknown>, key: string | undefined): Promise<Response> {
  const q = str(body.q).trim();
  if (q.length < 1 || q.length > 60) return error('BAD_REQUEST');
  if (!key) return json({ error: 'SEARCH_UNAVAILABLE' }, 503);

  const upstream = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  upstream.searchParams.set('query', q);
  upstream.searchParams.set('size', '10');
  const x = str(body.x);
  const y = str(body.y);
  if (x && y && /^-?\d+(\.\d+)?$/.test(x) && /^-?\d+(\.\d+)?$/.test(y)) {
    upstream.searchParams.set('x', x);
    upstream.searchParams.set('y', y);
  }
  // Any upstream trouble (timeout, non-JSON, odd document) is one JSON answer, never a bare 500.
  try {
    const res = await fetch(upstream, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(5_000) });
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
