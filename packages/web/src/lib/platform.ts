/**
 * Where this build runs. The same screens ship twice: as the mobile web (served by the relay, so the API is on the
 * page's own origin) and inside the phone app (`vite build --mode app`, packages/mobile), whose pages are served from
 * inside the app and reach the relay at its deployed address. Both values are fixed at build time; the web build sets
 * neither, so nothing here changes how the web behaves.
 */
const API_ORIGIN: string = import.meta.env.VITE_API_ORIGIN ?? '';

/** True only in the phone app build. */
export const isNativeApp: boolean = import.meta.env.VITE_APP_SHELL === '1';

/** The relay's origin: the one a car QR points at. On the web that is the page's own origin. */
export const SERVER_ORIGIN: string = API_ORIGIN || location.origin;

/** `/api/v1/…` → the address to fetch. Unchanged on the web. */
export const apiUrl = (path: string): string => `${API_ORIGIN}${path}`;
