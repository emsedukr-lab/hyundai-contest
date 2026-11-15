import { useEffect, useRef } from 'react';
import { useToast } from '@astryxdesign/core/Toast';
import type { BannerProps } from '@astryxdesign/core/Banner';
import { CloseIcon } from './shell/icons';
import { t } from '../lib/i18n';
import './toastNotice.css';

/** Declarative notifications share the same toast queue, including inside bottom sheets. */
export function ToastNotice({ title, description, status, endContent, onDismiss, dismissLabel }: Pick<BannerProps, 'title' | 'description' | 'status' | 'endContent' | 'onDismiss' | 'dismissLabel' | 'isDismissable'>) {
  const show = useToast();
  const latest = useRef({ endContent, onDismiss });
  latest.current = { endContent, onDismiss };
  useEffect(() => {
    let active = true;
    const dismiss = show({
      body: <div className="nt-message"><div>{title}</div>{description && <div className="nt-description">{description}</div>}</div>,
      type: status === 'error' ? 'error' : 'info',
      isAutoHide: true,
      autoHideDuration: endContent || status === 'error' ? 8000 : 5000,
      endContent: latest.current.endContent,
      renderContent: ({ body, endContent: action, dismiss: close }) => <div className="nt-content">{body}{action}<button type="button" className="tn-iconbtn" aria-label={dismissLabel ?? (typeof title === 'string' ? `${title} · ${t('common.close')}` : t('common.close'))} onClick={close}><CloseIcon /></button></div>,
      onHide: () => { if (active) latest.current.onDismiss?.(); },
    });
    return () => { active = false; dismiss(); };
    // Callback identity changes must not restart the toast timer on each parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, title, description, status]);
  return null;
}
