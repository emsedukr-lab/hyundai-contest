/**
 * The car QR's fragment (`/c#v1.sid.scanSecret.fp`) on its way from the address bar to the pairing page.
 *
 * The secret must leave the address bar and the history entry the moment the app sees it, before anything is awaited
 * (CLAUDE.md 보안). The pairing page's code is loaded on demand (M66), so that moment can no longer be the page's own
 * first effect: the app shell calls {@link stashQrHash} synchronously when it routes to `/c`, and the page takes the
 * fragment from memory with {@link takeQrHash} when it starts. Held in this module only, handed out once.
 */
let held: string | null = null;

export function stashQrHash(): void {
  if (location.pathname !== '/c' || !location.hash) return;
  held = location.hash;
  history.replaceState(null, '', '/c');
}

export function takeQrHash(): string {
  stashQrHash();
  const hash = held ?? '';
  held = null;
  return hash;
}
