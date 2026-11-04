import { PROTOCOL, b64url, fromB64url, sha256, timingSafeEqual, utf8, type ErrorCode } from '@tteonaljido/shared';

export const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS, ...extra } });

export const error = (code: ErrorCode) => json({ error: code }, PROTOCOL.errors[code]);

export const bearer = (req: Request) => {
  const h = req.headers.get('Authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

export const hashSecret = async (s: string) => b64url(await sha256(utf8(s)));

export async function matchesHash(secret: string | null, hash: string | null): Promise<boolean> {
  if (!secret || !hash) return false;
  return timingSafeEqual(fromB64url(await hashSecret(secret)), fromB64url(hash));
}

/** Reads a JSON body with a hard byte cap (the payload limit plus envelope). */
export async function readJson<T>(req: Request, maxBytes: number): Promise<T | 'TOO_LARGE' | null> {
  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (declared > maxBytes) return 'TOO_LARGE';
  const text = await req.text();
  if (utf8(text).length > maxBytes) return 'TOO_LARGE';
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export const isB64url = (s: unknown, min = 1, max = 200_000): s is string => typeof s === 'string' && s.length >= min && s.length <= max && /^[A-Za-z0-9_-]+$/.test(s);
