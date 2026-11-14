import { createContext, useContext, useState } from 'react';
import { TextInput } from '@astryxdesign/core/TextInput';
import { t } from '../lib/i18n';
import { MEAL_CHOICES, mealChoiceLabel } from '../lib/meals';
import { MEMO_MAX, type PlaceNote, type TripNotes } from '../lib/notes';
import { FieldPrefix } from './FieldPrefix';
import { TimeSelect } from './TimeSelect';

type Patch = { [K in keyof PlaceNote]?: string | null };

/** The trip's phone-only notes, shared by the editor's sections, sheets and dialogs — memos, and nights marked 미정. */
export const NotesContext = createContext<{
  notes: TripNotes;
  setNote: (placeRef: string, patch: Patch) => void;
  lodgingTbd: number[];
  setLodgingTbd: (dayIndex: number, on: boolean) => void;
}>({ notes: {}, setNote: () => undefined, lodgingTbd: [], setLodgingTbd: () => undefined });
export const useNotes = () => useContext(NotesContext);

/**
 * A memo field. It keeps its own text while focused so typing never fights the trip state, and stores on every
 * change (trimmed to the memo limit).
 */
function MemoInput({ placeRef, placeholder }: { placeRef: string; placeholder: string }) {
  const { notes, setNote } = useNotes();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? notes[placeRef]?.memo ?? '';
  return (
    <TextInput
      label={placeholder}
      isLabelHidden
      placeholder={placeholder}
      value={value}
      hasClear
      onChange={(v) => {
        const text = v.slice(0, MEMO_MAX);
        setDraft(text);
        setNote(placeRef, { memo: text });
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

/** A place's memo (any stop). */
export function PlaceMemoField({ placeRef }: { placeRef: string }) {
  return <MemoInput placeRef={placeRef} placeholder={t('tl.memo')} />;
}

/**
 * 식사 (M67): which meal a restaurant is for — 자동 (told from the time of day; nothing stored) · 아침 · 점심 · 저녁. One
 * choice as chips; the route recommendation reads it, the car never receives it.
 */
export function MealChips({ placeRef, label }: { placeRef: string; label: string }) {
  const { notes, setNote } = useNotes();
  const meal = notes[placeRef]?.meal ?? null;
  return (
    <div className="tl-meal" role="group" aria-label={label}>
      {[null, ...MEAL_CHOICES].map((m) => (
        <button key={m ?? 'auto'} type="button" className={`tl-chip tl-meal-chip${meal === m ? ' is-on' : ''}`} aria-pressed={meal === m} onClick={() => setNote(placeRef, { meal: m })}>
          {m ? mealChoiceLabel(m) : t('meal.auto')}
        </button>
      ))}
    </div>
  );
}

/** Where the picker opens while no time is chosen yet: check-in in the afternoon, check-out in the morning (the usual 15:00 and 11:00). */
export const CHECK_IN_SUGGEST = '15:00';
export const CHECK_OUT_SUGGEST = '11:00';

/** Lodging extras: check-in and check-out times (optional) and a memo such as the room number. */
export function LodgingNoteFields({ placeRef }: { placeRef: string }) {
  const { notes, setNote } = useNotes();
  const note = notes[placeRef] ?? {};
  const time = (key: 'checkIn' | 'checkOut', placeholder: string, short: string, suggest: string) => (
    <FieldPrefix prefix={note[key] ? short : null}>
      <TimeSelect label={placeholder} placeholder={placeholder} clearable value={note[key] ?? null} suggest={suggest} onChange={(v) => setNote(placeRef, { [key]: v })} />
    </FieldPrefix>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {time('checkIn', t('tl.checkIn'), t('tl.checkInShort'), CHECK_IN_SUGGEST)}
      {time('checkOut', t('tl.checkOut'), t('tl.checkOutShort'), CHECK_OUT_SUGGEST)}
      <MemoInput placeRef={placeRef} placeholder={t('tl.lodgingMemo')} />
    </div>
  );
}
