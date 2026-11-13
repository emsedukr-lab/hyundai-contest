import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { useEffect, useMemo, useState } from 'react';
import { hhmm, timeline, type Home, type Trip } from '@tteonaljido/shared';
import { t } from '../lib/i18n';
import { Tag } from '../components/shell/Tag';
import { placeOf, relinkLegs, visitOf, type LegBook } from '../lib/trips';
import { favorites } from '../lib/db';
import type { FavoritePlace } from '../lib/favorites';
import { dateLabel, minutesLabel, timeLabel } from '../lib/format';
import { missingLodgingDays, recommend, summarizeRecommendation, type RecommendInsights, type RecommendationDiff } from '../lib/recommend';
import { useNotes } from './NotesContext';

/**
 * Previews an auto route recommendation and lets the user apply or cancel (요청: "확인·수정 여지"). If a night has no
 * lodging it first offers to set it, so the day can be arranged to end near the stay. Applying hands the proposed plan
 * to the editor's `edit()`, which re-links travel times and marks the plan dirty — nothing is saved until Save.
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
  const found = useMemo(() => (isOpen ? recommend(plan, home, { book, notes, pool }) : null), [isOpen, plan, home, book, notes, pool]);
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
      <DialogHeader title={t('recommend.title')} subtitle={t('recommend.intro')} onOpenChange={(o) => !o && close()} />
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
          {diff.changed ? (
            <>
              <Banner status="success" title={t('recommend.summary', { added: diff.addedCount, moved: diff.movedCount })} />
              {diff.overflowCount > 0 && <Banner status="warning" title={t('recommend.overflow', { n: diff.overflowCount })} />}
              {diff.noCoordsCount > 0 && <Banner status="info" title={t('recommend.noCoords')} />}
            </>
          ) : (
            <Banner status="info" title={t('recommend.noChanges')} />
          )}

          <RecommendPreview display={display} diff={diff} insights={found?.insights} />

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

/** The proposed days, stop by stop with their times and what changed — shared by this dialog and the new-trip setup (M43). */
export function RecommendPreview({ display, diff, insights }: { display: Trip; diff: RecommendationDiff; insights?: RecommendInsights }) {
  const clock = (m: number) => (m < 0 ? t('days.prevDay') : hhmm(m));
  return (
    <VStack gap={3}>
      <Text type="supporting" color="secondary">
        {t('recommend.rules')}
      </Text>
      {insights && insights.hardViolations > 0 && <Banner status="warning" title={t('recommend.hard', { n: insights.hardViolations })} />}
      {insights?.gaps.map((g) => (
        <Banner
          key={`${g.dayIndex}-${g.beforeVisitId}`}
          status="info"
          title={t('recommend.gap', { day: g.dayIndex, name: g.beforeName, duration: minutesLabel(g.minutes) })}
          description={g.suggestion ? t('recommend.gap.suggest', { name: g.suggestion.name }) : undefined}
        />
      ))}
      {insights?.lodgingNotes.map((n) => (
        <Banner
          key={`${n.dayIndex}-${n.kind}`}
          status="info"
          title={t(n.kind === 'ARRIVES_BEFORE_CHECKIN' ? 'recommend.checkin' : 'recommend.checkout', { day: n.dayIndex, time: n.time ? timeLabel(n.time) : '', duration: minutesLabel(n.minutes) })}
        />
      ))}
      {display.days.map((d) => {
        const times = timeline(display, d.dayIndex);
        return (
          <VStack gap={1} key={d.dayIndex}>
            <Text type="label">{`${t('common.day', { day: d.dayIndex })} · ${dateLabel(d.date)}`}</Text>
            {d.visitOrder.length === 0 ? (
              <Text type="supporting" color="secondary">
                {t('days.empty')}
              </Text>
            ) : (
              d.visitOrder.map((id, k) => {
                const v = visitOf(display, id)!;
                const p = placeOf(display, v.placeRef);
                const ch = diff.changes.find((c) => c.visitId === id);
                const st = times[k];
                return (
                  <Card key={id} padding={2}>
                    <VStack gap={0.5}>
                      <HStack gap={1} vAlign="center" wrap="wrap">
                        <Text type="supporting">{`${k + 1}. ${p?.name ?? id}`}</Text>
                        {ch?.newlyAssigned && <Tag tone="accent">{t('recommend.newBadge')}</Tag>}
                        {ch?.moved && ch.fromDay !== null && ch.fromDay !== d.dayIndex && <Tag>{t('recommend.movedFrom', { from: ch.fromDay })}</Tag>}
                        {v.importance === 'MUST' && <Tag tone="must">{t('common.mustAria')}</Tag>}
                        {v.fixed && <Tag tone="accent">{t('common.fixedAt', { time: v.fixed.time })}</Tag>}
                      </HStack>
                      <Text type="supporting" color="secondary">
                        {st?.arrive !== null && st?.arrive !== undefined
                          ? st.arrive === st.start
                            ? t('days.arriveOnly', { arrive: clock(st.arrive) })
                            : t('days.times', { arrive: clock(st.arrive), start: clock(st.start!) })
                          : t('days.timeCheck')}
                      </Text>
                    </VStack>
                  </Card>
                );
              })
            )}
          </VStack>
        );
      })}
    </VStack>
  );
}
