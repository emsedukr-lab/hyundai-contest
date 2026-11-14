import { Banner } from '@astryxdesign/core/Banner';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { hhmm, timeline, type Home, type Trip } from '@tteonaljido/shared';
import { Tag } from '../components/shell/Tag';
import { dayTimeGap } from '../lib/dayNote';
import { dateLabel, minutesLabel } from '../lib/format';
import { t } from '../lib/i18n';
import { laterStart } from '../lib/laterStart';
import type { RecommendInsights, RecommendationDiff } from '../lib/recommend';
import { allRuns } from '../lib/routeTimes';
import { placeOf, visitOf } from '../lib/trips';
import { useNotes } from './NotesContext';
import './recommend.css';

/** Why a day of the preview has stops without a time, in a few words (the editor's day note says it in full, with the fix). */
const WHY = { home: 'recommend.why.home', here: 'recommend.why.here', depart: 'recommend.why.depart', pending: 'recommend.why.pending', car: 'recommend.why.car' } as const;

/**
 * The proposed days, stop by stop with their times and what changed — shared by this dialog and the new-trip setup (M43).
 * One list per day (rows on hairlines, not a card per stop). A time is shown where it is known; how many are not, and
 * why (M66), is said once under the day's title — nothing is estimated in their place. `showNew` marks the places a recommendation placed — off in the new-trip setup,
 * where every place is new. What the engine noticed (long gaps, check-in and check-out) follows as plain lines.
 */
export function RecommendPreview({ display, home, diff, insights, showNew = true }: { display: Trip; home: Home | null; diff: RecommendationDiff; insights?: RecommendInsights; showNew?: boolean }) {
  const clock = (m: number) => (m < 0 ? t('days.prevDay') : hhmm(m));
  const { notes: tripNotes } = useNotes();
  const askable = new Set(allRuns(display, home).flatMap((r) => r.keys));
  const notes = [
    // Another way to use a long wait before a booking: leave later (the day view offers it as a card once this is applied).
    ...display.days.flatMap((d) => {
      const s = laterStart(display, d.dayIndex, tripNotes);
      return s ? [{ key: `later-${d.dayIndex}`, text: t('recommend.later', { day: d.dayIndex, time: s.to, name: placeOf(display, visitOf(display, s.visitId)?.placeRef ?? '')?.name ?? '', fixed: s.fixedTime }) }] : [];
    }),
    ...(insights?.gaps ?? []).map((g) => ({
      key: `gap-${g.dayIndex}-${g.beforeVisitId}`,
      text: t('recommend.gap', { day: g.dayIndex, name: g.beforeName, duration: minutesLabel(g.minutes) }) + (g.suggestion ? ` · ${t('recommend.gap.suggest', { name: g.suggestion.name })}` : ''),
    })),
    ...(insights?.lodgingNotes ?? []).map((n) => ({
      key: `lodging-${n.dayIndex}-${n.kind}`,
      text: t(n.kind === 'ARRIVES_BEFORE_CHECKIN' ? 'recommend.checkin' : 'recommend.checkout', { day: n.dayIndex, time: n.time, duration: minutesLabel(n.minutes) }),
    })),
  ];
  return (
    <VStack gap={4}>
      {insights && insights.hardViolations > 0 && <Banner status="warning" title={t('recommend.hard', { n: insights.hardViolations })} />}
      {display.days.map((d) => {
        const times = timeline(display, d.dayIndex);
        const untimed = times.filter((st) => st.arrive === null).length;
        const gap = untimed > 0 ? dayTimeGap(display, home, d.dayIndex, askable) : null;
        return (
          <section className="rc-day" key={d.dayIndex}>
            <header className="rc-head">
              <Text type="label">{`${t('common.day', { day: d.dayIndex })} · ${dateLabel(d.date)}`}</Text>
              {untimed > 0 && <span className="rc-meta">{t('recommend.untimed', { n: untimed })}</span>}
            </header>
            {untimed > 0 && <p className="rc-why">{t(WHY[gap?.kind ?? 'car'])}</p>}
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
