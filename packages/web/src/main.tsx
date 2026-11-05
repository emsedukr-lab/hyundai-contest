import { createRoot } from 'react-dom/client';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import koKR from '@astryxdesign/core/locales/ko-KR.generated.js';
import { Theme } from '@astryxdesign/core/theme';
import { defaultThemeSlug, themes } from './astryx-themes';
import App from './App';
import { requestPersistence } from './lib/db';
import { lang } from './lib/i18n';

void requestPersistence();
document.documentElement.lang = lang;
const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
// Astryx's own strings and date/time formats ("Required", "Nov 20", "8:00 AM") follow this locale; English is built in.
const astryxLocale = lang === 'ko' ? 'ko-KR' : 'en';
createRoot(document.getElementById('root')!).render(
  <InternationalizationProvider locale={astryxLocale} messages={lang === 'ko' ? { 'ko-KR': koKR } : undefined}>
    <Theme theme={themes[defaultThemeSlug]} mode={dark ? 'dark' : 'light'}>
      <App />
    </Theme>
  </InternationalizationProvider>,
);
