import type { ReactNode } from 'react';
import { ChevronIcon } from './icons';

/** toss.md list-header: a section title (`<h2>`) with an optional action on the right. */
export function Section({ title, action, children }: { title: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <section>
      <div className="tn-section">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

interface RowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  lead?: ReactNode; // 44pt leading slot (an icon on a grey tile)
  end?: ReactNode; // badges, a value or a switch
  chevron?: boolean;
  onClick?: () => void;
  href?: string;
}

/**
 * toss.md list-row: full-bleed, 14×24 padding, the whole row is the hit area. Renders a real `<button>` when it acts,
 * an `<a>` when it navigates (`href` + `onClick` for client routing), else a plain row.
 */
export function Row({ title, subtitle, lead, end, chevron, onClick, href }: RowProps) {
  const inner = (
    <>
      {lead && <span className="tn-lead">{lead}</span>}
      <span className="tn-row-text">
        <span className="tn-row-title">{title}</span>
        {subtitle && <span className="tn-row-sub">{subtitle}</span>}
      </span>
      {(end || chevron) && (
        <span className="tn-row-end">
          {end}
          {chevron && <ChevronIcon />}
        </span>
      )}
    </>
  );
  if (href)
    return (
      <a
        className="tn-row"
        href={href}
        onClick={(e) => {
          if (!onClick || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          onClick();
        }}>
        {inner}
      </a>
    );
  if (onClick)
    return (
      <button type="button" className="tn-row" onClick={onClick}>
        {inner}
      </button>
    );
  return <div className="tn-row" style={{ cursor: 'default' }}>{inner}</div>;
}
