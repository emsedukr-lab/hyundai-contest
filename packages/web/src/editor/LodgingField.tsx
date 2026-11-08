import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import type { Trip } from '@tteonaljido/shared';
import { CloseIcon } from '../components/shell/icons';
import { t } from '../lib/i18n';
import { addPlace, lodgingPlaces, placeOf, setLodging } from '../lib/trips';
import { LodgingNoteFields, useNotes } from './NotesContext';
import { PlaceSearch } from './PlaceSearch';

/**
 * The body of one night's card on the 여행 정보 rail (lodging is usually booked before the days are planned).
 * Chosen: the lodging's name like a timeline card, its check-in/out and memo as grey lines, and the fields for them
 * opened on demand. Empty: a search field ("1일차 숙소") plus the trip's lodgings as one-tap choices.
 */
export function LodgingField({ plan, dayIndex, onChange, showNotes = true }: { plan: Trip; dayIndex: number; onChange: (p: Trip) => void; showNotes?: boolean }) {
  const { notes } = useNotes();
  const [editing, setEditing] = useState(false);
  const day = plan.days.find((d) => d.dayIndex === dayIndex);
  const chosen = placeOf(plan, day?.lodgingPlaceRef ?? '');
  if (!day) return null;
  if (chosen) {
    const note = notes[chosen.placeRef];
    const times = [note?.checkIn ? t('tl.checkInAt', { time: note.checkIn }) : '', note?.checkOut ? t('tl.checkOutAt', { time: note.checkOut }) : ''].filter(Boolean).join(' · ');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tl-name" style={{ flex: '1 1 auto', minWidth: 0 }}>
            {chosen.name}
          </span>
          <IconButton label={t('tl.clearLodging')} icon={<CloseIcon />} variant="ghost" size="sm" onClick={() => onChange(setLodging(plan, dayIndex, null))} />
        </div>
        {showNotes && times && <span className="tl-memo">{times}</span>}
        {showNotes && note?.memo && <span className="tl-memo">{note.memo}</span>}
        {showNotes &&
          (editing ? (
            <div style={{ paddingTop: 8 }}>
              <LodgingNoteFields placeRef={chosen.placeRef} />
            </div>
          ) : (
            <div>
              <button type="button" className="tl-textbtn" onClick={() => setEditing(true)}>
                {times || note?.memo ? t('tl.editLodgingNote') : t('tl.addLodgingNote')}
              </button>
            </div>
          ))}
      </div>
    );
  }
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
