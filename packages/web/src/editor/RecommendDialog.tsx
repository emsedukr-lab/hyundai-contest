import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { useMemo, useState } from 'react';
import { hhmm, timeline, type Home, type Trip } from '@tteonaljido/shared';
import { dateLabel } from '../lib/format';
import { t } from '../lib/i18n';
import { placeOf, relinkLegs, visitOf, type LegBook } from '../lib/trips';
import { missingLodgingDays, recommendRoute, summarizeRecommendation } from '../lib/recommend';

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
  const proposed = useMemo(() => recommendRoute(plan, home), [plan, home]);
  // Display copy with travel times re-linked exactly as edit() will, over a throwaway book so the real one is untouched.
  const display = useMemo(() => relinkLegs(plan, proposed, new Map(book)), [plan, proposed, book]);
  const diff = useMemo(() => summarizeRecommendation(plan, display), [plan, display]);

  const close = () => {
    setProceeded(false);
    onClose();
  };
  const clock = (m: number) => (m < 0 ? t('days.prevDay') : hhmm(m));

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

          <VStack gap={3}>
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
                              {ch?.newlyAssigned && <Badge variant="info" label={t('recommend.newBadge')} />}
                              {ch?.moved && ch.fromDay !== null && ch.fromDay !== d.dayIndex && <Badge variant="neutral" label={t('recommend.movedFrom', { from: ch.fromDay })} />}
                              {v.importance === 'MUST' && <Badge variant="warning" label={t('common.must')} />}
                              {v.fixed && <Badge variant="info" label={t('common.fixedAt', { time: v.fixed.time })} />}
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
