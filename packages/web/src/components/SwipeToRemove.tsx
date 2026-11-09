import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import './swipe.css';

/** How far a half-swiped card rests open, showing its action. */
const OPEN_AT = -88;

/**
 * A card that slides left to reveal a red action (빼기 / 삭제) behind it (M36; shared with the trip list, M52). Past 45% of its width (or a quick fling) it is removed on
 * release; a shorter swipe rests open so 빼기 can be tapped, and tapping the card or Esc closes it again. Only a sideways
 * gesture counts — vertical scrolling passes through (touch-action: pan-y) — and the drag handle is left to dnd-kit.
 * The tap that ends a swipe never opens the card's details.
 */
export function SwipeToRemove({
  className = '',
  cardClassName,
  actionText,
  actionLabel,
  ignore,
  onRemove,
  children,
}: {
  /** Extra classes on the outer wrapper (spacing in its list). */
  className?: string;
  /** Classes of the sliding card (its surface, so it covers the red action until swiped). */
  cardClassName: string;
  /** The word on the red action: 빼기 in the day timeline, 삭제 in the trip list. */
  actionText: string;
  actionLabel: string;
  /** A part of the card that keeps its own pointer gestures (the timeline's drag handle). */
  ignore?: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  const [x, setX] = useState(0);
  const [sliding, setSliding] = useState(false);
  const gesture = useRef<{ id: number; x0: number; y0: number; t0: number; base: number; width: number; sideways: boolean } | null>(null);
  const swipedAt = useRef(-Infinity);
  const card = useRef<HTMLDivElement>(null);
  // The slide-out finishes before the stop is removed; by then the editor may have re-rendered, so call its newest handler.
  const removeRef = useRef(onRemove);
  removeRef.current = onRemove;
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const remove = () => {
    if (timer.current !== undefined) return; // already on its way out
    setSliding(false);
    setX(-(card.current?.offsetWidth ?? 400));
    timer.current = window.setTimeout(() => removeRef.current(), 160);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (ignore && (e.target as Element).closest(ignore))) return;
    gesture.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, base: x, width: e.currentTarget.offsetWidth, sideways: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.sideways) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) >= Math.abs(dx)) return void (gesture.current = null); // a scroll, not a swipe
      g.sideways = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setSliding(true);
    }
    setX(Math.min(0, Math.max(-g.width, g.base + dx)));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.sideways) return;
    swipedAt.current = e.timeStamp;
    setSliding(false);
    const dx = e.clientX - g.x0;
    const at = Math.min(0, g.base + dx);
    const speed = dx / Math.max(1, e.timeStamp - g.t0); // px per ms; negative is leftward
    if (at < -g.width * 0.45 || (speed < -0.8 && dx < -48)) remove();
    else setX(at < OPEN_AT / 2 ? OPEN_AT : 0);
  };
  const onPointerCancel = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.sideways) return;
    setSliding(false);
    setX(g.base);
  };
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    const afterSwipe = e.timeStamp - swipedAt.current < 400;
    if (!afterSwipe && x === 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (!afterSwipe) setX(0); // tapping an open card closes it
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && x !== 0) {
      e.stopPropagation();
      setX(0);
    }
  };
  const open = x !== 0;

  return (
    <div className={`tl-swipe${open || sliding ? ' is-open' : ''}${className ? ` ${className}` : ''}`} onKeyDown={onKeyDown}>
      <div className="tl-swipe-back" aria-hidden={!open}>
        <button type="button" className="tl-swipe-action" tabIndex={open ? 0 : -1} aria-label={actionLabel} onClick={remove}>
          {actionText}
        </button>
      </div>
      <div
        ref={card}
        className={`tl-swipe-card ${cardClassName}`}
        style={{ transform: x ? `translateX(${x}px)` : undefined, transition: sliding ? 'none' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        // A link inside (a trip row) would start the browser's own link drag on a mouse and cancel the swipe (M52).
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={onClickCapture}>
        {children}
      </div>
    </div>
  );
}
