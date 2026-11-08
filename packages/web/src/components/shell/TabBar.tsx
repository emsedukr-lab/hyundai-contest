import type { ComponentType } from 'react';
import { t } from '../../lib/i18n';
import { navigate } from '../../lib/router';
import { CarIcon, GearIcon, MapIcon, PinIcon } from './icons';

type NavLabel = 'nav.trips' | 'nav.places' | 'nav.connect' | 'nav.settings';

/** The four destinations (toss.md tab-bar allows 2–5). Order = importance: trips first, settings last. */
export const TABS: Array<{ path: string; label: NavLabel; Icon: ComponentType<{ filled?: boolean }> }> = [
  { path: '/', label: 'nav.trips', Icon: MapIcon },
  { path: '/places', label: 'nav.places', Icon: PinIcon },
  { path: '/car', label: 'nav.connect', Icon: CarIcon }, // 연결: pairing with the car (address stays /car)
  { path: '/settings', label: 'nav.settings', Icon: GearIcon },
];

/**
 * Floating tab bar: real links (so long-press/open-in-new-tab work), `aria-current` on the active one. Switching tabs
 * replaces the history entry — tabs are siblings, not a stack — while screens opened from a tab push onto it.
 */
export function TabBar({ current }: { current: string }) {
  return (
    <nav className="tn-tabbar" aria-label={t('nav.label')}>
      <ul>
        {TABS.map(({ path, label, Icon }) => {
          const active = current === path;
          return (
            <li key={path}>
              <a
                className="tn-tab"
                href={path}
                aria-current={active ? 'page' : undefined}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let the browser open a new tab
                  e.preventDefault();
                  if (!active) navigate(path, true);
                }}>
                <Icon filled={active} />
                <span>{t(label)}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
