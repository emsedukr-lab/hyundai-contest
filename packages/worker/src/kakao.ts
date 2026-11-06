import { error, json } from './http';

/**
 * Place search for the trip editor, proxied so the Kakao REST key never reaches the browser.
 * Search terms are not logged. Results are hints only: the car re-confirms each place in the Hyundai navigation.
 */
interface KakaoDoc {
  id: string;
  place_name: string;
  category_group_code: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
}

const CATEGORY: Record<string, string> = { FD6: 'FOOD', CE7: 'CAFE', AD5: 'LODGING', AT4: 'SIGHT', CT1: 'SIGHT' };

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
        category: CATEGORY[str(d.category_group_code)] ?? 'OTHER',
      }));
    return json({ provider: 'KAKAO', results });
  } catch {
    return json({ error: 'SEARCH_UNAVAILABLE' }, 502);
  }
}
