import { CloseIcon } from './shell/icons';
import { t } from '../lib/i18n';
import './snackbar.css';

/**
 * A dark snackbar with 되돌리기 (M36 editor, shared M52): what just happened, the undo, and a close. `above` sets where it
 * floats: over the editor's bottom action or over the tab bar. Callers keep it inside an always-present role="status"
 * region so it is announced when it appears.
 */
export function UndoSnackbar({ text, onUndo, onClose, above = 'cta' }: { text: string; onUndo: () => void; onClose: () => void; above?: 'cta' | 'tab' }) {
  return (
    <div className={`tl-snack${above === 'tab' ? ' is-tab' : ''}`}>
      <span className="tl-snack-text">{text}</span>
      <button type="button" className="tl-snack-action" onClick={onUndo}>
        {t('tl.undo')}
      </button>
      <button type="button" className="tl-snack-close" aria-label={t('common.close')} onClick={onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}
