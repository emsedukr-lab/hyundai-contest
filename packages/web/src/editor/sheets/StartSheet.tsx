import { Button } from '@astryxdesign/core/Button';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack } from '@astryxdesign/core/Stack';
import { TimeInput } from '@astryxdesign/core/TimeInput';
import type { Home, Trip } from '@tteonaljido/shared';
import { t } from '../../lib/i18n';
import { setDepart } from '../../lib/trips';
import { dayEnds } from '../dayInfo';
import { Sheet } from '../Sheet';
import { EndpointField } from '../EndpointField';

type ISOTime = Parameters<NonNullable<Parameters<typeof TimeInput>[0]['onChange']>>[0];

/** 출발 card: day 1 picks where the trip starts and how its first time is set; later days set the departure time. */
export function StartSheet({ isOpen, onClose, plan, home, dayIndex, onChange, onOpenSettings }: { isOpen: boolean; onClose: () => void; plan: Trip; home: Home | null; dayIndex: number; onChange: (p: Trip) => void; onOpenSettings: () => void }) {
  const { day, isFirst, startName } = dayEnds(plan, dayIndex);
  const fd = plan.firstDay;
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={t('tl.start')} height="tall" footer={<Button label={t('tl.done')} variant="primary" size="lg" width="100%" onClick={onClose} />}>
      {isFirst ? (
        <>
          <EndpointField which="origin" plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} />
          <FormLayout>
            <SegmentedControl
              label={t('editor.firstDay')}
              value={fd.basis}
              onChange={(v) => onChange({ ...plan, firstDay: v === 'DEPART_ORIGIN' ? { basis: 'DEPART_ORIGIN', departTime: '09:00' } : { basis: 'ARRIVE_FIRST_STOP', arriveTime: '10:00', prepMinutes: 10 } })}>
              <SegmentedControlItem value="DEPART_ORIGIN" label={t('editor.firstDay.depart')} />
              <SegmentedControlItem value="ARRIVE_FIRST_STOP" label={t('editor.firstDay.arrive')} />
            </SegmentedControl>
            {fd.basis === 'DEPART_ORIGIN' ? (
              <TimeInput
                label={t('editor.departTime')}
                increment={30}
                value={fd.departTime as ISOTime}
                onChange={(v) => v && onChange({ ...plan, firstDay: { basis: 'DEPART_ORIGIN', departTime: String(v).slice(0, 5) } })}
              />
            ) : (
              <HStack gap={2}>
                <TimeInput
                  label={t('editor.arriveTime')}
                  increment={30}
                  value={fd.arriveTime as ISOTime}
                  onChange={(v) => v && onChange({ ...plan, firstDay: { ...fd, arriveTime: String(v).slice(0, 5) } })}
                />
                <NumberInput
                  label={t('editor.prepMinutes')}
                  value={fd.prepMinutes}
                  isIntegerOnly
                  onChange={(v) => onChange({ ...plan, firstDay: { ...fd, prepMinutes: Math.max(0, Math.min(240, Math.round(v ?? 0))) } })}
                />
              </HStack>
            )}
          </FormLayout>
        </>
      ) : (
        <TimeInput
          label={t('days.departFrom', { start: startName })}
          value={(day.departTime ?? undefined) as ISOTime}
          increment={30}
          hasClear
          onChange={(v) => onChange(setDepart(plan, day.dayIndex, v ? String(v).slice(0, 5) : null))}
        />
      )}
    </Sheet>
  );
}
