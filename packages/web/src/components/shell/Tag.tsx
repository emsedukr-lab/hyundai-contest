import type { ReactNode } from 'react';
import { PushPinIcon } from './icons';

export type TagTone = 'neutral' | 'ink' | 'accent' | 'warn' | 'ok' | 'must';

/**
 * A quiet status tag, the car app's Tag at phone scale: 22px, radius 7, 12px bold ink on one neutral face
 * (dim/dark/primary) for every tone, so a card's name stays the loudest thing on it. The tone is a small dot in front
 * (shell.css): `accent` informative/positive for a piece of information (만드는 중 · 2/4), `ok` informative/active
 * for a finished step, `warn` an ink dot for something to fix (the design system has no warning hue), and no dot for
 * `ink` (a firm choice) and `neutral` (the rest, one step quieter). The words always carry the meaning.
 * `must` is the one exception — 꼭 (a place that can't be dropped or moved): no words, only the Pleos outline pin
 * (24 grid, round 1.6 stroke, like the lock) in informative/negative on a faint face of the same color, so it reads
 * as a constraint of the plan rather than one more status. The children become its accessible name.
 */
export function Tag({ tone = 'neutral', children }: { tone?: TagTone; children: ReactNode }) {
  if (tone === 'must') {
    const label = typeof children === 'string' ? children : undefined;
    return (
      <span className="tn-tag is-must" role="img" aria-label={label} title={label}>
        <PushPinIcon />
      </span>
    );
  }
  return <span className={`tn-tag is-${tone}`}>{children}</span>;
}
