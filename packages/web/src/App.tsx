import { AddSharedPlacePage } from './pages/AddSharedPlacePage';
import { CarPage } from './pages/CarPage';
import { ConnectPage } from './pages/ConnectPage';
import { HomePage } from './pages/HomePage';
import { MorePage } from './pages/MorePage';
import { PlacesPage } from './pages/PlacesPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TripEditorPage } from './pages/TripEditorPage';
import { usePath } from './lib/router';

/**
 * Two kinds of screen (toss.md menu structure): four tab roots that share the floating tab bar, and push screens
 * opened from them (editor, share landing, car pairing, privacy) with a back button and at most one bottom CTA.
 */
export default function App() {
  const path = usePath();

  // Push screens. The share target (/add) and the car QR (/c#…) land here directly.
  if (path === '/c') return <ConnectPage />;
  if (path === '/privacy') return <PrivacyPage />;
  if (path === '/add') return <AddSharedPlacePage />;
  // Keyed by trip so moving between trips (duplicate, save of a new trip) starts the editor fresh: no unsaved flag,
  // banners, open dialog or travel-time memory carried over from the previous trip.
  if (path === '/trips/new') return <TripEditorPage key="new" tripId={null} />;
  const m = path.match(/^\/trips\/([0-9a-f-]{36})$/);
  if (m) return <TripEditorPage key={m[1]} tripId={m[1]} />;

  // Tab roots.
  if (path === '/places') return <PlacesPage />;
  if (path === '/car') return <CarPage />;
  if (path === '/more') return <MorePage />;
  return <HomePage />;
}
