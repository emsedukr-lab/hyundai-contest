import type { SendLogEntry } from '../lib/db';
import { dateLabel, dayOf, periodLabel } from '../lib/format';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { tripSketch, type TripSketch } from '../lib/routeSketch';
import { tripWhen } from '../lib/nextTrip';
import { nightsLabel, todayIn, unassignedVisits, type TripDoc } from '../lib/trips';
import { ChevronIcon } from './shell/icons';
import { Tag } from './shell/Tag';
import './nextTrip.css';

/**
 * 다음 여행 (M45): the 여행 tab's lead card. Name, when it leaves (bold ink), and the whole route drawn on the same
 * dashed line with numbered stops as the editor — the day ahead in ink, the other days quiet, like the car's route
 * sketch. Below, what still needs doing (bold ink behind an ink dot) or the last version sent to the car. The whole
 * card opens the trip.
 */
export function NextTrip({ doc, sent, overlaps = 0 }: { doc: TripDoc; sent?: SendLogEntry; overlaps?: number }) {
  const { plan } = doc;
  const when = tripWhen(plan.startDate, plan.endDate, todayIn(plan.timezone));
  const sketch = tripSketch(plan, { width: 300, height: 176, pad: 16 });
  const unassigned = unassignedVisits(plan).length;
  const tbd = doc.lodgingTbd ?? [];
  const lodgingEmpty = plan.days.slice(0, -1).filter((d) => !d.lodgingPlaceRef && !tbd.includes(d.dayIndex)).length;
  const inSetup = doc.setup && !doc.setup.done;
  const todo = [
    unassigned > 0 ? t('home.unassignedBadge', { n: unassigned }) : null,
    lodgingEmpty > 0 ? t('home.next.lodgingEmpty', { n: lodgingEmpty }) : null,
    overlaps > 0 ? t('home.overlap', { n: overlaps }) : null, // M49: other trips on the same dates
  ].filter(Boolean);
  const href = `/trips/${doc.tripId}`;

  return (
    <a
      className="tn-next"
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href);
      }}>
      <span className="tn-next-head">
        <span className="tn-next-when">{inSetup ? <Tag tone="accent">{t('setup.homeBadge', { step: doc.setup!.step })}</Tag> : when.label}</span>
        <span className="tn-next-name">{plan.name}</span>
        <span className="tn-next-meta">
          {t('common.tripSummary', { period: periodLabel(plan.startDate, plan.endDate), nights: nightsLabel(plan).replace(/ /g, ' '), places: plan.places.length })}
        </span>
      </span>
      {sketch.plotted >= 2 ? <RouteDrawing sketch={sketch} focusDay={when.focusDay} name={plan.name} /> : <span className="tn-next-empty">{t('home.next.noRoute')}</span>}
      <span className="tn-next-foot">
        {todo.length > 0 ? (
          <>
            <span className="tn-warn-dot" aria-hidden="true" />
            <span className="tn-next-todo">{todo.join(' · ')}</span>
          </>
        ) : (
          <span className="tn-next-done">{sent ? t('home.lastSend', { version: sent.revision, date: dateLabel(dayOf(sent.at)) }) : inSetup ? '' : t('home.next.ready')}</span>
        )}
        <span className="tn-next-rev">{`v${doc.revision}`}</span>
        <ChevronIcon />
      </span>
    </a>
  );
}

/**
 * The whole-trip route (design/TOSS.md §5 지도): other days as a quiet text-disabled dashed line with dots, the day
 * ahead an accent line on a white casing with accent number circles.
 */
function RouteDrawing({ sketch, focusDay, name }: { sketch: TripSketch; focusDay: number | null; name: string }) {
  const line = (d: TripSketch['days'][number]) => [...(d.from ? [d.from] : []), ...d.points].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const quiet = sketch.days.filter((d) => d.dayIndex !== focusDay);
  const focus = sketch.days.find((d) => d.dayIndex === focusDay);
  return (
    <svg className="tn-next-map" viewBox={`0 0 ${sketch.width} ${sketch.height}`} role="img" aria-label={t('home.next.sketch', { name })}>
      {quiet.map((d) => (
        <polyline key={`l${d.dayIndex}`} className="tn-next-quiet" points={line(d)} />
      ))}
      {quiet.flatMap((d) => d.points.map((p, i) => <circle key={`q${d.dayIndex}-${i}`} className={p.kind === 'lodging' ? 'tn-next-lodging' : 'tn-next-dot'} cx={p.x} cy={p.y} r={p.kind === 'lodging' ? 3.5 : 3} />))}
      {focus && (
        <>
          <polyline className="tn-next-casing" points={line(focus)} />
          <polyline className="tn-next-focus" points={line(focus)} />
          {focus.points.map((p, i) =>
            p.kind === 'lodging' ? (
              <circle key={`f${i}`} className="tn-next-lodging is-focus" cx={p.x} cy={p.y} r={4} />
            ) : (
              <g key={`f${i}`} className="tn-next-stop">
                <circle cx={p.x} cy={p.y} r={8.5} />
                <text x={p.x} y={p.y} dy="0.35em" textAnchor="middle">
                  {p.n}
                </text>
              </g>
            ),
          )}
        </>
      )}
    </svg>
  );
}
