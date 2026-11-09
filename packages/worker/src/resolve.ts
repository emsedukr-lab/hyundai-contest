import { json } from './http';

/**
 * 공유 링크 해석 (resolve a map-app share link). Naver/Kakao "share → copy" gives a short link (naver.me, kko.to, …)
 * that the browser can't open cross-origin under the strict CSP, so the Worker follows it and reads the place name and
 * address from the page's Open Graph tags. Coordinates are NOT read here — the client resolves them with the existing
 * Kakao keyword search. Only allow-listed hosts are fetched (SSRF guard), redirects are followed manually with each
 * hop re-checked, and the URL and page content are never logged or stored.
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

export async function resolveShare(body: Record<string, unknown>): Promise<Response> {
  let url: URL;
  try {
    url = new URL(str(body.url).trim());
  } catch {
    return json({ error: 'BAD_REQUEST' }, 400);
  }
  if (url.protocol !== 'https:' || !allowedHost(url.hostname)) return json({ error: 'BAD_REQUEST' }, 400);

  try {
    // Follow redirects by hand so every hop's host is re-checked; cap the chain.
    let current = naverPlacePage(url) ?? url;
    let res: Response | null = null;
    for (let i = 0; i < 6; i++) {
      res = await fetch(current.toString(), { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(5_000) });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('Location');
        await res.body?.cancel().catch(() => {}); // a redirect's body is never read; release it
        if (!loc) break;
        const next = new URL(loc, current);
        if (next.protocol !== 'https:' || !allowedHost(next.hostname)) return json({ error: 'RESOLVE_FAILED' }, 422);
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
    let html = '';
    const reader = res.body?.getReader();
    if (reader) {
      const dec = new TextDecoder();
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        html += dec.decode(value, { stream: true });
        if (size > 512 * 1024) {
          await reader.cancel();
          break;
        }
      }
      html += dec.decode(); // flush a multi-byte character split across the last chunk
    } else {
      html = await res.text();
    }

    const place = parseOg(html);
    return place ? json(place) : json({ error: 'RESOLVE_FAILED' }, 422);
  } catch {
    return json({ error: 'RESOLVE_FAILED' }, 422);
  }
}
