/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Kakao Maps JavaScript key (public, but domain-restricted in the Kakao console). When set at build time the editor
   * shows a real Kakao map; when empty the app falls back to the no-key SVG route sketch. This is a browser key, not
   * the server-only REST key (`KAKAO_REST_KEY`, kept as a Worker secret for place search).
   */
  readonly VITE_KAKAO_JS_KEY?: string;
  /** Phone app build only (`vite build --mode app`): the deployed relay origin. Unset on the web (same origin). */
  readonly VITE_API_ORIGIN?: string;
  /** '1' in the phone app build, unset on the web. */
  readonly VITE_APP_SHELL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
