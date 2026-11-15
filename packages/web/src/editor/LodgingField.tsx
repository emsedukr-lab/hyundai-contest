import { useState } from 'react';
import { Selector } from '@astryxdesign/core/Selector';
import { IconButton } from '@astryxdesign/core/IconButton';
import type { Trip } from '@tteonaljido/shared';
import { CloseIcon } from '../components/shell/icons';
import { t } from '../lib/i18n';
import { addPlace, placeOf, setLodging } from '../lib/trips';
import { LodgingNoteFields, useNotes } from './NotesContext';
import { LodgingSuggest } from './LodgingSuggest';
import { PlaceSearch } from './PlaceSearch';

/**
 * The body of one night's card on the 여행 정보 rail (lodging is usually booked before the days are planned).
 * Chosen: the lodging's name like a timeline card, its check-in/out and memo as grey lines, and the fields for them
 * opened on demand, and a chip to put it on the empty nights after (M49). Empty: a search field ("1일차 숙소"), 미정, and
 * the trip's lodgings as chips, the previous night's first (M49).
 */
export function LodgingField({
  plan,
  dayIndex,
  onChange,
  showNotes = true,
  isError = true,
  onLeave,
}: {
  plan: Trip;
  dayIndex: number;
  onChange: (p: Trip) => void;
  showNotes?: boolean;
  /** An empty night reads as an error (red helper); false = the same words as a neutral hint (a new trip not yet tried, M66). */
  isError?: boolean;
  /** The empty field lost the focus: from now on it may show as an error. */
  onLeave?: () => void;
}) {
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
        {/* 이어서 묵기 (M49): fill the empty nights after this one with the same lodging. */}
        <LodgingSuggest plan={plan} dayIndex={dayIndex} onChange={onChange} />
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* One line: the search, and 미정 right beside it (M43). */}
      <div
        className="tl-lodging-line"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) onLeave?.();
        }}>
        <div className="tl-lodging-search">
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
        </div>
        {/* 미정: no lodging needed for this night yet — the card stops asking (toss chip: active = dark fill). */}
        <button type="button" className={`tl-chip tl-lodging-tbd${tbd ? ' is-on' : ''}`} aria-pressed={tbd} aria-label={t('tl.lodgingTbdAria', { day: dayIndex })} onClick={() => setLodgingTbd(dayIndex, !tbd)}>
          {t('tl.lodgingTbdChip')}
        </button>
      </div>
      {plan.places.length > 0 && (
        <Selector
          label={t('tl.lodgingFromPlaces')}
          placeholder={t('tl.lodgingFromPlaces')}
          placement="below"
          value=""
          options={plan.places.map((p) => ({ value: p.placeRef, label: [p.name, p.address].filter(Boolean).join(' · ') }))}
          onChange={(ref) => choose(setLodging(plan, dayIndex, ref))}
        />
      )}
      {/* 이어서 묵기 (M49): the trip's lodgings as chips, the previous night's first. */}
      <LodgingSuggest plan={plan} dayIndex={dayIndex} onChange={onChange} />
      {/* toss text-field helper under the field until a lodging or 미정 is chosen: red once it is an error, neutral before. */}
      {!tbd && <span className={isError ? 'tl-required-text' : 'tl-meta'}>{t('tl.lodgingRequired')}</span>}
    </div>
  );
}
