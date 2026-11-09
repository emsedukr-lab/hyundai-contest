import { Button } from '@astryxdesign/core/Button';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Text } from '@astryxdesign/core/Text';
import type { Trip } from '@tteonaljido/shared';
import { t } from '../../lib/i18n';
import { kmLabel } from '../../lib/routeTimes';
import { legKeys, setLeg } from '../../lib/trips';
import { dayEnds, legEnds } from '../dayInfo';
import { Sheet } from '../Sheet';

/** 이동 시간 between two neighbours on the timeline. Empty is allowed: the car then marks the leg 'Check'. */
export function LegSheet({
  isOpen,
  onClose,
  plan,
  dayIndex,
  k,
  legMeters,
  onChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  plan: Trip;
  dayIndex: number;
  k: number;
  legMeters: Record<string, number>;
  onChange: (p: Trip) => void;
}) {
  const { day } = dayEnds(plan, dayIndex);
  const { from, to } = legEnds(plan, dayIndex, k);
  const key = legKeys(plan, day.dayIndex)[k];
  const meters = key ? legMeters[key] : undefined;
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={t('tl.legTitle')} footer={<Button label={t('tl.done')} variant="primary" size="lg" width="100%" onClick={onClose} />}>
      <Text type="label">{t('tl.legRoute', { from, to })}</Text>
      {!!meters && (
        <Text type="supporting" color="secondary">
          {t('tl.legDistance', { km: kmLabel(meters) })}
        </Text>
      )}
      <NumberInput
        label={t('tl.legInput')}
        isLabelHidden
        value={day.legs[k]?.minutes ?? null}
        placeholder={t('tl.legInput')}
        hasClear
        isIntegerOnly
        onChange={(v: number | null) => onChange(setLeg(plan, day.dayIndex, k, v === null || !Number.isFinite(v) ? null : Math.max(0, Math.min(1440, Math.round(v)))))}
      />
    </Sheet>
  );
}
