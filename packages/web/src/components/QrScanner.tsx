import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { t } from '../lib/i18n';
import { CloseIcon } from './shell/icons';
import { ToastNotice } from './ToastNotice';

type Status = 'starting' | 'scanning' | 'denied' | 'nodevice' | 'unsupported' | 'error';

/**
 * Full-screen camera scanner for the car's QR (연결 tab). Opening it asks the browser for camera permission
 * (`getUserMedia`, rear camera preferred); frames are read on this phone with jsQR about every 150 ms and never stored
 * or sent. `onResult` says whether a read QR was the right one: true closes the flow, false shows a hint and keeps
 * scanning. Closing or leaving always stops every camera track.
 */
export function QrScanner({ onResult, onClose, tripName }: { onResult: (text: string) => boolean; onClose: () => void; tripName?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  const [status, setStatus] = useState<Status>('starting');
  const [hint, setHint] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    let lastWrong = '';
    setStatus('starting');
    void (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return setStatus('unsupported');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (e) {
        const name = (e as DOMException).name;
        return setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nodevice' : 'error');
      }
      if (stopped) return stream.getTracks().forEach((tr) => tr.stop());
      const v = video.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play().catch(() => undefined);
      setStatus('scanning');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const tick = () => {
        if (stopped || !ctx) return;
        if (v.readyState >= 2 && v.videoWidth) {
          // Read a reduced copy (≤640px): quick on a phone, still plenty for the car's large QR.
          const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
          canvas.width = Math.round(v.videoWidth * scale);
          canvas.height = Math.round(v.videoHeight * scale);
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
          if (code?.data) {
            if (resultRef.current(code.data)) {
              navigator.vibrate?.(60);
              return; // the page moves on; cleanup stops the camera
            }
            if (code.data !== lastWrong) {
              lastWrong = code.data;
              setHint(t('scan.notCar'));
            }
          }
        }
        timer = window.setTimeout(tick, 150);
      };
      tick();
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [attempt]);

  const message =
    status === 'starting'
      ? t('scan.starting')
      : status === 'denied'
        ? t('scan.denied')
        : status === 'nodevice'
          ? t('scan.noDevice')
          : status === 'unsupported'
            ? t('scan.unsupported')
            : status === 'error'
              ? t('scan.error')
              : (hint ?? t('scan.aim'));
  const failed = status === 'denied' || status === 'nodevice' || status === 'unsupported' || status === 'error';

  return (
    <div className="tn-scan" role="dialog" aria-modal="true" aria-label={t('scan.title')}>
      <video ref={video} className="tn-scan-video" playsInline muted autoPlay aria-hidden="true" />
      <div className="tn-scan-top">
        <span className="tn-scan-title">{t('scan.title')}</span>
        <button ref={closeBtn} type="button" className="tn-scan-close" aria-label={t('common.close')} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      {!failed && <div className="tn-scan-frame" aria-hidden="true" />}
      <div className="tn-scan-bottom">
        {tripName && <p className="tn-scan-msg">{t('car.sending', { name: tripName })}</p>}
        {failed && <p className="tn-scan-msg">{t('car.cameraHelp.detail')}</p>}
        {(failed || hint) && <ToastNotice status={failed ? 'error' : 'warning'} title={message} onDismiss={() => { if (!failed) setHint(null); }} />}
        {!failed && <p className="tn-scan-msg" role="status" aria-live="polite">
          {status === 'starting' ? t('scan.starting') : t('scan.aim')}
        </p>}
        {failed && status !== 'unsupported' && (
          <button type="button" className="tn-scan-retry" onClick={() => setAttempt((a) => a + 1)}>
            {t('scan.retry')}
          </button>
        )}
      </div>
    </div>
  );
}
