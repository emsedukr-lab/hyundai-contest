import { json } from './http';

/**
 * 공유 링크 해석 (resolve a map-app share link). Naver/Kakao "share → copy" gives a short link (naver.me, kko.kl, …)
 * that the browser can't open cross-origin under the strict CSP, so the Worker follows it and reads the place name and
 * address from the page's Open Graph tags. Coordinates are NOT read here — the client resolves them with the existing
 * Kakao keyword search. Only allow-listed hosts are fetched (SSRF guard), redirects are followed manually with each
 * hop re-checked, and the URL and page content are never logged or stored.
 */

// host must equal, or be a subdomain of, one of these
const ALLOW = [/(^|\.)naver\.me$/, /(^|\.)naver\.com$/, /^kko\.kl$/, /^kko\.to$/, /(^|\.)kakao\.com$/];
const allowedHost = (host: string) => ALLOW.some((re) => re.test(host.toLowerCase()));

const str = (v: unknown) => (typeof v === 'string' ? v : '');

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (m) => ENTITIES[m] ?? m);

/** Reads an Open Graph / meta tag's content, tolerating either attribute order. */
function meta(html: string, prop: string): string {
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*?content=["']([^"']*)["']`, 'i'));
  const b = a ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${prop}["']`, 'i'));
  return b ? decode(b[1]) : '';
}

/** Drops a trailing site suffix a provider may append to og:title (e.g. "경포호 : 네이버", "… | 카카오맵"). */
const stripSuffix = (name: string) => name.replace(/\s*[-:|]\s*(네이버\s*지도|네이버|카카오\s*맵|카카오맵|kakao\s*map|naver\s*map)\s*$/i, '').trim();

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
    let current = url;
    let res: Response | null = null;
    for (let i = 0; i < 6; i++) {
      res = await fetch(current.toString(), { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(5_000) });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('Location');
        if (!loc) break;
        const next = new URL(loc, current);
        if (next.protocol !== 'https:' || !allowedHost(next.hostname)) return json({ error: 'RESOLVE_FAILED' }, 422);
        current = next;
        continue;
      }
      break;
    }
    if (!res || !res.ok) return json({ error: 'RESOLVE_FAILED' }, 422);

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
    } else {
      html = await res.text();
    }

    const name = stripSuffix(meta(html, 'og:title').replace(/\s+/g, ' ').trim()).slice(0, 60);
    const address = meta(html, 'og:description').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!name) return json({ error: 'RESOLVE_FAILED' }, 422);
    return json({ name, address });
  } catch {
    return json({ error: 'RESOLVE_FAILED' }, 422);
  }
}
