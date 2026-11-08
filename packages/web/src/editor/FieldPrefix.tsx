import type { ReactNode } from 'react';
import './timeline.css';

/**
 * Keeps a placeholder-style field readable once it holds a value: empty, its placeholder says what it is; filled, this
 * short prefix appears beside it instead (Astryx TimeInput has no in-field slot). No label sits above the field.
 */
export function FieldPrefix({ prefix, children }: { prefix: string | null; children: ReactNode }) {
  if (!prefix) return <>{children}</>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="tl-infield" aria-hidden="true" style={{ flex: 'none' }}>
        {prefix}
      </span>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>{children}</div>
    </div>
  );
}
