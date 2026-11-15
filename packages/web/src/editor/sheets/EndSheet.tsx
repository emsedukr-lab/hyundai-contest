import { ToastNotice } from '../../components/ToastNotice';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import type { Home, Trip } from '@tteonaljido/shared';
import { t } from '../../lib/i18n';
import { addPlace, setEndBy, setLodging } from '../../lib/trips';
import { dayEnds } from '../dayInfo';
import { PlaceSearch } from '../PlaceSearch';
import { Sheet } from '../Sheet';
import { EndpointField } from '../EndpointField';
import { FieldPrefix } from '../FieldPrefix';
import { LodgingSuggest } from '../LodgingSuggest';
import { LodgingNoteFields } from '../NotesContext';
import { TimeSelect } from '../TimeSelect';


/**
 * The day's end card. A night: ① which lodging (an existing one, or find a new one right here) → ② the time to be
 * there by. The last day: where the trip ends (귀가 시 도착 장소, same field as 여행 정보) and the time to be back by.
 */
export function EndSheet({ isOpen, onClose, plan, home, dayIndex, onChange, onOpenPlace, onOpenSettings }: { isOpen: boolean; onClose: () => void; plan: Trip; home: Home | null; dayIndex: number; onChange: (p: Trip) => void; onOpenPlace: (ref: string) => void; onOpenSettings: () => void }) {
  const { day, isLast, endName } = dayEnds(plan, dayIndex);
  const endLabel = endName ?? t('days.lodgingUnset');
  const endBy = (
    <FieldPrefix prefix={day.endBy ? t('tl.endByPh') : null}>
      <TimeSelect label={t('days.endBy', { end: endLabel })} placeholder={t('tl.endByPh')} clearable value={day.endBy} onChange={(v) => onChange(setEndBy(plan, day.dayIndex, v))} />
    </FieldPrefix>
  );
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={isLast ? t('tl.endPlace') : t('days.lodging', { day: day.dayIndex })} footer={<Button label={t('tl.done')} variant="primary" size="lg" width="100%" onClick={onClose} />}>
      {isLast ? (
        <>
          <EndpointField which="finalDestination" compact plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} />
          {day.lodgingPlaceRef && (
            <ToastNotice status="warning" title={t('trip.warn.lastLodging')} endContent={<Button label={t('tl.clearLodging')} variant="secondary" size="sm" onClick={() => onChange(setLodging(plan, day.dayIndex, null))} />} />
          )}
          {endBy}
        </>
      ) : (
        <>
          <Selector
            label={t('tl.lodgingFromPlaces')}
            placement="below"
            placeholder={t('tl.lodgingFromPlaces')}
            options={[{ value: '', label: t('days.lodging.unset') }, ...plan.places.map((p) => ({ value: p.placeRef, label: [p.name, p.address].filter(Boolean).join(' · ') }))]}
            value={day.lodgingPlaceRef ?? ''}
            onChange={(ref) => onChange(setLodging(plan, day.dayIndex, ref || null))}
          />
          {/* 이어서 묵기 (M49): empty → the trip's lodgings as chips (previous night first); chosen → fill the nights after. */}
          <LodgingSuggest plan={plan} dayIndex={day.dayIndex} onChange={onChange} />
          {day.lodgingPlaceRef && <LodgingNoteFields placeRef={day.lodgingPlaceRef} />}
          {day.lodgingPlaceRef && (
            <div>
              <Button label={t('tl.lodgingDetails')} variant="secondary" size="sm" onClick={() => onOpenPlace(day.lodgingPlaceRef!)} />
            </div>
          )}
          <PlaceSearch
            label={t('tl.newLodging')}
            placeholder={t('tl.newLodging')}
            isLabelHidden
            compact
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
