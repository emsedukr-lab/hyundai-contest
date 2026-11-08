import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import type { Home, Trip } from '@tteonaljido/shared';
import { t } from '../../lib/i18n';
import { navigate } from '../../lib/router';
import { planWarnings } from '../../lib/trips';
import { KakaoMap } from '../KakaoMap';
import { Sheet } from '../Sheet';

const hasOpenConnection = () => {
  try {
    return !!sessionStorage.getItem('tteonaljido.lastSid');
  } catch {
    return false;
  }
};

/**
 * The route on a map, per day. As 'send' (the saved trip's bottom button) it adds what to fix first and how a send
 * starts — always from the car's QR, so the phone shows the steps instead of a send button.
 */
export function SendSheet({ isOpen, onClose, plan, home, dayIndex, mode }: { isOpen: boolean; onClose: () => void; plan: Trip; home: Home | null; dayIndex: number; mode: 'send' | 'map' }) {
  const [day, setDay] = useState(String(dayIndex));
  const [resumable] = useState(hasOpenConnection);
  const shown = plan.days.find((d) => String(d.dayIndex) === day)?.dayIndex ?? plan.days[0].dayIndex;
  const checks = mode === 'send' ? planWarnings(plan, home).filter((w) => w.level === 'warning') : [];
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={mode === 'send' ? t('tl.sendTitle') : t('tl.mapTitle')} height="tall">
      {plan.days.length > 1 && (
        <div className="tl-daytabs">
          <TabList role="tablist" aria-label={t('days.title')} value={String(shown)} onChange={setDay} hasDivider>
            {plan.days.map((d) => (
              <Tab key={d.dayIndex} value={String(d.dayIndex)} panelId="send-map" label={t('common.day', { day: d.dayIndex })} />
            ))}
          </TabList>
        </div>
      )}
      <div id="send-map" role="tabpanel" aria-label={t('common.day', { day: shown })}>
        <KakaoMap plan={plan} home={home} dayIndex={shown} />
      </div>
      {mode === 'send' && (
        <>
          {checks.length > 0 && (
            <>
              <h3 className="tl-sheet-section">{t('tl.sendChecks')}</h3>
              <ul className="tl-steps" style={{ listStyle: 'disc' }}>
                {checks.map((w) => (
                  <li key={w.text} className="tl-warn-text" style={{ fontSize: 14 }}>
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
