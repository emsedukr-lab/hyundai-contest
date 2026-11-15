import type { Trip } from '@tteonaljido/shared';
import { BedIcon } from '../components/shell/icons';
import { t } from '../lib/i18n';
import { fillNights, laterEmptyNights, lodgingSuggestions, setLodging } from '../lib/trips';
import { useNotes } from './NotesContext';

/**
 * 이어서 묵기: one hotel is often booked for several nights. An empty night offers the trip's lodgings as chips —
 * the nearest earlier night's first — and a chosen night offers to fill the empty nights after it in one tap. Nights
 * left 미정 on purpose are not filled. Used on the 여행 정보 rail (LodgingField) and in the day's lodging sheet.
 */
export function LodgingSuggest({ plan, dayIndex, onChange }: { plan: Trip; dayIndex: number; onChange: (p: Trip) => void }) {
  const { lodgingTbd, setLodgingTbd } = useNotes();
  const day = plan.days.find((d) => d.dayIndex === dayIndex);
  if (!day || dayIndex >= plan.days.length) return null; // the last day has no night
  if (day.lodgingPlaceRef) {
    const later = laterEmptyNights(plan, dayIndex, lodgingTbd);
    if (later.length === 0) return null;
    return (
      <div className="tl-lodging-suggest">
        <button type="button" className="tl-chip tl-lodging-chip" onClick={() => onChange(fillNights(plan, later, day.lodgingPlaceRef!))}>
          <BedIcon />
          {t('tl.lodgingFillLater', { n: later.length })}
        </button>
      </div>
    );
  }
  const options = lodgingSuggestions(plan, dayIndex);
  if (options.length === 0) return null;
  return (
    <div className="tl-lodging-suggest" role="group" aria-label={t('tl.lodgingSuggest')}>
      <span className="tl-lodging-suggest-label">{t('tl.lodgingSuggest')}</span>
      {options.map((p) => (
        <button
          key={p.placeRef}
          type="button"
          className="tl-chip tl-lodging-chip"
          onClick={() => {
            if (lodgingTbd.includes(dayIndex)) setLodgingTbd(dayIndex, false); // choosing a lodging ends 미정 (as in LodgingField)
            onChange(setLodging(plan, dayIndex, p.placeRef));
          }}>
          <BedIcon />
          {p.name}
        </button>
      ))}
    </div>
  );
}
