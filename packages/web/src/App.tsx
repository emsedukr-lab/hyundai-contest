import { ConnectPage } from './pages/ConnectPage';
import { HomePage } from './pages/HomePage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TripEditorPage } from './pages/TripEditorPage';
import { usePath } from './lib/router';

export default function App() {
  const path = usePath();
  if (path === '/c') return <ConnectPage />;
  if (path === '/privacy') return <PrivacyPage />;
  if (path === '/trips/new') return <TripEditorPage tripId={null} />;
  const m = path.match(/^\/trips\/([0-9a-f-]{36})$/);
  if (m) return <TripEditorPage tripId={m[1]} />;
  return <HomePage />;
}
