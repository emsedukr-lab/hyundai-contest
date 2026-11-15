import type { ReactNode } from 'react';
import { BottomSheet } from '@astryxdesign/core/BottomSheet';
import { CloseIcon } from '../components/shell/icons';
import { t } from '../lib/i18n';
import './timeline.css';

/**
 * The editor's bottom sheet: Astryx BottomSheet (focus trap, swipe/scrim/Escape dismissal, stacking) with the header
 * and footer it leaves to the caller — a title and close button on top, an optional action row kept in reach below.
 * Edits inside apply live, like the rest of the editor, so closing never loses anything. It rises only as far as its
 * content needs (`hug`, up to 92dvh); the add-place sheet stays `tall` for Astryx's keyboard handling.
 */
export function Sheet({
  isOpen,
  onClose,
  title,
  children,
  footer,
  height = 'hug',
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  height?: 'hug' | 'capped' | 'tall';
}) {
  return (
    <BottomSheet isOpen={isOpen} onOpenChange={(open) => !open && onClose()} label={title} height={height} padding={0}>
      <div className="tl-sheet-head">
        <h2>{title}</h2>
        <button type="button" className="tn-iconbtn" aria-label={t('common.close')} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className="tl-sheet-body">{children}</div>
      {footer && <div className="tl-sheet-foot">{footer}</div>}
    </BottomSheet>
  );
}
