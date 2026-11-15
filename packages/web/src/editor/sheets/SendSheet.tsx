import { lazy, Suspense, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import type { Home, Trip } from '@tteonaljido/shared';
import { shortDate } from '../../lib/format';
import { t } from '../../lib/i18n';
import { navigate } from '../../lib/router';
import { planWarnings } from '../../lib/trips';
import { Sheet } from '../Sheet';
import { useNotes } from '../NotesContext';

// The map brings the Kakao SDK loader with it: fetched when a map sheet first opens.
const KakaoMap = lazy(() => import('../KakaoMap').then((m) => ({ default: m.KakaoMap })));

const hasOpenConnection = () => {
  try {
    return !!sessionStorage.getItem('tteonaljido.lastSid');
  } catch {
    return false;
  }
};

/**
 * The route on a map, per day. As 'send' (the trip's bottom button) it adds what to fix first, how a send goes, and
 * the action that starts it: 카메라로 차량 QR 스캔 — a send always begins at the car's QR, and `onScan` opens the
 * scanner with this trip remembered for the pairing page. One quiet line says what the handover does with the data.
 */
export function SendSheet({
  isOpen,
  onClose,
  plan,
  home,
  dayIndex,
  mode,
  onScan,
}: {
  isOpen: boolean;
  onClose: () => void;
  plan: Trip;
  home: Home | null;
  dayIndex: number;
  mode: 'send' | 'map';
  /** 'send' only: start scanning the car's QR for this trip. */
  onScan?: () => void;
}) {
  const { lodgingTbd } = useNotes();
  const [day, setDay] = useState(String(dayIndex));
  const [resumable] = useState(hasOpenConnection);
  const shown = plan.days.find((d) => String(d.dayIndex) === day)?.dayIndex ?? plan.days[0].dayIndex;
  const checks = mode === 'send' ? planWarnings(plan, home, lodgingTbd).filter((w) => w.level === 'warning') : [];
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'send' ? t('tl.sendTitle') : t('tl.mapTitle')}
      footer={mode === 'send' && onScan ? <Button label={t('car.scan')} variant="primary" size="lg" width="100%" onClick={onScan} /> : undefined}>
      {mode === 'send' && <p className="tl-sheet-hint">{t('car.sending', { name: plan.name })}</p>}
      {plan.days.length > 1 && (
        // A day picker, not a tab strip: no sideways scroll button to cover a day's name on long trips.
        <Selector
          label={t('days.title')}
          isLabelHidden
          placement="below"
          options={plan.days.map((d) => ({ value: String(d.dayIndex), label: `${t('common.day', { day: d.dayIndex })} · ${shortDate(d.date)}` }))}
          value={String(shown)}
          onChange={setDay}
        />
      )}
      {/* The map's box is reserved while its code loads, so the sheet does not jump. */}
      <Suspense fallback={<div className="tl-map-wait" />}>
        <KakaoMap plan={plan} home={home} dayIndex={shown} />
      </Suspense>
      {mode === 'send' && (
        <>
          {checks.length > 0 && (
            <>
              <h3 className="tl-sheet-section">{t('tl.sendChecks')}</h3>
              <ul className="tl-steps" style={{ listStyle: 'disc' }}>
                {checks.map((w) => (
                  <li key={w.text} className="tl-warn-text" style={{ fontSize: 13 }}>
                    {w.text}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3 className="tl-sheet-section">{t('tl.sendHow')}</h3>
          <ol className="tl-steps">
            <li>{t('car.step1')}</li>
            <li>{t('car.step2')}</li>
            <li>{t('car.step3')}</li>
          </ol>
          <p className="tl-sheet-note">{t('tl.sendAssure')}</p>
          {resumable && (
            <div>
              <Button label={t('car.resume')} variant="secondary" size="md" onClick={() => navigate('/c')} />
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
