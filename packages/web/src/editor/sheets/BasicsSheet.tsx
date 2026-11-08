import { useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { DateRangeInput } from '@astryxdesign/core/DateRangeInput';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import type { Home, Trip } from '@tteonaljido/shared';
import { t } from '../../lib/i18n';
import { nightsLabel, setPeriod } from '../../lib/trips';
import { Sheet } from '../Sheet';
import { StartPlaceField } from '../StartPlaceField';

type Range = NonNullable<Parameters<typeof DateRangeInput>[0]['value']>;

/**
 * 여행 정보: name and period, opened from the editor title. A new trip opens here first, with 출발 장소 on top — the
 * first thing chosen when planning (also editable later from the day-1 start card).
 */
export function BasicsSheet({ isOpen, onClose, plan, home, isNew, onChange, onOpenSettings }: { isOpen: boolean; onClose: () => void; plan: Trip; home: Home | null; isNew: boolean; onChange: (p: Trip) => void; onOpenSettings: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={t('tl.basicsTitle')} height="tall" footer={<Button label={t('tl.done')} variant="primary" size="lg" width="100%" onClick={onClose} />}>
      {isNew && (
        <Text type="supporting" color="secondary">
          {t('tl.newIntro')}
        </Text>
      )}
      {error && <Banner status="error" title={error} isDismissable onDismiss={() => setError(null)} />}
      {isNew && <StartPlaceField plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} />}
      <FormLayout>
        <TextInput label={t('editor.name')} value={plan.name} onChange={(v) => onChange({ ...plan, name: v.slice(0, 60) })} isRequired />
        <DateRangeInput
          label={t('editor.period')}
          value={{ start: plan.startDate, end: plan.endDate } as Range}
          maxRangeSpan={14}
          hasClear={false}
          description={t('editor.period.detail', { nights: nightsLabel(plan), timezone: plan.timezone })}
          onChange={(r) => {
            if (!r) return;
            try {
              onChange(setPeriod(plan, r.start, r.end));
              setError(null);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      </FormLayout>
    </Sheet>
  );
}
