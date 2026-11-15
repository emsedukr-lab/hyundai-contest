import { Button } from '@astryxdesign/core/Button';
import { minutesLabel } from '../lib/format';
import { t } from '../lib/i18n';

/**
 * 더 빠른 순서: under a day's heading when Kakao's driving times confirm a reorder saves 10+ minutes without making
 * a fixed time late. Two lines (what it saves, the new order) and two actions; [바꾸기] can be undone from the snackbar.
 */
export function FasterOrderCard({ dayIndex, saved, names, onApply, onDismiss }: { dayIndex: number; saved: number; names: string[]; onApply: () => void; onDismiss: () => void }) {
  const title = t('tl.faster.title', { time: minutesLabel(saved) });
  return (
    <div className="tn-pad">
      <div className="tl-faster" role="group" aria-label={`${t('common.day', { day: dayIndex })} · ${title}`}>
        <p className="tl-faster-title">{title}</p>
        <p className="tl-faster-order">{names.map((n, i) => `${i + 1} ${n}`).join(' → ')}</p>
        <div className="tl-faster-actions">
          <Button label={t('tl.faster.dismiss')} variant="secondary" size="sm" onClick={onDismiss} />
          <Button label={t('tl.faster.apply')} variant="primary" size="sm" onClick={onApply} />
        </div>
      </div>
    </div>
  );
}
