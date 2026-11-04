import { createRoot } from 'react-dom/client';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import { Theme } from '@astryxdesign/core/theme';
import { defaultThemeSlug, themes } from './astryx-themes';
import App from './App';
import { requestPersistence } from './lib/db';

void requestPersistence();
const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
createRoot(document.getElementById('root')!).render(
  <Theme theme={themes[defaultThemeSlug]} mode={dark ? 'dark' : 'light'}>
    <App />
  </Theme>,
);
