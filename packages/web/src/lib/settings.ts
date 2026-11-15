import { Home } from '@tteonaljido/shared';
import { t } from './i18n';

/**
 * The one home address, set in 설정 and shared by every trip: route checks, the map, recommendations and — only when
 * the user opts in on that send — what the car receives. A trip's stored `home` is just a copy refreshed on save.
 * Like trips it stays in this browser only.
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

/**
 * Endpoint shortcuts: 집 (the home above, sent as the transfer's HOME endpoint), 회사 and named custom places. They travel as an ordinary trip place once chosen as a start, since the
 * transfer only knows HOME or a place of the trip (schema unchanged).
 */
export const PRESET_SLOTS = ['home', 'work', 'fav1', 'fav2', 'fav3'] as const;
export type PresetSlot = (typeof PRESET_SLOTS)[number] | `place-${string}`;
export type PlaceSlot = Exclude<PresetSlot, 'home'>;
/** A saved start place: the searched place's name plus the home-shaped address and coordinates (always set). */
export type PresetPlace = Home & { name: string };

export const isPresetSlot = (s: string): s is PresetSlot => (PRESET_SLOTS as readonly string[]).includes(s) || /^place-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);

const PRESETS_KEY = 'tteonaljido.originPresets';

function readPresets(): Partial<Record<PlaceSlot, PresetPlace>> {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (!data || typeof data !== 'object') return {};
    const out: Partial<Record<PlaceSlot, PresetPlace>> = {};
    for (const [slot, rawPlace] of Object.entries(data)) {
      if (!isPresetSlot(slot) || slot === 'home') continue;
      const v = rawPlace as Partial<PresetPlace> | undefined;
      const home = Home.safeParse({ address: v?.address, latE7: v?.latE7, lonE7: v?.lonE7 });
      const name = typeof v?.name === 'string' ? v.name.trim().slice(0, 60) : '';
      if (home.success && name) out[slot] = { ...home.data, name };
    }
    return out;
  } catch {
    return {};
  }
}

/** The saved place for a slot, or null. 집 reads the home address (its name is the address itself). */
export function presetPlace(slot: PresetSlot): PresetPlace | null {
  if (slot === 'home') {
    const h = defaultHome();
    return h ? { ...h, name: h.address } : null;
  }
  return readPresets()[slot] ?? null;
}

export function setPresetPlace(slot: PresetSlot, place: PresetPlace | null): void {
  if (slot === 'home') return setDefaultHome(place ? { address: place.address, latE7: place.latE7, lonE7: place.lonE7 } : null);
  try {
    const all = readPresets();
    if (place) {
      const home = Home.parse({ address: place.address.slice(0, 120), latE7: place.latE7, lonE7: place.lonE7 });
      all[slot] = { ...home, name: place.name.trim().slice(0, 60) || home.address.slice(0, 60) };
    } else delete all[slot];
    localStorage.setItem(PRESETS_KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: the setting just isn't kept */
  }
}

/** Home and work are always available; custom and legacy slots appear only once registered. */
export function presetSlots(): PresetSlot[] {
  return ['home', 'work', ...Object.keys(readPresets()).filter((s): s is PlaceSlot => s !== 'work' && isPresetSlot(s))];
}

export function addPresetPlace(place: PresetPlace): PresetSlot {
  const slot: PresetSlot = `place-${crypto.randomUUID()}`;
  setPresetPlace(slot, place);
  if (!presetPlace(slot)) throw new Error(t('settings.preset.failed'));
  return slot;
}

/** Custom names also label the endpoint shortcuts; old fav1–3 addresses remain usable. */
export const presetLabel = (slot: PresetSlot): string =>
  slot === 'home' ? t('common.home') : slot === 'work' ? t('preset.work') : presetPlace(slot)?.name ?? t('settings.preset.new');
