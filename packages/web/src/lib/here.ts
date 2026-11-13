/**
 * The phone's own position, for timing a trip that starts "where I am" (출발 장소 '현재 위치', M61).
 *
 * Asked only when the user starts something that needs it — choosing 현재 위치, 경로 추천, 현재 위치로 계산 — or
 * silently when the browser already holds the permission. Kept in memory for this session only: never stored, never
 * written into a trip, never sent to the car (the car times the first leg again from its own position). Rounded to
 * about 100 m before use: as one end of a drive that changes nothing, and the relay and Kakao directions see no more.
 */
export interface HerePoint {
  latE7: number;
  lonE7: number;
}

export type LocateResult = { ok: true; point: HerePoint } | { ok: false; reason: 'unsupported' | 'denied' | 'unavailable' };

let here: HerePoint | null = null;
const listeners = new Set<(p: HerePoint | null) => void>();

/** 0.001° of latitude is about 111 m. The result is an integer in 1e-7 degrees, as the relay expects. */
export const roundE7 = (deg: number) => Math.round(deg * 1e3) * 1e4;

export const getHere = (): HerePoint | null => here;

export function setHere(p: HerePoint | null): void {
  here = p;
  listeners.forEach((f) => f(p));
}

/** Tells a screen when the position arrives (or is cleared); returns the unsubscribe. */
export function onHere(f: (p: HerePoint | null) => void): () => void {
  listeners.add(f);
  return () => void listeners.delete(f);
}

/** Asks the device where it is. The browser shows its own permission prompt the first time. */
export function locate(timeoutMs = 10_000): Promise<LocateResult> {
  return new Promise((resolve) => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo) return resolve({ ok: false, reason: 'unsupported' });
    // Some browsers never answer when the prompt is left open: stop waiting a little after the API's own timeout.
    const giveUp = setTimeout(() => resolve({ ok: false, reason: 'unavailable' }), timeoutMs + 2_000);
    geo.getCurrentPosition(
      (pos) => {
        clearTimeout(giveUp);
        const point = { latE7: roundE7(pos.coords.latitude), lonE7: roundE7(pos.coords.longitude) };
        setHere(point);
        resolve({ ok: true, point });
      },
      (err) => {
        clearTimeout(giveUp);
        resolve({ ok: false, reason: err.code === 1 ? 'denied' : 'unavailable' }); // 1 = PERMISSION_DENIED
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60_000 },
    );
  });
}

/** The position without ever prompting: only when this browser already granted it (or it is known from this session). */
export async function locateIfAllowed(): Promise<HerePoint | null> {
  if (here) return here;
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    if (status?.state !== 'granted') return null;
  } catch {
    return null;
  }
  const r = await locate();
  return r.ok ? r.point : null;
}
