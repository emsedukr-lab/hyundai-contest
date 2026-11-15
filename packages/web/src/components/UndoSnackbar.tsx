import { Button } from '@astryxdesign/core/Button';
import { ToastNotice } from './ToastNotice';
import { t } from '../lib/i18n';

export function UndoSnackbar({ text, onUndo, onClose }: { text: string; onUndo: () => void; onClose: () => void; above?: 'cta' | 'tab' }) {
  return <ToastNotice status="info" title={text} onDismiss={onClose}
    endContent={<Button label={t('tl.undo')} variant="secondary" size="sm" onClick={onUndo} />} />;
}
