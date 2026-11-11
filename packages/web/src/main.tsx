import { createRoot } from 'react-dom/client';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import './pleos.css'; // Pleos 모바일 테마(빌드 산출) — astryx.css 뒤에서 토큰·컴포넌트 오버라이드
import './fonts.css'; // Asta Sans self-host @font-face
import './components/shell/shell.css'; // app shell: top bar, floating tab bar, bottom CTA, list rows
import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import koKR from '@astryxdesign/core/locales/ko-KR.generated.js';
import { Theme } from '@astryxdesign/core/theme';
import { pleosTheme } from './pleos';
import App from './App';
import { requestPersistence } from './lib/db';
import { lang } from './lib/i18n';

void requestPersistence();
// Phone app build only; the condition is a build-time constant, so the web bundle carries none of this.
if (import.meta.env.VITE_APP_SHELL === '1') void import('./lib/nativeShell').then((m) => m.startNativeShell());
document.documentElement.lang = lang;
const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
// Astryx's own strings and date/time formats ("Required", "Nov 20", "8:00 AM") follow this locale; English is built in.
const astryxLocale = lang === 'ko' ? 'ko-KR' : 'en';
createRoot(document.getElementById('root')!).render(
  <InternationalizationProvider locale={astryxLocale} messages={lang === 'ko' ? { 'ko-KR': koKR } : undefined}>
    <Theme theme={pleosTheme} mode={dark ? 'dark' : 'light'}>
      <App />
    </Theme>
  </InternationalizationProvider>,
);
