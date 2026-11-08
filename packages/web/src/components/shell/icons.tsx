import type React from 'react';
import type { PresetSlot } from '../../lib/settings';

/**
 * App-shell icons drawn the Pleos way: 24-unit grid, 1.5 stroke, round caps and joins, painted with currentColor.
 * Tab icons come in pairs — outline when inactive, filled when active (toss.md tab-bar). All are decorative here:
 * every use sits next to a visible label or inside a control that carries an aria-label.
 */
const base = { width: 24, height: 24, viewBox: '0 0 24 24', 'aria-hidden': true as const, focusable: false as const };
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
// Cut-outs inside filled icons use the page colour so the shape reads as one solid glyph.
const cut = 'var(--color-background-surface)';

/** 여행 — a folded map. */
export function MapIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg {...base}>
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" fill="currentColor" />
      <path d="M9 4v14M15 6v14" stroke={cut} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  ) : (
    <svg {...base}>
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" {...stroke} />
      <path d="M9 4v14M15 6v14" {...stroke} />
    </svg>
  );
}

/** 장소 — a location pin. */
export function PinIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg {...base}>
      <path d="M12 21.5s7-6.2 7-11.75a7 7 0 1 0-14 0C5 15.3 12 21.5 12 21.5Z" fill="currentColor" />
      <circle cx="12" cy="9.75" r="2.5" fill={cut} />
    </svg>
  ) : (
    <svg {...base}>
      <path d="M12 21.5s7-6.2 7-11.75a7 7 0 1 0-14 0C5 15.3 12 21.5 12 21.5Z" {...stroke} />
      <circle cx="12" cy="9.75" r="2.5" {...stroke} />
    </svg>
  );
}

/** 차량 — a car seen from the front three-quarter. */
export function CarIcon({ filled }: { filled?: boolean }) {
  const body = 'M4 16.5v-4.25l1.85-4.6A2 2 0 0 1 7.7 6.4h8.6a2 2 0 0 1 1.85 1.25L20 12.25v4.25a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z';
  return filled ? (
    <svg {...base}>
      <path d={body} fill="currentColor" />
      <path d="M6.6 19.25v-1.75M17.4 19.25v-1.75" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" />
      <circle cx="7.75" cy="14" r="1.25" fill={cut} />
      <circle cx="16.25" cy="14" r="1.25" fill={cut} />
    </svg>
  ) : (
    <svg {...base}>
      <path d={body} {...stroke} />
      <path d="M4.5 12.25h15M6.6 19.25v-1.75M17.4 19.25v-1.75" {...stroke} />
      <circle cx="7.75" cy="14.6" r="0.9" fill="currentColor" />
      <circle cx="16.25" cy="14.6" r="0.9" fill="currentColor" />
    </svg>
  );
}

/** 설정 — a gear (outline when inactive, filled when active). */
export function GearIcon({ filled }: { filled?: boolean }) {
  // eight teeth around a ring, every 45°
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return [12 + Math.cos(a) * 7.1, 12 + Math.sin(a) * 7.1, 12 + Math.cos(a) * 9.1, 12 + Math.sin(a) * 9.1];
  });
  return (
    <svg {...base}>
      {teeth.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={filled ? 3 : 2.25} strokeLinecap="round" />
      ))}
      {filled ? (
        <>
          <circle cx="12" cy="12" r="7.25" fill="currentColor" />
          <circle cx="12" cy="12" r="2.75" fill={cut} />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="6.5" {...stroke} />
          <circle cx="12" cy="12" r="2.5" {...stroke} />
        </>
      )}
    </svg>
  );
}

/** Back. */
export function BackIcon() {
  return (
    <svg {...base}>
      <path d="M15 5 8 12l7 7" {...stroke} strokeWidth={2} />
    </svg>
  );
}

