import type { ReactNode } from 'react';
import { t } from '../../lib/i18n';
import { BackIcon } from './icons';

/**
 * Pleos page navigation at phone scale: 56pt, sticky on the canvas, left-aligned title, optional back button and up to
 * two actions. The title is the screen's one `<h1>`; `large` is the tab-root variant (Title L 24/700), push screens 18/700.
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
