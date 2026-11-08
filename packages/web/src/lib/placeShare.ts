/**
 * 지도앱 장소 공유 수집 (collect a place shared from a map app). When a Naver/Kakao/Google Maps "share" targets the
 * installed PWA, the browser lands on `/add?title=…&text=…&url=…` (a GET Web Share Target — no service worker, and it
 * is a plain navigation so the strict `form-action` CSP does not apply). These helpers pull the best search term and
 * link out of that payload; the page then resolves the term to coordinates with the existing Kakao keyword search
 * (same-origin relay, no new key) or falls back to adding the place by name only.
 */

export interface SharedParams {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}

const isUrl = (s: string): boolean => /^https?:\/\//i.test(s.trim());

/** The best place-name search term from a share payload: the title, else the first non-URL line of the text. */
export function sharedPlaceTerm(p: SharedParams): string | null {
  const title = (p.title ?? '').trim();
  if (title && !isUrl(title)) return title.slice(0, 60);
  for (const line of (p.text ?? '').split(/\r?\n/)) {
    const s = line.trim();
    if (s && !isUrl(s)) return s.slice(0, 60);
  }
  return null;
}

/** The shared link, if any — from `url`, else the first URL token found in the text or title. Kept for display only. */
export function sharedUrl(p: SharedParams): string | null {
  if (p.url && isUrl(p.url)) return p.url.trim();
  for (const tok of `${p.text ?? ''} ${p.title ?? ''}`.split(/\s+/)) if (isUrl(tok)) return tok.trim();
  return null;
}

/** Reads a share payload from a URL's query string (what the GET share target delivers). */
export function sharedParamsFromSearch(search: string): SharedParams {
  const q = new URLSearchParams(search);
  return { title: q.get('title'), text: q.get('text'), url: q.get('url') };
}

/** Lines that are only a map-app name, not the place (so they are skipped when reading a pasted share). */
const MAP_APP_LABEL = /^(카카오\s*맵|네이버\s*지도|구글\s*지도|티맵|naver\s*map|kakao\s*map|google\s*maps|tmap)$/i;

/**
 * Pulls a place name (and any link) out of text copied from a map app's "share → copy", so the user can paste it on
 * any device — not only the installed PWA that the GET share target needs. Handles the common Naver/Kakao shapes:
 * "이름\nhttps://naver.me/…", "[카카오맵] 이름 http://kko.kl/…", a bare "이름 https://…" line, and app-label header
 * lines. URLs are stripped out of the name; the link is kept for display only. Coordinates are still resolved by the
 * existing Kakao keyword search (no provider URL is fetched — that would need an external call and break the CSP).
 */
export function parsePastedPlace(text: string): { term: string | null; url: string | null } {
  const urlMatch = text.match(/https?:\/\/\S+/);
  const url = urlMatch ? urlMatch[0].trim() : null;
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  for (const line of lines) {
    const cleaned = line.replace(/^\[[^\]]*\]\s*/, '').trim(); // drop a leading "[카카오맵]" etc.
    if (!cleaned || MAP_APP_LABEL.test(cleaned)) continue;
    return { term: cleaned.slice(0, 60), url };
  }
  return { term: null, url };
}
