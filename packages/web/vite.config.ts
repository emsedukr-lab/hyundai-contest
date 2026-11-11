import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/**
 * Two builds of the same screens:
 * - `vite build`            → dist/, the mobile web the relay serves (same origin as the API).
 * - `vite build --mode app` → ../mobile/www, the pages packed into the phone app (Capacitor). They are served from
 *   inside the app, so the relay address is fixed at build time and the page carries its own CSP (the web gets its
 *   CSP as response headers from public/_headers; an app page has no response headers).
 */

/** The deployed relay address lives in one place: the car app's prod origin. `TTEONALJIDO_ORIGIN` overrides it for a test server. */
function relayOrigin(): string {
  const fromEnv = process.env.TTEONALJIDO_ORIGIN;
  const value = fromEnv ?? readFileSync(new URL('../../car/gradle.properties', import.meta.url), 'utf8').match(/^tteonaljido\.prodOrigin=(\S+)\s*$/m)?.[1];
  if (!value) throw new Error('tteonaljido.prodOrigin is missing in car/gradle.properties');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value) throw new Error(`relay origin must be a bare https origin, got ${value}`);
  return value;
}

/** Same policy as public/_headers, plus the relay (cross-origin from inside the app). frame-ancestors has no meaning in a meta tag. */
const appCsp = (origin: string): Plugin => ({
  name: 'tteonaljido-app-csp',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      injectTo: 'head-prepend',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: [
          "default-src 'self'",
          "script-src 'self' https://dapi.kakao.com https://t1.kakaocdn.net",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https://*.kakaocdn.net https://dapi.kakao.com",
          "font-src 'self'",
          `connect-src 'self' ${origin} https://dapi.kakao.com https://*.kakaocdn.net`,
          "base-uri 'none'",
          "form-action 'none'",
        ].join('; '),
      },
    },
  ],
});

export default defineConfig(({ mode }) => {
  const shared = { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 1500 } as const;
  if (mode !== 'app') return { server: { proxy: { '/api': 'http://127.0.0.1:8787' } }, build: shared };
  const origin = relayOrigin();
  return {
    plugins: [appCsp(origin)],
    define: { 'import.meta.env.VITE_API_ORIGIN': JSON.stringify(origin), 'import.meta.env.VITE_APP_SHELL': JSON.stringify('1') },
    build: { ...shared, outDir: '../mobile/www', emptyOutDir: true },
  };
});
