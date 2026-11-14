/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    kakao?: any;
  }
}

/** Kakao Maps JavaScript key (public, domain-restricted). Set at build time; empty → map features fall back to no-map UI. */
export const JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY;

let sdk: Promise<any> | null = null;

/**
 * Loads the Kakao Maps JS SDK once, shared by every map view. The SDK pulls from dapi.kakao.com then *.kakaocdn.net,
 * which the deployed CSP allows. Rejects if it can't load (callers fall back to the no-map UI).
 */
export function loadKakao(key: string): Promise<any> {
  // `kakao.maps` exists as soon as sdk.js runs; only `maps.LatLng` says the map code itself has loaded.
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao);
  sdk ??= new Promise<any>((resolve, reject) => {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    s.onload = () => (window.kakao ? window.kakao.maps.load(() => resolve(window.kakao)) : reject(new Error('kakao missing')));
    s.onerror = () => {
      sdk = null; // let a later mount retry
      reject(new Error('kakao sdk load failed'));
    };
    document.head.appendChild(s);
  });
  return sdk;
}

/** Escapes text for use inside an InfoWindow/overlay HTML string. */
export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * A numbered map pin for a Kakao CustomOverlay: the route's number circle (design/TOSS.md §5 지도) — accent with a
 * white number and a white ring, shadow-1 — from the role tokens in shell.css. Kakao's tiles are always light, so the
 * pin resolves the roles in their light values (color-scheme: light) in both themes. `title` is set as a DOM
 * property, never parsed as HTML.
 */
export function numberPin(n: number, title: string, clickable = false): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = String(n);
  el.title = title;
  el.setAttribute(
    'style',
    'color-scheme:light;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;' +
      'background:var(--tn-accent);color:var(--tn-on-accent);font-weight:700;font-size:12px;line-height:1;font-variant-numeric:tabular-nums;' +
      `border:2px solid var(--tn-surface);box-shadow:var(--tn-shadow-1)${clickable ? ';cursor:pointer' : ''}`,
  );
  return el;
}
