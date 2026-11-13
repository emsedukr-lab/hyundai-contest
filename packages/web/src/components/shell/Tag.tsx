import type { ReactNode } from 'react';

export type TagTone = 'neutral' | 'ink' | 'accent' | 'warn' | 'ok' | 'must';

/**
 * A quiet status tag, the car app's Tag at phone scale: 22px, radius 7, 12px bold ink on one neutral face
 * (dim/dark/primary) for every tone, so a card's name stays the loudest thing on it. The tone is a small dot in front
 * (shell.css): `accent` informative/positive for a piece of information (만드는 중 · 2/4), `ok` informative/active
 * for a finished step, `warn` an ink dot for something to fix (the design system has no warning hue), and no dot for
 * `ink` (a firm choice) and `neutral` (the rest, one step quieter). The words always carry the meaning.
 * `must` is the one exception — 꼭 (a place that can't be dropped or moved): a light coral face, coral text and a 📌
 * in front, so the lock reads as a constraint of the plan rather than one more status.
 */
export function Tag({ tone = 'neutral', children }: { tone?: TagTone; children: ReactNode }) {
  return (
    <span className={`tn-tag is-${tone}`}>
      {tone === 'must' && <span className="tn-tag-pin" aria-hidden="true">📌</span>}
      {children}
    </span>
  );
}
