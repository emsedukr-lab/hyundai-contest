import { parseQrFragment } from '@tteonaljido/shared';

/**
 * What the in-app scanner may open: only this app's own car QR (`<origin>/c#v1.<sid>.<secret>.<fingerprint>`), as the
 * in-app path `/c#…`. Anything else — another site, a plain text QR, a malformed link — is null, so a stray QR can
 * never send the phone somewhere else.
 */
export function carQrTarget(text: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.origin !== origin || url.pathname !== '/c' || !parseQrFragment(url.hash)) return null;
  return `/c${url.hash}`;
}
