import type { ReactNode } from 'react';

export type TagTone = 'neutral' | 'ink' | 'accent' | 'warn' | 'ok';

/**
 * A quiet status tag (M44 unslop): 22px, radius 6, 12px text on a light tint of its own colour — instead of the solid
 * blue / amber pills, so a card's name stays the loudest thing on it. One accent per card at most:
 * `accent` for the one fact that pins the plan (고정 13:00), `ink` for a firm choice (꼭), `warn` only for something to fix,
 * `ok` for a finished step, `neutral` for the rest.
 */
export function Tag({ tone = 'neutral', children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={`tn-tag is-${tone}`}>{children}</span>;
}
