import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { TimeInput } from '@astryxdesign/core/TimeInput';
import type { Home, Trip } from '@tteonaljido/shared';
import { t } from '../../lib/i18n';
import { addPlace, lodgingPlaces, setEndBy, setLodging } from '../../lib/trips';
import { dayEnds } from '../dayInfo';
import { PlaceSearch } from '../PlaceSearch';
import { Sheet } from '../Sheet';
import { endpointValue, toEndpoint } from '../StartPlaceField';

type ISOTime = Parameters<NonNullable<Parameters<typeof TimeInput>[0]['onChange']>>[0];

/**
 * The day's end card. A night: ① which lodging (an existing one, or find a new one right here) → ② the time to be
 * there by. The last day: where the trip ends (home or a place) and the time to be back by.
 */
export function EndSheet({ isOpen, onClose, plan, home, dayIndex, onChange, onOpenPlace }: { isOpen: boolean; onClose: () => void; plan: Trip; home: Home | null; dayIndex: number; onChange: (p: Trip) => void; onOpenPlace: (ref: string) => void }) {
  const { day, isLast, endName } = dayEnds(plan, dayIndex);
  const endLabel = endName ?? t('days.lodgingUnset');
  const endBy = (
    <TimeInput
      label={t('days.endBy', { end: endLabel })}
      description={t('days.endBy.detail')}
      value={(day.endBy ?? undefined) as ISOTime}
      increment={30}
      hasClear
      isOptional
      onChange={(v) => onChange(setEndBy(plan, day.dayIndex, v ? String(v).slice(0, 5) : null))}
    />
  );
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={isLast ? t('tl.home') : t('days.lodging', { day: day.dayIndex })} height="tall" footer={<Button label={t('tl.done')} variant="primary" size="lg" width="100%" onClick={onClose} />}>
      {isLast ? (
        <>
          <Selector
            label={t('editor.finalDestination')}
            options={[{ value: 'HOME', label: t('common.home') }, ...plan.places.map((p) => ({ value: p.placeRef, label: p.name }))]}
            value={endpointValue(plan.finalDestination)}
            onChange={(v) => onChange({ ...plan, finalDestination: toEndpoint(v) })}
          />
          {plan.finalDestination.kind === 'HOME' && !home && (
            <Text type="supporting" color="secondary">
              {t('trip.warn.noHome')}
            </Text>
          )}
          {day.lodgingPlaceRef && (
            <Banner status="warning" title={t('trip.warn.lastLodging')} endContent={<Button label={t('tl.clearLodging')} variant="secondary" size="sm" onClick={() => onChange(setLodging(plan, day.dayIndex, null))} />} />
          )}
          {endBy}
        </>
      ) : (
        <>
          <Selector
            label={t('common.lodging')}
            placeholder={lodgingPlaces(plan).length ? t('days.lodging.placeholder') : t('days.lodging.none')}
            options={[{ value: '', label: t('days.lodging.unset') }, ...lodgingPlaces(plan).map((p) => ({ value: p.placeRef, label: p.name }))]}
            value={day.lodgingPlaceRef ?? ''}
            onChange={(ref) => onChange(setLodging(plan, day.dayIndex, ref || null))}
            description={t('days.lodging.detail')}
          />
          {day.lodgingPlaceRef && (
            <div>
              <Button label={t('tl.lodgingDetails')} variant="secondary" size="sm" onClick={() => onOpenPlace(day.lodgingPlaceRef!)} />
            </div>
          )}
          <PlaceSearch
            label={t('tl.newLodging')}
            lodgingOnly
            onPick={(p) => {
              const added = addPlace(plan, p);
              onChange(setLodging(added, day.dayIndex, added.places[added.places.length - 1].placeRef));
            }}
          />
          {endBy}
        </>
      )}
    </Sheet>
  );
}
