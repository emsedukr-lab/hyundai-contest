import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { useEffect, useMemo, useState } from 'react';
import { hhmm, timeline, type Home, type Trip } from '@tteonaljido/shared';
import { t } from '../lib/i18n';
import { Tag } from '../components/shell/Tag';
import './recommend.css';
import { placeOf, relinkLegs, visitOf, type LegBook } from '../lib/trips';
import { favorites } from '../lib/db';
import type { FavoritePlace } from '../lib/favorites';
import { dateLabel, minutesLabel, timeLabel } from '../lib/format';
import { laterStart } from '../lib/laterStart';
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

/**
 * The proposed days, stop by stop with their times and what changed — shared by this dialog and the new-trip setup (M43).
 * One list per day (rows on hairlines, not a card per stop). A time is shown where it is known; how many are not is
 * said once under the day's title. `showNew` marks the places a recommendation placed — off in the new-trip setup,
 * where every place is new. What the engine noticed (long gaps, check-in and check-out) follows as plain lines.
 */
export function RecommendPreview({ display, diff, insights, showNew = true }: { display: Trip; diff: RecommendationDiff; insights?: RecommendInsights; showNew?: boolean }) {
  const clock = (m: number) => (m < 0 ? t('days.prevDay') : hhmm(m));
  const { notes: tripNotes } = useNotes();
  const notes = [
    // Another way to use a long wait before a booking: leave later (the day view offers it as a card once this is applied).
    ...display.days.flatMap((d) => {
      const s = laterStart(display, d.dayIndex, tripNotes);
      return s ? [{ key: `later-${d.dayIndex}`, text: t('recommend.later', { day: d.dayIndex, time: timeLabel(s.to), name: placeOf(display, visitOf(display, s.visitId)?.placeRef ?? '')?.name ?? '', fixed: timeLabel(s.fixedTime) }) }] : [];
    }),
    ...(insights?.gaps ?? []).map((g) => ({
      key: `gap-${g.dayIndex}-${g.beforeVisitId}`,
      text: t('recommend.gap', { day: g.dayIndex, name: g.beforeName, duration: minutesLabel(g.minutes) }) + (g.suggestion ? ` · ${t('recommend.gap.suggest', { name: g.suggestion.name })}` : ''),
    })),
    ...(insights?.lodgingNotes ?? []).map((n) => ({
      key: `lodging-${n.dayIndex}-${n.kind}`,
      text: t(n.kind === 'ARRIVES_BEFORE_CHECKIN' ? 'recommend.checkin' : 'recommend.checkout', { day: n.dayIndex, time: n.time ? timeLabel(n.time) : '', duration: minutesLabel(n.minutes) }),
    })),
  ];
  return (
    <VStack gap={4}>
      {insights && insights.hardViolations > 0 && <Banner status="warning" title={t('recommend.hard', { n: insights.hardViolations })} />}
      {display.days.map((d) => {
        const times = timeline(display, d.dayIndex);
        const untimed = times.filter((st) => st.arrive === null).length;
        return (
          <section className="rc-day" key={d.dayIndex}>
            <header className="rc-head">
              <Text type="label">{`${t('common.day', { day: d.dayIndex })} · ${dateLabel(d.date)}`}</Text>
              {untimed > 0 && <span className="rc-meta">{t('recommend.untimed', { n: untimed })}</span>}
            </header>
            {d.visitOrder.length === 0 ? (
              <p className="rc-empty">{t('days.empty')}</p>
            ) : (
              <ol className="rc-list">
                {d.visitOrder.map((id, k) => {
                  const v = visitOf(display, id)!;
                  const p = placeOf(display, v.placeRef);
                  const ch = diff.changes.find((c) => c.visitId === id);
                  const st = times[k];
                  const time = st?.arrive === null || st?.arrive === undefined ? null : st.arrive === st.start ? clock(st.arrive) : t('days.times', { arrive: clock(st.arrive), start: clock(st.start!) });
                  return (
                    <li className="rc-row" key={id}>
                      <span className="rc-n">{k + 1}</span>
                      <span className="rc-name">{p?.name ?? id}</span>
                      <span className="rc-tags">
                        {showNew && ch?.newlyAssigned && <Tag tone="accent">{t('recommend.newBadge')}</Tag>}
                        {ch?.moved && ch.fromDay !== null && ch.fromDay !== d.dayIndex && <Tag>{t('recommend.movedFrom', { from: ch.fromDay })}</Tag>}
                        {v.importance === 'MUST' && <Tag tone="must">{t('common.mustAria')}</Tag>}
                        {v.fixed && <Tag tone="accent">{t('common.fixedAt', { time: v.fixed.time })}</Tag>}
                      </span>
                      {time && <span className="rc-time">{time}</span>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
      {notes.length > 0 && (
        <ul className="rc-notes">
          {notes.map((n) => (
            <li key={n.key}>{n.text}</li>
          ))}
        </ul>
      )}
    </VStack>
  );
}
