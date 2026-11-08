import { useEffect, useMemo, useRef, useState } from 'react';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { Home, Trip } from '@tteonaljido/shared';
import { t } from '../lib/i18n';
import { dayPoints } from '../lib/routeSketch';
import { RouteSketch } from './RouteSketch';
import { JS_KEY, escapeHtml, loadKakao } from '../lib/kakaoSdk';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 경로 미리보기 (real map): a day's stops as numbered markers with the route drawn between them, on a Kakao map. Needs a
 * build-time `VITE_KAKAO_JS_KEY`; with no key — or if the SDK fails to load — it falls back to the no-key SVG
 * {@link RouteSketch}, so the strict-CSP path keeps working. Advisory only; it never changes the plan.
 */
export function KakaoMap({ plan, home, dayIndex }: { plan: Trip; home: Home | null; dayIndex: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const pts = useMemo(() => dayPoints(plan, home, dayIndex, { homeLabel: t('common.home') }), [plan, home, dayIndex]);
  const coords = useMemo(() => pts.filter((p): p is typeof p & { latE7: number; lonE7: number } => p.latE7 !== null && p.lonE7 !== null), [pts]);
  const noCoords = useMemo(() => pts.filter((p) => p.kind === 'stop' && (p.latE7 === null || p.lonE7 === null)).map((p) => p.label), [pts]);
  // Stable signature so the effect only rebuilds the map when the day's points actually change.
  const sig = useMemo(() => coords.map((c) => `${c.latE7},${c.lonE7},${c.label}`).join('|'), [coords]);

  useEffect(() => {
    if (!JS_KEY || !ref.current || coords.length === 0) return;
    let cancelled = false;
    loadKakao(JS_KEY)
      .then((kakao) => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = ''; // a day switch re-runs this effect on the same div; clear the old map so they don't stack
        const map = new kakao.maps.Map(ref.current, { center: new kakao.maps.LatLng(coords[0].latE7 / 1e7, coords[0].lonE7 / 1e7), level: 6 });
        const path: any[] = [];
        for (const p of coords) {
          const ll = new kakao.maps.LatLng(p.latE7 / 1e7, p.lonE7 / 1e7);
          path.push(ll);
          const info = new kakao.maps.InfoWindow({ position: ll, content: `<div style="padding:4px 8px;font-size:12px;white-space:nowrap">${escapeHtml(p.n ? `${p.n}. ${p.label}` : p.label)}</div>` });
          if (p.kind === 'stop' && p.n) {
            // a numbered pin (custom overlay) so the visit order shows on the marker itself; click toggles the full name
            const el = document.createElement('div');
            el.textContent = String(p.n);
            el.title = p.label;
            el.setAttribute('style', 'display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:#276EF1;color:#fff;font:700 12px/1 sans-serif;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);cursor:pointer');
            let open = false;
            el.addEventListener('click', () => ((open = !open) ? info.open(map) : info.close()));
            new kakao.maps.CustomOverlay({ position: ll, content: el, xAnchor: 0.5, yAnchor: 0.5, map, zIndex: 3 });
          } else {
            // start/end anchor (home or the night's lodging): a plain pin, name on click
            const marker = new kakao.maps.Marker({ position: ll, map });
            kakao.maps.event.addListener(marker, 'click', () => info.open(map, marker));
          }
        }
        if (path.length > 1) new kakao.maps.Polyline({ path, strokeWeight: 4, strokeColor: '#276EF1', strokeOpacity: 0.85, strokeStyle: 'solid', map });
        // Fit to the day's stops (≥2) so a far-away home/lodging anchor doesn't zoom the whole region out and overlap them.
        const stops = coords.filter((p) => p.kind === 'stop');
        const base = stops.length >= 2 ? stops : coords;
        if (base.length > 1) {
          const bounds = new kakao.maps.LatLngBounds();
          for (const p of base) bounds.extend(new kakao.maps.LatLng(p.latE7 / 1e7, p.lonE7 / 1e7));
          map.setBounds(bounds);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    const el = ref.current;
    return () => {
      cancelled = true;
      if (el) el.innerHTML = '';
    };
  }, [sig, coords]);

  // No key, nothing to plot, or the SDK failed → the no-map SVG sketch (same props, CSP-safe).
  if (!JS_KEY || failed || coords.length === 0) return <RouteSketch plan={plan} home={home} dayIndex={dayIndex} />;

  return (
    <VStack gap={2}>
      <div ref={ref} style={{ width: '100%', height: 240 }} role="img" aria-label={t('map.aria', { day: dayIndex })} />
      {noCoords.length > 0 && (
        <Text type="supporting" color="secondary">
          {t('sketch.noCoords', { names: noCoords.join(', ') })}
        </Text>
      )}
    </VStack>
  );
}
