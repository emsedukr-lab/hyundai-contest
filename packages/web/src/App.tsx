import { lazy, Suspense, useEffect } from 'react';
import { CarPage } from './pages/CarPage';
import { HomePage } from './pages/HomePage';
import { PlacesPage } from './pages/PlacesPage';
import { SettingsPage } from './pages/SettingsPage';
import { t } from './lib/i18n';
import { stashQrHash } from './lib/qrArrival';
import { usePath } from './lib/router';
import { isPresetSlot } from './lib/settings';

// The four tab roots are in the first download, so switching tabs is instant. The screens pushed from them load when
// first opened (M66): the editor (timeline, sheets, drag and drop, the route engine), the pairing flow (crypto,
// schema checks) and the smaller landings. No service worker caches the app, so each is one more same-origin request
// under the existing CSP (`script-src 'self'`).
const editor = () => import('./pages/TripEditorPage');
const TripEditorPage = lazy(() => editor().then((m) => ({ default: m.TripEditorPage })));
const ConnectPage = lazy(() => import('./pages/ConnectPage').then((m) => ({ default: m.ConnectPage })));
const AddSharedPlacePage = lazy(() => import('./pages/AddSharedPlacePage').then((m) => ({ default: m.AddSharedPlacePage })));
const StartPlacePage = lazy(() => import('./pages/StartPlacePage').then((m) => ({ default: m.StartPlacePage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));

/** The browser tab's name for each screen ("여행 · 떠날지도"), so history and the task switcher say where one is. */
function titleFor(path: string): string {
  const name =
    path === '/c' ? t('connect.title')
    : path === '/privacy' ? t('privacy.title')
    : path === '/add' ? t('add.title')
    : path === '/trips/new' ? t('editor.titleNew')
    : path.startsWith('/trips/') ? t('editor.titleEdit')
    : path === '/places' ? t('nav.places')
    : path === '/car' ? t('nav.connect')
    : path.startsWith('/settings') || path === '/more' ? t('nav.settings')
    : t('nav.trips');
  return `${name} · ${t('home.title')}`;
}

/**
 * Two kinds of screen (toss.md menu structure): four tab roots that share the floating tab bar, and push screens
 * opened from them (editor, share landing, car pairing, privacy) with a back button and at most one bottom CTA.
 */
export default function App() {
  const path = usePath();
  useEffect(() => {
    document.title = titleFor(path);
  }, [path]);
  // The editor is where most visits go next: fetch its code once the first screen is up, so opening a trip does not wait.
  useEffect(() => {
    const id = window.setTimeout(() => void editor().catch(() => undefined), 1500);
    return () => window.clearTimeout(id);
  }, []);
  // While a pushed screen's code arrives the canvas stays as it is — no skeleton (design/TOSS.md).
  return <Suspense fallback={<span className="tn-route-wait" role="status" aria-label={t('common.loading')} />}>{screen(path)}</Suspense>;
}

function screen(path: string) {
  // Push screens. The share target (/add) and the car QR (/c#…) land here directly.
  // The QR's secret leaves the address bar here, synchronously, before the pairing page's code is fetched.
  if (path === '/c') stashQrHash();
  if (path === '/c') return <ConnectPage />;
  if (path === '/privacy') return <PrivacyPage />;
  // 설정 › 출발 장소 › 집·회사·즐겨찾기 1–3 ('/settings/home' was the home address's first address; keep it working).
  const slot = path === '/settings/home' ? 'home' : path.match(/^\/settings\/place\/([a-z0-9]+)$/)?.[1];
  if (slot && isPresetSlot(slot)) return <StartPlacePage key={slot} slot={slot} />;
  if (path === '/add') return <AddSharedPlacePage />;
  // Keyed by trip so moving between trips (duplicate, save of a new trip) starts the editor fresh: no unsaved flag,
  // banners, open dialog or travel-time memory carried over from the previous trip.
  if (path === '/trips/new') return <TripEditorPage key="new" tripId={null} />;
  const m = path.match(/^\/trips\/([0-9a-f-]{36})$/);
  if (m) return <TripEditorPage key={m[1]} tripId={m[1]} />;

  // Tab roots.
  if (path === '/places') return <PlacesPage />;
  if (path === '/car') return <CarPage />;
  // '/more' was this tab's first address; keep it working.
  if (path === '/settings' || path === '/more') return <SettingsPage />;
  return <HomePage />;
}
