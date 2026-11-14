import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
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
  // The whole trip is arranged at once (M64), which takes a moment: only while the dialog is open, never on every edit behind it.
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

  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => !o && close()} width={560}>
      <DialogHeader title={t('recommend.title')} subtitle={t('recommend.rules')} onOpenChange={(o) => !o && close()} />
      {lodgingStep ? (
        <VStack gap={4}>
          <Banner status="info" title={t('recommend.lodging.title')} description={t('recommend.lodging.body', { days: gaps.map((d) => t('common.day', { day: d })).join(', ') })} />
          <HStack gap={2}>
            <Button label={t('recommend.lodging.inputFirst')} variant="secondary" onClick={close} />
            <StackItem size="fill">
              <Button label={t('recommend.lodging.proceed')} variant="primary" width="100%" onClick={() => setProceeded(true)} />
            </StackItem>
          </HStack>
        </VStack>
      ) : (
        <VStack gap={4}>
          {/* What changed, as one plain line: only something to act on (a full day) is a banner. */}
          <Text type="label">{diff.changed ? t('recommend.summary', { added: diff.addedCount, moved: diff.movedCount }) : t('recommend.noChanges')}</Text>
          {diff.changed && diff.overflowCount > 0 && <Banner status="warning" title={t('recommend.overflow', { n: diff.overflowCount })} />}
          {diff.changed && diff.noCoordsCount > 0 && (
            <Text type="supporting" color="secondary">
              {t('recommend.noCoords')}
            </Text>
          )}

          <RecommendPreview display={display} home={home} diff={diff} insights={found?.insights} />

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
        </VStack>
      )}
    </Dialog>
  );
}
