import { Button } from '@astryxdesign/core/Button';
import { minutesLabel, timeLabel } from '../lib/format';
import { t } from '../lib/i18n';
import type { LaterStart } from '../lib/laterStart';

/**
 * 늦게 출발하기: under a day's heading when the day reaches its first fixed time with an hour or more to spare
 * (`lib/laterStart.ts`). Two lines — the later departure, then why it works and what bounds it (the lodging's check-out,
 * said to be the usual time when the traveller has not entered one) — and the same two actions as 더 빠른 순서.
 */
export function LaterStartCard({ s, name, onApply, onDismiss }: { s: LaterStart; name: string; onApply: () => void; onDismiss: () => void }) {
  const title = t('tl.later.title', { time: timeLabel(s.to) });
  const why = t('tl.later.detail', { name, fixed: timeLabel(s.fixedTime), spare: minutesLabel(s.spareBefore) });
  const bound = s.checkOut ? t(s.checkOut.assumed ? 'tl.later.checkoutAssumed' : 'tl.later.checkout', { time: timeLabel(s.checkOut.time) }) : null;
  return (
    <div className="tn-pad">
      <div className="tl-faster" role="group" aria-label={`${t('common.day', { day: s.dayIndex })} · ${title}`}>
        <p className="tl-faster-title">{title}</p>
        <p className="tl-faster-order is-wrap">{bound ? `${why} · ${bound}` : why}</p>
        <div className="tl-faster-actions">
          <Button label={t('tl.faster.dismiss')} variant="secondary" size="sm" onClick={onDismiss} />
          <Button label={t('tl.later.apply', { time: timeLabel(s.to) })} variant="primary" size="sm" onClick={onApply} />
        </div>
      </div>
    </div>
  );
}
