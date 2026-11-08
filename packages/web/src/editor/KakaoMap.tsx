import { useEffect, useMemo, useRef, useState } from 'react';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { Home, Trip } from '@tteonaljido/shared';
import { t } from '../lib/i18n';
import { dayPoints } from '../lib/routeSketch';
import { RouteSketch } from './RouteSketch';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    kakao?: any;
  }
}

const JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY;

let sdk: Promise<any> | null = null;
/** Loads the Kakao Maps JS SDK once (from dapi.kakao.com; the CSP allows dapi.kakao.com and *.kakaocdn.net). Rejects if it can't load. */
function loadKakao(key: string): Promise<any> {
  if (window.kakao?.maps) return Promise.resolve(window.kakao);
  sdk ??= new Promise<any>((resolve, reject) => {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    s.onload = () => (window.kakao ? window.kakao.maps.load(() => resolve(window.kakao)) : reject(new Error('kakao missing')));
    s.onerror = () => {
      sdk = null; // let a later mount retry
      reject(new Error('kakao sdk load failed'));
    };
    document.head.appendChild(s);
  });
  return sdk;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

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
        const map = new kakao.maps.Map(ref.current, { center: new kakao.maps.LatLng(coords[0].latE7 / 1e7, coords[0].lonE7 / 1e7), level: 6 });
        const bounds = new kakao.maps.LatLngBounds();
        const path: any[] = [];
        for (const p of coords) {
          const ll = new kakao.maps.LatLng(p.latE7 / 1e7, p.lonE7 / 1e7);
          path.push(ll);
          bounds.extend(ll);
          const marker = new kakao.maps.Marker({ position: ll, map });
          const info = new kakao.maps.InfoWindow({ content: `<div style="padding:4px 8px;font-size:12px;white-space:nowrap">${esc(p.n ? `${p.n}. ${p.label}` : p.label)}</div>` });
          kakao.maps.event.addListener(marker, 'click', () => info.open(map, marker));
        }
        if (path.length > 1) new kakao.maps.Polyline({ path, strokeWeight: 4, strokeColor: '#276EF1', strokeOpacity: 0.85, strokeStyle: 'solid', map });
        if (coords.length > 1) map.setBounds(bounds);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sig, coords]);

  // No key, nothing to plot, or the SDK failed → the no-map SVG sketch (same props, CSP-safe).
  if (!JS_KEY || failed || coords.length === 0) return <RouteSketch plan={plan} home={home} dayIndex={dayIndex} />;

  return (
    <VStack gap={2}>
      <div ref={ref} style={{ width: '100%', height: 240 }} role="img" aria-label={t('sketch.aria', { day: dayIndex })} />
      {noCoords.length > 0 && (
        <Text type="supporting" color="secondary">
          {t('sketch.noCoords', { names: noCoords.join(', ') })}
        </Text>
      )}
    </VStack>
  );
}
