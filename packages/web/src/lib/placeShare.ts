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

/**
 * The best place-name search term from a share payload: the title, else the first usable line of the text. Each
 * candidate goes through the same clean-up as a paste (URLs, "[카카오맵]" prefixes, app-name-only and address lines
 * dropped), because the result is added automatically and a junk name would travel to the car as the place name.
 */
export function sharedPlaceTerm(p: SharedParams): string | null {
  for (const line of [p.title ?? '', ...(p.text ?? '').split(/\r?\n/)]) {
    const name = placeName(line);
    if (name) return name.slice(0, 60);
  }
  return null;
}

/** The shared link, if any — from `url`, else the first URL token found in the text or title. Kept for display only. */
export function sharedUrl(p: SharedParams): string | null {
  if (p.url && isUrl(p.url)) return p.url.trim();
  for (const tok of `${p.text ?? ''} ${p.title ?? ''}`.split(/\s+/)) if (isUrl(tok)) return tok.trim();
  return null;
}

/**
 * Every link in a text, in order, once each. Punctuation that only follows a link ("…/abc, " when several shares are
 * typed in a row) is not part of it.
 */
export function pastedLinks(text: string): string[] {
  const found = (text.match(/https?:\/\/\S+/gi) ?? []).map((u) => u.replace(/[,.;:!?)\]}'"]+$/, ''));
  return [...new Set(found)];
}

/** A Naver Map short link (`https://naver.me/…`) exactly, or null. */
function naverShortLink(value: string): string | null {
  if (!value.startsWith('https://naver.me/')) return null;
  try {
    const url = new URL(value);
    return url.hostname === 'naver.me' && url.pathname.length > 1 && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/** A link the server may be asked about: https on naver.me or a naver.com host. */
export function isNaverLink(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return u.protocol === 'https:' && !u.username && !u.password && (host === 'naver.me' || host === 'naver.com' || host.endsWith('.naver.com'));
  } catch {
    return false;
  }
}

/**
 * What the clipboard holds when it is a Naver Map share, ready for the paste reader — or null. Two shapes are taken:
 * the bare short link (what the PC site copies) and the whole text the phone app copies, e.g.
 * "[네이버지도]\n대구\nhttps://naver.me/…" — a header, a place or saved-list name, perhaps an address, and the link.
 * The whole of it is kept (each line trimmed, the link last) so the name beside the link is read too. Anything else on
 * the clipboard — another site's link, several links, long text that merely mentions a link — is left alone, so
 * unrelated copied text is never read into the app.
 */
export function naverShareText(text: string): string | null {
  const links = text.match(/https?:\/\/\S+/gi) ?? [];
  if (links.length !== 1) return null;
  const url = naverShortLink(pastedLinks(links[0])[0] ?? '');
  if (!url) return null;
  const lines = text
    .replace(links[0], '\n')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (lines.length > 4 || lines.some((l) => l.length > 120)) return null;
  return [...lines, url].join('\n');
}

/**
 * A Kakao Map share link (kko.to, place.map.kakao.com, map.kakao.com …). Places are not imported from Kakao Map shares
 * (decided 2026-11-15: map-app sharing is Naver Map only), so such a link is recognised here and never sent anywhere.
 */
export function isKakaoLink(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host === 'kko.to' || host === 'kakao.com' || host.endsWith('.kakao.com');
  } catch {
    return false;
  }
}

/** Reads a share payload from a URL's query string (what the GET share target delivers). */
export function sharedParamsFromSearch(search: string): SharedParams {
  const q = new URLSearchParams(search);
  return { title: q.get('title'), text: q.get('text'), url: q.get('url') };
}

/** Lines that are only a map-app name, not the place (so they are skipped when reading a pasted share). */
const MAP_APP_LABEL = /^(카카오\s*맵|네이버\s*지도|구글\s*지도|티맵|naver\s*map|kakao\s*map|google\s*maps|tmap)$/i;

/** Strips a pasted line down to a bare place name: drop URLs, a leading number/bullet, a leading "[카카오맵]", extra spaces. */
function cleanLine(line: string): string {
  return line
    .replace(/https?:\/\/\S+/g, ' ') // drop URLs
    .replace(/\s+/g, ' ')
    .trim() // before the markers below, so what follows a dropped URL ("https://… [네이버지도]") still starts the line
    .replace(/^(?:\d+[.)]|[-•*·,])\s*/, '') // drop a leading "1." / "2)" / "- " / "• " list marker (or a stray comma)
    .replace(/^\[[^\]]*\]\s*/, '') // drop a leading "[카카오맵]" / "[네이버지도]" etc.
    .trim();
}

const PROVINCE = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|충청|전북|전남|전라|경북|경남|경상|제주)\S*\s/;

/**
 * A line that reads like a Korean street/lot address ("강원 강릉시 저동 94", "서울 중구 세종대로 110"): it starts with a
 * province, has a 시/군/구 word, and has a standalone number. Map apps put this under the name in shared text; treating
 * it as a second place would make bulk add search the address and pick an unrelated spot. Names that merely start with
 * a region ("부산 해운대 블루라인파크", "제주 4.3평화공원", "광주 서구 1913송정역시장") are kept.
 */
export function isAddressLine(s: string): boolean {
  return PROVINCE.test(s) && /\s\S+(시|군|구)(?=\s|$)/.test(s) && /(^|\s)\d+(-\d+)?(?=\s|$)/.test(s);
}

/** A cleaned place name from one line, or '' when the line is empty, an app label, or an address. */
function placeName(line: string): string {
  const cleaned = cleanLine(line);
  return !cleaned || MAP_APP_LABEL.test(cleaned) || isAddressLine(cleaned) ? '' : cleaned;
}

/**
 * Pulls a place name (and any link) out of text copied from a map app's "share → copy", so the user can paste it on
 * any device — not only the installed PWA that the GET share target needs. Handles the common Naver/Kakao shapes:
 * "이름\nhttps://naver.me/…", "[카카오맵] 이름 http://kko.kl/…", a bare "이름 https://…" line, and app-label header
 * lines. URLs are stripped out of the name; the link is kept for display only. Coordinates are still resolved by the
 * existing Kakao keyword search (no provider URL is fetched — that would need an external call and break the CSP).
 */
export function parsePastedPlace(text: string): { term: string | null; url: string | null } {
  const url = pastedLinks(text)[0] ?? null;
  for (const line of text.split(/\r?\n/)) {
    const name = placeName(line);
    if (name) return { term: name.slice(0, 60), url };
  }
  return { term: null, url };
}

/**
 * Pulls MANY place names out of a pasted list — one per line — so the user can paste a whole itinerary and search each.
 * Reuses {@link cleanLine} (URLs, list markers and app labels stripped), skips app-label-only lines, removes
 * case-insensitive duplicates, and caps the count so a huge paste can't blow past the search rate limit.
 */
export function parsePastedPlaces(text: string, max = 30): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const name = placeName(line);
    if (!name) continue;
    const term = name.slice(0, 60);
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= max) break;
  }
  return out;
}
