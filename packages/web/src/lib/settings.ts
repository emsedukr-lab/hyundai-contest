import { Home } from '@tteonaljido/shared';

/**
 * The home address set ahead of time in 설정. New trips start with it (the editor's new trip, places collected from a
 * share, samples); an existing trip only gets it when the user applies it in the editor. Like trips it stays in this
 * browser only, and whether it goes to the car is still asked on every send.
 *
 * One small value, so it lives in localStorage rather than a new IndexedDB store (a schema bump can stall while
 * another tab holds the old version open). It is validated with the shared transfer schema on every read, so a
 * corrupted entry never reaches a trip.
 */
const KEY = 'tteonaljido.defaultHome';

export function defaultHome(): Home | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = Home.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // storage blocked (private mode) or unreadable
  }
}

export function setDefaultHome(home: Home | null): void {
  try {
    if (home) localStorage.setItem(KEY, JSON.stringify(Home.parse({ ...home, address: home.address.slice(0, 120) })));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the setting just isn't kept */
  }
}
