import type { ReactNode } from 'react';
import { t } from '../../lib/i18n';
import { BackIcon } from './icons';

/**
 * toss.md top-app-bar on Pleos tokens: 56pt, sticky, left-aligned title, optional back button and up to two actions.
 * The title is the screen's one `<h1>`; `large` is the tab-root variant (22/700) — push screens use 17/600.
 */
export function TopBar({ title, onBack, actions, large }: { title: ReactNode; onBack?: () => void; actions?: ReactNode; large?: boolean }) {
  return (
    <header className={`tn-topbar${large ? ' is-large' : ''}${onBack ? ' has-back' : ''}`}>
      {onBack && (
        <button type="button" className="tn-iconbtn" aria-label={t('common.back')} onClick={onBack}>
          <BackIcon />
        </button>
      )}
      <h1>{title}</h1>
      {actions && <div className="tn-actions">{actions}</div>}
    </header>
  );
}