/** More (overflow menu). */
export function MoreIcon() {
  return (
    <svg {...base}>
      <circle cx="5.5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

/** Chevron for list rows that open something. */
export function ChevronIcon() {
  return (
    <svg {...base} width={20} height={20}>
      <path d="m9 6 6 6-6 6" {...stroke} />
    </svg>
  );
}

/* List-row lead icons (outline only, shown on a grey 44pt tile). */
function Outline({ d, children }: { d?: string; children?: React.ReactNode }) {
  return (
    <svg {...base}>
      {d && <path d={d} {...stroke} />}
      {children}
    </svg>
  );
}
/** QR code (scan the car screen). */
export const QrIcon = () => (
  <Outline d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h1M20 14v1" />
);
/** Paper plane (send). */
export const SendIcon = () => <Outline d="M20.5 3.5 10.6 13.4M20.5 3.5l-6.3 17-3.6-7.1-7.1-3.6 17-6.3Z" />;
/** Download (export a file). */
export const DownloadIcon = () => <Outline d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />;
/** Upload (open a file). */
export const UploadIcon = () => <Outline d="M12 15.5V4.5m0 0L7.5 9M12 4.5 16.5 9M5 19.5h14" />;
/** Shield (privacy). */
export const ShieldIcon = () => <Outline d="M12 3.5 5 6.2v5.3c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6.2l-7-2.7Z" />;
/** Info. */
export const InfoIcon = () => (
  <Outline d="M12 11v5.5M12 7.75v.01">
    <circle cx="12" cy="12" r="8.5" {...stroke} />
  </Outline>
);
/** Phone (add to home screen). */
export const PhoneIcon = () => <Outline d="M8.5 3.5h7a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19V5a1.5 1.5 0 0 1 1.5-1.5ZM11 17.5h2" />;
/** Share (map app's share sheet). */
export const ShareIcon = () => <Outline d="M12 15V4m0 0L8 8m4-4 4 4M6.5 11H6a1.5 1.5 0 0 0-1.5 1.5V19A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-6.5A1.5 1.5 0 0 0 18 11h-.5" />;
/** Close / remove. */
export const CloseIcon = () => <Outline d="m6.5 6.5 11 11m0-11-11 11" />;
/** Star — the must-visit toggle (filled when on). */
export function StarIcon({ filled }: { filled?: boolean }) {
  const d = 'm12 3.6 2.6 5.3 5.8.85-4.2 4.1 1 5.8-5.2-2.75-5.2 2.75 1-5.8-4.2-4.1 5.8-.85L12 3.6Z';
  return <svg {...base}>{filled ? <path d={d} fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" /> : <path d={d} {...stroke} />}</svg>;
}
/** Home (the home address). */
export const HomeIcon = () => <Outline d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H14.5V15h-5v5.5H5.5A1.5 1.5 0 0 1 4 19v-8.5Z" />;
/** Work (the saved 회사 start place): a briefcase. */
export const BriefcaseIcon = () => <Outline d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M4.5 7h15A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-9A1.5 1.5 0 0 1 4.5 7ZM3 12.5h18" />;
/** The icon for a saved start place: 집 a house, 회사 a briefcase, 즐겨찾기 a star. */
export const PresetIcon = ({ slot }: { slot: PresetSlot }) => (slot === 'home' ? <HomeIcon /> : slot === 'work' ? <BriefcaseIcon /> : <StarIcon />);
/** Edit (a pencil), beside the editor title that opens the trip's name and dates. */
export const PencilIcon = () => <Outline d="M14.5 5.5 18.5 9.5M4.5 19.5l1-4.5L15.3 5.2a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L9 18.5l-4.5 1Z" />;
/** Drag handle: six dots. */
export const GripIcon = () => (
  <svg {...base}>
    {[8, 12, 16].flatMap((y) => [9, 15].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r={1.4} fill="currentColor" />))}
  </svg>
);
/** Add (a plus). */
export const PlusIcon = () => <Outline d="M12 5v14M5 12h14" />;
/** The day's end at home on the last day: a flag. */
export const FlagIcon = () => <Outline d="M5.5 20.5V4.5m0 0h11l-2.5 4 2.5 4h-11" />;
/** A night's lodging: a bed. */
export const BedIcon = () => <Outline d="M3.5 18.5v-11m0 7h17v4m0-4V12a2.5 2.5 0 0 0-2.5-2.5h-7.5v5M6.8 11.2a1.6 1.6 0 1 0 0-.01" />;
