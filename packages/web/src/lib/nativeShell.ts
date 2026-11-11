import { App } from '@capacitor/app';
import { SERVER_ORIGIN } from './platform';
import { carQrTarget } from './qrLink';
import { navigate } from './router';

/**
 * Phone app only (loaded from main.tsx in the app build; the web build never includes this file).
 *
 * 1. Car QR opened from outside the app. The QR is the same link the web uses (`<relay>/c#v1.…`); when the phone's
 *    camera hands it to the app (Android App Link / iOS Universal Link), it is checked exactly like an in-app scan and
 *    opened as the in-app path. Anything else is ignored. The link is never logged or stored here.
 * 2. Android back button. Goes back through the app's screens; on the first screen it sends the app to the background
 *    instead of doing nothing.
 */
export async function startNativeShell() {
  let last: string | null = null;
  const open = (url: string) => {
    // A cold start can report the same link twice (launch URL + event). Opening it twice would leave the one-time
    // secret in the address after the connect screen has already read it.
    if (url === last) return;
    last = url;
    const target = carQrTarget(url, SERVER_ORIGIN);
    if (!target) return;
    if (location.pathname !== '/c') return navigate(target);
    // Already on the connect screen (it reads the link once, when it opens): leave and come back so the new QR is read.
    navigate('/car', true);
    setTimeout(() => navigate(target), 0);
  };

  await App.addListener('appUrlOpen', (e) => open(e.url));
  await App.addListener('backButton', ({ canGoBack }) => (canGoBack ? history.back() : void App.minimizeApp()));
  const launch = await App.getLaunchUrl();
  if (launch?.url) open(launch.url);
}
