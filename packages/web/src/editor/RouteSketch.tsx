import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { Home, Trip } from '@tteonaljido/shared';
import { t } from '../lib/i18n';
import { daySketch } from '../lib/routeSketch';

/**
 * 경로 미리보기 (route sketch): a no-map, inline-SVG overview of a day's route from the places' relative coordinates.
 * Honors the strict CSP — no tiles, no external script, no key. The day's route is the accent line with accent number
 * circles (design/TOSS.md §5 지도), drawn as `currentColor` on the container face so it reads in both themes; the
 * numbers are white on the accent, 12px on screen. Stops without coordinates can't be placed and
 * are listed below. Advisory only; it never changes the plan.
 */
export function RouteSketch({ plan, home, dayIndex }: { plan: Trip; home: Home | null; dayIndex: number }) {
  const s = daySketch(plan, home, dayIndex, { homeLabel: t('common.home') });
  if (s.nodes.length === 0) {
    return (
      <Text type="supporting" color="secondary">
        {t('sketch.none')}
      </Text>
    );
  }
  const line = s.nodes.map((n) => `${n.x.toFixed(1)},${n.y.toFixed(1)}`).join(' ');
  return (
    <VStack gap={2}>
      <svg
        viewBox={`0 0 ${s.width} ${s.height}`}
        role="img"
        aria-label={t('sketch.aria', { day: dayIndex })}
        style={{ width: '100%', height: 'auto', maxHeight: 200, color: 'var(--tn-accent)' }}>
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth={0.8} strokeLinejoin="round" strokeLinecap="round" />
        {s.nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={n.kind === 'stop' ? 5 : 2.6} style={{ fill: n.kind === 'stop' ? 'currentColor' : 'var(--color-background-card)' }} stroke="currentColor" strokeWidth={0.9} />
            {n.n !== null && (
              <text x={n.x} y={n.y} fontSize={6} fontWeight={700} textAnchor="middle" dominantBaseline="central" style={{ fill: 'var(--tn-on-accent)' }}>
                {n.n}
              </text>
            )}
          </g>
        ))}
      </svg>
      <VStack gap={0.5}>
        {s.nodes
          .filter((n) => n.n !== null)
          .map((n) => (
            <Text key={n.n} type="supporting" color="secondary">
              {`${n.n}. ${n.label}`}
            </Text>
          ))}
        {s.noCoords.length > 0 && (
          <Text type="supporting" color="secondary">
            {t('sketch.noCoords', { names: s.noCoords.join(', ') })}
          </Text>
        )}
      </VStack>
    </VStack>
  );
}
