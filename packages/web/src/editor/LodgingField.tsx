import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import type { Trip } from '@tteonaljido/shared';
import { BedIcon, CloseIcon } from '../components/shell/icons';
import { t } from '../lib/i18n';
import { addPlace, lodgingPlaces, placeOf, setLodging } from '../lib/trips';
import { LodgingNoteFields } from './NotesContext';
import { PlaceSearch } from './PlaceSearch';

/**
 * One night's lodging on the 여행 정보 tab — usually booked before the days are planned. Empty: a search field
 * ("1일차 숙소") plus the trip's lodgings as one-tap choices (the same hotel for several nights). Chosen: the night and
 * the lodging in an input-shaped row with a clear button, then its check-in/out times and memo (phone-only notes).
 */
export function LodgingField({ plan, dayIndex, onChange, showNotes = true }: { plan: Trip; dayIndex: number; onChange: (p: Trip) => void; showNotes?: boolean }) {
  const day = plan.days.find((d) => d.dayIndex === dayIndex);
  const chosen = placeOf(plan, day?.lodgingPlaceRef ?? '');
  if (!day) return null;
  if (chosen)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="tl-lodging">
        <span className="tl-fieldicon" aria-hidden="true">
          <BedIcon />
        </span>
        <span className="tl-lodging-text">
          <span className="tl-infield">{t('common.day', { day: dayIndex })}</span>
          <span>{chosen.name}</span>
        </span>
        <IconButton label={t('tl.clearLodging')} icon={<CloseIcon />} variant="ghost" size="sm" onClick={() => onChange(setLodging(plan, dayIndex, null))} />
      </div>
      {/* Check-in/out and a memo (room number…), once per stay: on the first night at this lodging. */}
      {showNotes && <LodgingNoteFields placeRef={chosen.placeRef} />}
      </div>
    );
  const known = lodgingPlaces(plan);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <PlaceSearch
        compact
        lodgingOnly
        isLabelHidden
        label={t('tl.nightLodging', { day: dayIndex })}
        placeholder={t('tl.nightLodging', { day: dayIndex })}
        onPick={(p) => {
          const added = addPlace(plan, p);
          onChange(setLodging(added, dayIndex, added.places[added.places.length - 1].placeRef));
        }}
      />
      {known.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {known.map((p) => (
            <Button key={p.placeRef} label={p.name} variant="secondary" size="sm" onClick={() => onChange(setLodging(plan, dayIndex, p.placeRef))} />
          ))}
        </div>
      )}
    </div>
  );
}
