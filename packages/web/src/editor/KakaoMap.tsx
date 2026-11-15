import { useEffect, useMemo, useRef, useState } from 'react';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { Home, Trip } from '@tteonaljido/shared';
import { t } from '../lib/i18n';
import { dayPoints } from '../lib/routeSketch';
import { allRuns } from '../lib/routeTimes';
import { roadLines } from '../lib/routePaths';
import { RouteSketch } from './RouteSketch';
import { JS_KEY, escapeHtml, loadKakao, numberPin } from '../lib/kakaoSdk';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A role token's light value (shell.css `:root`, a light-dark() pair) as Kakao's drawing API needs it: a plain color
 * string. Kakao's tiles are always light, so the route is drawn in the light values in both themes; a hidden probe
 * with color-scheme: light lets the browser resolve the pair.
 */
const token = (el: Element, name: string) => {
  const probe = document.createElement('span');
  probe.style.cssText = `display:none;color-scheme:light;color:var(${name})`;
  el.appendChild(probe);
  const rgb = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
  probe.remove();
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
};

/**
 * 경로 미리보기 (real map): a day's stops as numbered markers with the route drawn between them, on a Kakao map — the
 * roads Kakao's directions take, a faint dashed straight line only where no road is known. The tiles and the
 * plain start/end pins are Kakao's own; what we draw on top — the day's route and its numbered pins — is the accent
 * line on a white casing with accent number circles (design/TOSS.md §5 지도), and a road not known yet is a
 * text-disabled dash; all in the light values in both themes because the tiles are always light. Needs a
 * build-time `VITE_KAKAO_JS_KEY`; with no key — or if the SDK fails to load — it falls back to the no-key SVG
 * {@link RouteSketch}, so the strict-CSP path keeps working. Advisory only; it never changes the plan.
 */
export function KakaoMap({ plan, home, dayIndex }: { plan: Trip; home: Home | null; dayIndex: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const pts = useMemo(() => dayPoints(plan, home, dayIndex, { homeLabel: t('common.home') }), [plan, home, dayIndex]);
  const plotted = useMemo(() => pts.filter((p): p is typeof p & { latE7: number; lonE7: number } => p.latE7 !== null && p.lonE7 !== null), [pts]);
  const noCoords = useMemo(() => pts.filter((p) => p.kind === 'stop' && (p.latE7 === null || p.lonE7 === null)).map((p) => p.label), [pts]);
  // Every plan edit (typing a trip name, a travel time) makes new point objects. Key the array on what is drawn, so the
  // effect below rebuilds the map only when the day's markers actually change — not on every keystroke.
  const sig = useMemo(() => plotted.map((c) => `${c.latE7},${c.lonE7},${c.label},${c.kind},${c.n ?? ''}`).join('|'), [plotted]);
  const coords = useMemo(() => plotted, [sig]);
  // The day's askable legs, grouped as the travel-time request groups them; keyed on their points like the markers.
  const dayRuns = useMemo(() => allRuns(plan, home).filter((r) => r.dayIndex === dayIndex), [plan, home, dayIndex]);
  const runSig = dayRuns.map((r) => r.points.map((p) => `${p.latE7},${p.lonE7}`).join(';')).join('|');
  const runs = useMemo(() => dayRuns, [runSig]);

  useEffect(() => {
    if (!JS_KEY || !ref.current || coords.length === 0) return;
    let cancelled = false;
    loadKakao(JS_KEY)
      .then((kakao) => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = ''; // a day switch re-runs this effect on the same div; clear the old map so they don't stack
        ref.current.dataset.route = 'sketch';
        const route = token(ref.current, '--tn-accent');
        const casing = token(ref.current, '--tn-surface');
        const unknown = token(ref.current, '--tn-text-disabled');
        const map = new kakao.maps.Map(ref.current, { center: new kakao.maps.LatLng(coords[0].latE7 / 1e7, coords[0].lonE7 / 1e7), level: 6 });
        const path: any[] = [];
        for (const p of coords) {
          const ll = new kakao.maps.LatLng(p.latE7 / 1e7, p.lonE7 / 1e7);
          path.push(ll);
          const info = new kakao.maps.InfoWindow({ position: ll, content: `<div style="padding:4px 8px;font-size:12px;white-space:nowrap">${escapeHtml(p.n ? `${p.n}. ${p.label}` : p.label)}</div>` });
          if (p.kind === 'stop' && p.n) {
            // a numbered pin (custom overlay) so the visit order shows on the marker itself; click toggles the full name
            const el = numberPin(p.n, p.label, true);
            let open = false;
            el.addEventListener('click', () => ((open = !open) ? info.open(map) : info.close()));
            new kakao.maps.CustomOverlay({ position: ll, content: el, xAnchor: 0.5, yAnchor: 0.5, map, zIndex: 3 });
          } else {
            // start/end anchor (home or the night's lodging): a plain pin, name on click
            const marker = new kakao.maps.Marker({ position: ll, map });
            kakao.maps.event.addListener(marker, 'click', () => info.open(map, marker));
          }
        }
        // A light dashed straight line right away; replaced by the roads as soon as Kakao's directions answer.
        const dashed = (p: any[]) => new kakao.maps.Polyline({ path: p, strokeWeight: 3, strokeColor: unknown, strokeOpacity: 1, strokeStyle: 'shortdash', map, zIndex: 1 });
        const sketch = path.length > 1 ? dashed(path) : null;
        if (runs.length > 0)
          void roadLines(runs).then((lines) => {
            if (cancelled || !lines.some((l) => l.path && l.path.length > 1)) return; // nothing better than the sketch
            sketch?.setMap(null);
            for (const l of lines) {
              if (l.path === null) dashed([new kakao.maps.LatLng(l.from.latE7 / 1e7, l.from.lonE7 / 1e7), new kakao.maps.LatLng(l.to.latE7 / 1e7, l.to.lonE7 / 1e7)]);
              else if (l.path.length > 1) {
                const road = l.path.map(([lat, lon]) => new kakao.maps.LatLng(lat, lon));
                // like a navigation route: a white casing under the accent line keeps it readable over roads and labels
                new kakao.maps.Polyline({ path: road, strokeWeight: 8, strokeColor: casing, strokeOpacity: 1, strokeStyle: 'solid', map, zIndex: 1 });
                new kakao.maps.Polyline({ path: road, strokeWeight: 5, strokeColor: route, strokeOpacity: 1, strokeStyle: 'solid', map, zIndex: 2 });
              }
            }
            if (ref.current) ref.current.dataset.route = 'road'; // for tests: the roads are drawn
          });
        // Fit to the day's stops (≥2) so a far-away home/lodging anchor doesn't zoom the whole region out and overlap them;
        // an anchor close to the stops (the night's hotel in the same town) is kept in view instead of being cut off.
        const stops = coords.filter((p) => p.kind === 'stop');
        const nearStops = (p: (typeof coords)[number]) => stops.some((s) => Math.hypot((s.latE7 - p.latE7) / 1e7, ((s.lonE7 - p.lonE7) / 1e7) * 0.8) < 0.1); // ~10 km
        const base = stops.length >= 2 ? coords.filter((p) => p.kind === 'stop' || nearStops(p)) : coords;
        if (base.length > 1) {
          const bounds = new kakao.maps.LatLngBounds();
          for (const p of base) bounds.extend(new kakao.maps.LatLng(p.latE7 / 1e7, p.lonE7 / 1e7));
          map.setBounds(bounds, 44, 24, 24, 24); // top room for a pin's head, which stands above its point
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
  }, [coords, runs]);

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
