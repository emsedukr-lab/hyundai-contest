import { ToastNotice } from '../components/ToastNotice';
import { Button } from '@astryxdesign/core/Button';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { useEffect, useMemo, useState } from 'react';
import type { Home, Trip } from '@tteonaljido/shared';
import { t } from '../lib/i18n';
import { relinkLegs, type LegBook } from '../lib/trips';
import { favorites } from '../lib/db';
import type { FavoritePlace } from '../lib/favorites';
import { missingLodgingDays, recommend, summarizeRecommendation } from '../lib/recommend';
import { RecommendPreview } from './RecommendPreview';
import { Sheet } from './Sheet';
import { mealTimes } from '../lib/meals';
import { useNotes } from './NotesContext';

/**
 * Previews an auto route recommendation and lets the user apply or cancel (요청: "확인·수정 여지"). If a night has no
 * lodging it first offers to set it, so the day can be arranged to end near the stay. Applying hands the proposed plan
 * to the editor's `edit()`, which re-links travel times; the editor then saves it like any other edit.
 */
export function RecommendDialog({
  isOpen,
  plan,
  home,
  book,
  onApply,
  onClose,
}: {
  isOpen: boolean;
  plan: Trip;
  home: Home | null;
  book: LegBook;
  onApply: (proposed: Trip) => void;
  onClose: () => void;
}) {
  const [proceeded, setProceeded] = useState(false);
  const gaps = useMemo(() => missingLodgingDays(plan), [plan]);
  const { notes } = useNotes();
  // Favorite places may be offered for a long gap; they are read when the dialog opens.
  const [pool, setPool] = useState<FavoritePlace[]>([]);
  useEffect(() => {
    if (isOpen) void favorites.all().then(setPool, () => undefined);
  }, [isOpen]);
  // The whole trip is arranged at once, which takes a moment: only while the dialog is open, never on every edit behind it.
  const found = useMemo(() => (isOpen ? recommend(plan, home, { book, notes, pool, mealTimes: mealTimes() }) : null), [isOpen, plan, home, book, notes, pool]);
  const proposed = found?.plan ?? plan;
  // Display copy with travel times re-linked exactly as edit() will, over a throwaway book so the real one is untouched.
  const display = useMemo(() => relinkLegs(plan, proposed, new Map(book)), [plan, proposed, book]);
  const diff = useMemo(() => summarizeRecommendation(plan, display), [plan, display]);

  const close = () => {
    setProceeded(false);
    onClose();
  };
  const lodgingStep = gaps.length > 0 && !proceeded;

  // A bottom sheet with its buttons in the footer (like the list sheet): as a plain dialog a trip of a few days grew
  // taller than a phone screen and the buttons ended up below it, out of reach.
  const footer = lodgingStep ? (
    <HStack gap={2}>
      <Button label={t('recommend.lodging.inputFirst')} variant="secondary" onClick={close} />
      <StackItem size="fill">
        <Button label={t('recommend.lodging.proceed')} variant="primary" width="100%" onClick={() => setProceeded(true)} />
      </StackItem>
    </HStack>
  ) : (
    <HStack gap={2}>
      <Button label={t('common.cancel')} variant="secondary" onClick={close} />
      <StackItem size="fill">
        <Button
          label={t('recommend.apply')}
          variant="primary"
          width="100%"
          isDisabled={!diff.changed}
          onClick={() => {
            onApply(proposed);
            close();
          }}
        />
      </StackItem>
    </HStack>
  );

  return (
    <Sheet isOpen={isOpen} onClose={close} title={t('recommend.title')} height="capped" footer={footer}>
      <VStack gap={4}>
        <Text type="supporting" color="secondary">
          {t('recommend.rules')}
        </Text>
        {lodgingStep ? (
          <ToastNotice status="info" title={t('recommend.lodging.title')} description={t('recommend.lodging.body', { days: gaps.map((d) => t('common.day', { day: d })).join(', ') })} />
        ) : (
          <>
            {/* What changed, as one plain line: only something to act on (a full day) is a banner. */}
            <Text type="label">{diff.changed ? t('recommend.summary', { added: diff.addedCount, moved: diff.movedCount }) : t('recommend.noChanges')}</Text>
            {diff.changed && diff.overflowCount > 0 && <ToastNotice status="warning" title={t('recommend.overflow', { n: diff.overflowCount })} />}
            {diff.changed && diff.noCoordsCount > 0 && (
              <Text type="supporting" color="secondary">
                {t('recommend.noCoords')}
              </Text>
            )}
            <RecommendPreview display={display} home={home} diff={diff} insights={found?.insights} />
          </>
        )}
      </VStack>
    </Sheet>
  );
}
