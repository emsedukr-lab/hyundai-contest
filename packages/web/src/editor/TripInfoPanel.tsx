import { useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { DateRangeInput } from '@astryxdesign/core/DateRangeInput';
import { TextInput } from '@astryxdesign/core/TextInput';
import type { Home, Trip } from '@tteonaljido/shared';
import { Card } from '../components/toss/Card';
import { t } from '../lib/i18n';
import { setPeriod } from '../lib/trips';
import { EndpointField } from './EndpointField';
import { LodgingField } from './LodgingField';

type Range = NonNullable<Parameters<typeof DateRangeInput>[0]['value']>;

/**
 * 여행 정보 — the editor page's first section (no popup), in the order a trip is set up: 여행 이름 → 여행 기간
 * → 출발 장소 → 귀가 시 도착 장소, then each night's lodging (booked ahead, so chosen here, night by night). Fields
 * speak through placeholders and in-field icons rather than labels above them; the labels stay for screen readers.
 */
export function TripInfoPanel({ plan, home, onChange, onOpenSettings }: { plan: Trip; home: Home | null; onChange: (p: Trip) => void; onOpenSettings: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const nights = plan.days.slice(0, -1);
  return (
    <div className="tn-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <Banner status="error" title={error} isDismissable onDismiss={() => setError(null)} />}
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TextInput label={t('editor.name')} isLabelHidden placeholder={t('editor.name')} value={plan.name} onChange={(v) => onChange({ ...plan, name: v.slice(0, 60) })} hasClear />
          <DateRangeInput
            label={t('editor.period')}
            isLabelHidden
            value={{ start: plan.startDate, end: plan.endDate } as Range}
            maxRangeSpan={14}
            hasClear={false}
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
          <EndpointField which="origin" compact plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} />
          <EndpointField which="finalDestination" compact plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} />
        </div>
      </Card>
      {nights.length > 0 && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {nights.map((d) => (
              <LodgingField key={d.dayIndex} plan={plan} dayIndex={d.dayIndex} onChange={onChange} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
