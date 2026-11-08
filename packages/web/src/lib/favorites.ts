import type { NewPlace } from '../editor/PlaceSearch';

/**
 * 즐겨찾는 장소 (saved places) kept in this browser only — like trips, they never leave the device.
 * A favorite is a `NewPlace` plus bookkeeping (`id`, `addedAt`). When a favorite is added to a trip it must be
 * reduced back to a plain `NewPlace` with {@link asNewPlace}: the transfer schema is `additionalProperties:false`,
 * so the extra `id`/`addedAt` fields would make the car reject the trip.
 */
export type FavoritePlace = NewPlace & { id: string; addedAt: number };

/** A stable key so the same place saved twice overwrites instead of duplicating. */
export function favoriteId(p: NewPlace): string {
  if (p.source.provider === 'KAKAO' && p.source.externalId) return `kakao:${p.source.externalId}`;
  if (p.latE7 !== null && p.lonE7 !== null) return `geo:${p.name}|${p.latE7}|${p.lonE7}`;
  return `name:${p.name}`;
}

export const toFavorite = (p: NewPlace): FavoritePlace => ({ ...p, id: favoriteId(p), addedAt: Date.now() });

/** Only the transfer-schema place fields, so a favorite can be handed to `addPlace` without polluting the plan. */
export const asNewPlace = (f: FavoritePlace): NewPlace => ({
  name: f.name,
  address: f.address,
  latE7: f.latE7,
  lonE7: f.lonE7,
  category: f.category,
  source: f.source,
  naviPoi: f.naviPoi,
  hours: f.hours,
});
