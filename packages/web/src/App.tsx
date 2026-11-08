import { AddSharedPlacePage } from './pages/AddSharedPlacePage';
import { ConnectPage } from './pages/ConnectPage';
import { HomePage } from './pages/HomePage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TripEditorPage } from './pages/TripEditorPage';
import { usePath } from './lib/router';

export default function App() {
  const path = usePath();
  if (path === '/c') return <ConnectPage />;
  if (path === '/privacy') return <PrivacyPage />;
  if (path === '/add') return <AddSharedPlacePage />;
  // Keyed by trip so moving between trips (duplicate, save of a new trip) starts the editor fresh: no unsaved flag,
  // banners, open dialog or travel-time memory carried over from the previous trip.
  if (path === '/trips/new') return <TripEditorPage key="new" tripId={null} />;
  const m = path.match(/^\/trips\/([0-9a-f-]{36})$/);
  if (m) return <TripEditorPage key={m[1]} tripId={m[1]} />;
  return <HomePage />;
}
