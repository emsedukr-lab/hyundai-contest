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
  const { notes, lodgingTbd, setLodgingTbd } = useNotes();
  const tbd = lodgingTbd.includes(dayIndex);
  /** Choosing a lodging ends 미정 for that night. */
  const choose = (next: Trip) => {
    if (tbd) setLodgingTbd(dayIndex, false);
    onChange(next);
  };
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
          choose(setLodging(added, dayIndex, added.places[added.places.length - 1].placeRef));
        }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {known.map((p) => (
          <Button key={p.placeRef} label={p.name} variant="secondary" size="sm" onClick={() => choose(setLodging(plan, dayIndex, p.placeRef))} />
        ))}
        {/* 미정: no lodging needed for this night yet — the card stops asking (toss chip: active = dark fill). */}
        <button type="button" className={`tl-chip${tbd ? ' is-on' : ''}`} aria-pressed={tbd} aria-label={t('tl.lodgingTbdAria', { day: dayIndex })} onClick={() => setLodgingTbd(dayIndex, !tbd)}>
          {t('tl.lodgingTbdChip')}
        </button>
      </div>
      {/* toss text-field error: the helper line in red under the field, until a lodging or 미정 is chosen. */}
      {!tbd && <span className="tl-required-text">{t('tl.lodgingRequired')}</span>}
    </div>
  );
}
