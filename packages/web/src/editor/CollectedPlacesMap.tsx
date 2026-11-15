import { useEffect, useRef } from 'react';
import type { Place } from '@tteonaljido/shared';
import { t } from '../lib/i18n';
import { JS_KEY, loadKakao, numberPin } from '../lib/kakaoSdk';

/** The collected places only: pin order matches the list, with no suggested route or search results. */
export function CollectedPlacesMap({ places, onPick, onMapFailed }: { places: readonly Place[]; onPick: (ref: string) => void; onMapFailed: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const located = places.flatMap((p, i) => p.latE7 !== null && p.lonE7 !== null ? [{ ...p, n: i + 1, latE7: p.latE7, lonE7: p.lonE7 }] : []);
  const missing = places.filter((p) => p.latE7 === null || p.lonE7 === null);
  const signature = located.map((p) => `${p.placeRef}:${p.latE7}:${p.lonE7}:${p.name}:${p.n}`).join('|');
  useEffect(() => {
    if (!JS_KEY || !ref.current || located.length === 0) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    const box = ref.current;
    const fail = () => { if (!cancelled) { cancelled = true; onMapFailed(); } };
    const timeout = setTimeout(fail, 10_000);
    loadKakao(JS_KEY).then((kakao) => {
      clearTimeout(timeout);
      if (cancelled) return;
      const at = (p: typeof located[number]) => new kakao.maps.LatLng(p.latE7 / 1e7, p.lonE7 / 1e7);
      const map = new kakao.maps.Map(box, { center: at(located[0]), level: 5 });
      const bounds = new kakao.maps.LatLngBounds();
      for (const p of located) {
        bounds.extend(at(p));
        const pin = numberPin(p.n, p.name, true);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pc-map-pin';
        button.setAttribute('aria-label', p.name);
        button.appendChild(pin);
        button.addEventListener('click', () => onPick(p.placeRef));
        new kakao.maps.CustomOverlay({ position: at(p), content: button, xAnchor: 0.5, yAnchor: 0.5, map, zIndex: 3 });
      }
      if (located.length > 1) map.setBounds(bounds, 44, 24, 24, 24);
      observer = new ResizeObserver(() => map.relayout());
      observer.observe(box);
    }).catch(() => { clearTimeout(timeout); fail(); });
    return () => { cancelled = true; clearTimeout(timeout); observer?.disconnect(); box.innerHTML = ''; };
    // Only redraw when the pins change, not when unrelated form fields change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return (
    <div>
      {located.length > 0 && <div ref={ref} role="region" aria-label={t('mapPick.savedAria')} style={{ width: '100%', height: 280, borderRadius: 'var(--radius-container)', overflow: 'hidden' }} />}
      {missing.length > 0 && <p className="tl-meta">{t('sketch.noCoords', { names: missing.map((p) => p.name).join(', ') })}</p>}
    </div>
  );
}
