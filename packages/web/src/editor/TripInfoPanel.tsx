import { useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { DateRangeInput } from '@astryxdesign/core/DateRangeInput';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import type { Home, Trip } from '@tteonaljido/shared';
import { Section } from '../components/toss/Card';
import { t } from '../lib/i18n';
import { nightsLabel, setPeriod } from '../lib/trips';
import { EndpointField } from './EndpointField';

type Range = NonNullable<Parameters<typeof DateRangeInput>[0]['value']>;

/**
 * 여행 정보 — the editor's first tab, in the page itself (no popup): 여행 이름 → 여행 기간 → 출발 장소 → 귀가 시 도착
 * 장소, top to bottom, the order a new trip is set up in. A new trip opens here; the button at the end moves on to day 1.
 */
export function TripInfoPanel({ plan, home, isNew, onChange, onOpenSettings, onPlanDays }: { plan: Trip; home: Home | null; isNew: boolean; onChange: (p: Trip) => void; onOpenSettings: () => void; onPlanDays: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="tn-pad" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {isNew && (
        <Text type="supporting" color="secondary">
          {t('tl.infoIntro')}
        </Text>
      )}
      {error && <Banner status="error" title={error} isDismissable onDismiss={() => setError(null)} />}
      <Section title={t('editor.name')}>
        <TextInput label={t('editor.name')} isLabelHidden value={plan.name} onChange={(v) => onChange({ ...plan, name: v.slice(0, 60) })} isRequired />
      </Section>
      <Section title={t('editor.period')}>
        <DateRangeInput
          label={t('editor.period')}
          isLabelHidden
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
      </Section>
      <Section title={t('editor.startPlace')}>
        <EndpointField which="origin" isLabelHidden plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} />
      </Section>
      <Section title={t('tl.endPlace')}>
        <EndpointField which="finalDestination" isLabelHidden plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} />
      </Section>
      <Button label={t('tl.toDay1')} variant="secondary" size="lg" width="100%" onClick={onPlanDays} />
    </div>
  );
}
