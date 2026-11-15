import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import type { Trip } from '@tteonaljido/shared';
import { t } from '../../lib/i18n';
import { kmLabel } from '../../lib/routeTimes';
import { minutesLabel } from '../../lib/format';
import { legKeys } from '../../lib/trips';
import { dayEnds, legEnds } from '../dayInfo';
import { Sheet } from '../Sheet';

/**
 * 이동 시간 between two neighbours on the timeline — read-only: times come from Kakao directions (the
 * navigation route search), never typed. A leg Kakao can't measure (a place without a location, or home without an
 * address in 설정) stays empty and the car's navigation times it on the road.
 */
export function LegSheet({
  isOpen,
  onClose,
  plan,
  dayIndex,
  k,
  legMeters,
  askable,
  routeAt,
  refreshing,
  onRecalc,
  help,
}: {
  isOpen: boolean;
  onClose: () => void;
  plan: Trip;
  dayIndex: number;
  k: number;
  legMeters: Record<string, number>;
  /** Both ends have a location Kakao may be asked about. */
  askable: boolean;
  /** When Kakao last answered in this session (for the "as of" line). */
  routeAt: Date | null;
  refreshing: boolean;
  onRecalc: () => void;
  /** For a leg that cannot be asked yet: what would make it askable, and the button that does it. */
  help?: { text: string; action: string; busy?: boolean; onAction: () => void };
}) {
  const { day } = dayEnds(plan, dayIndex);
  const { from, to } = legEnds(plan, dayIndex, k);
  const key = legKeys(plan, day.dayIndex)[k];
  const meters = key ? legMeters[key] : undefined;
  const leg = day.legs[k];
  const at = routeAt ? `${String(routeAt.getHours()).padStart(2, '0')}:${String(routeAt.getMinutes()).padStart(2, '0')}` : null;
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={t('tl.legTitle')}
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <Button label={t('tl.recalcShort')} variant="secondary" size="lg" isLoading={refreshing} isDisabled={!askable} onClick={onRecalc} />
          <div style={{ flex: '1 1 auto' }}>
            <Button label={t('tl.done')} variant="primary" size="lg" width="100%" onClick={onClose} />
          </div>
        </div>
      }>
      <Text type="label">{t('tl.legRoute', { from, to })}</Text>
      {leg ? (
        <span className="tl-leg-value">{`${t('tl.legMinutes', { duration: minutesLabel(leg.minutes) })}${meters ? ` · ${kmLabel(meters)}` : ''}`}</span>
      ) : (
        <span className="tl-leg-value is-empty">{askable ? t('tl.legPending') : help ? help.text : t('tl.legNotAskable')}</span>
      )}
      {!leg && !askable && help && <Button label={help.action} variant="secondary" size="md" isLoading={help.busy} onClick={help.onAction} />}
      {askable && (
        <Text type="supporting" color="secondary">
          {at ? t('tl.legKakaoAt', { time: at }) : t('tl.legKakao')}
        </Text>
      )}
    </Sheet>
  );
}
