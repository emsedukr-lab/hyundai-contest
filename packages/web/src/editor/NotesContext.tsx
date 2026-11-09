import { createContext, useContext, useState } from 'react';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TimeInput } from '@astryxdesign/core/TimeInput';
import { t } from '../lib/i18n';
import { MEMO_MAX, type PlaceNote, type TripNotes } from '../lib/notes';
import { FieldPrefix } from './FieldPrefix';

type ISOTime = Parameters<NonNullable<Parameters<typeof TimeInput>[0]['onChange']>>[0];
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

/** Lodging extras: check-in and check-out times (optional) and a memo such as the room number. */
export function LodgingNoteFields({ placeRef }: { placeRef: string }) {
  const { notes, setNote } = useNotes();
  const note = notes[placeRef] ?? {};
  const time = (key: 'checkIn' | 'checkOut', placeholder: string, short: string) => (
    <FieldPrefix prefix={note[key] ? short : null}>
      <TimeInput
        label={placeholder}
        isLabelHidden
        placeholder={placeholder}
        increment={30}
        hasClear
        value={(note[key] ?? undefined) as ISOTime}
        onChange={(v) => setNote(placeRef, { [key]: v ? String(v).slice(0, 5) : null })}
      />
    </FieldPrefix>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {time('checkIn', t('tl.checkIn'), t('tl.checkInShort'))}
      {time('checkOut', t('tl.checkOut'), t('tl.checkOutShort'))}
      <MemoInput placeRef={placeRef} placeholder={t('tl.lodgingMemo')} />
    </div>
  );
}
