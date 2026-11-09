import { useEffect, useState } from 'react';
import { IconButton } from '@astryxdesign/core/IconButton';
import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { TRANSFER_LIMITS, type Trip } from '@tteonaljido/shared';
import { Card } from '../../components/toss/Card';
import { favorites } from '../../lib/db';
import { asNewPlace, favoriteId, type FavoritePlace } from '../../lib/favorites';
import { t } from '../../lib/i18n';
import { REASON_LABEL, addPlace, placeOf, placeRoom, unassignedVisits } from '../../lib/trips';
import { CATEGORY_LABEL, PlaceSearch, type NewPlace } from '../PlaceSearch';
import { Sheet } from '../Sheet';

/** A banner message; `undo` adds a 되돌리기 button (e.g. after a stop was swiped off a day). */
export type Notice = { tone: 'success' | 'error' | 'info'; text: string; undo?: () => void };

/**
 * The floating + button's sheet (M40): every place goes to the whole trip first — "저장 목록", on no day yet — and a
 * day is chosen only in the place's details (or all at once with 경로 추천). Top to bottom: a search for new places
 * (the sheet stays open so several can be collected in a row), the places saved for this trip (tap → details, where
 * the day is set), and favorites shared by every trip (tap → saved to this trip).
 */
export function PlaceSheet({
  isOpen,
  onClose,
  plan,
  onChange,
  onOpenPlace,
  onNotice,
}: {
  isOpen: boolean;
  onClose: () => void;
  plan: Trip;
  onChange: (p: Trip) => void;
  onOpenPlace: (ref: string) => void;
  onNotice: (n: Notice) => void;
}) {
  const [added, setAdded] = useState<string | null>(null);
  const [favs, setFavs] = useState<FavoritePlace[]>([]);
  const [favVersion, setFavVersion] = useState(0);
  useEffect(() => {
    if (isOpen) void favorites.all().then(setFavs);
  }, [isOpen, favVersion]);
  // Newest first: what was just added sits right under the search.
  const pool = [...unassignedVisits(plan)].reverse();
  const inTrip = new Set(plan.places.map((p) => favoriteId(p)));

  const full = () => onNotice({ tone: 'error', text: t('trip.placeLimit', { n: TRANSFER_LIMITS.maxPlaces }) });
  /** Saves a place to the whole trip (lodging joins the lodging list); the sheet stays open for the next one. */
  const save = (p: NewPlace) => {
    if (placeRoom(plan) <= 0) return full();
    onChange(addPlace(plan, p));
    setAdded(p.category === 'LODGING' ? t('tl.addedKept', { name: p.name }) : t('tl.addedSaved', { name: p.name }));
  };
  const pickMany = (places: NewPlace[]) => {
    const fit = places.slice(0, placeRoom(plan)); // the rest would break the trip's 100-place limit
    if (!fit.length) return full();
    onChange(fit.reduce((pl, p) => addPlace(pl, p), plan));
    if (fit.length < places.length) full();
    else onNotice({ tone: 'success', text: t('tl.addedMany', { n: fit.length }) });
    onClose();
  };
  const unfavorite = async (id: string) => {
    await favorites.remove(id);
    setFavVersion((v) => v + 1);
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={t('tl.placeSheet')} height="tall">
      <h3 className="tl-sheet-section">{t('tl.searchNew')}</h3>
      <PlaceSearch
        isLabelHidden
        placeholder={t('place.search')}
        onPick={save}
        onPickMany={pickMany}
        hideFavorites
        favoritesVersion={favVersion}
        onFavoritesChange={() => setFavVersion((v) => v + 1)}
      />
      <div role="status" className="tl-added-line">
        {added}
      </div>

      <h3 className="tl-sheet-section" style={{ marginTop: 8 }}>
        {t('tl.savedList')}
      </h3>
      {pool.length === 0 ? (
        <Text type="supporting" color="secondary">
          {t('tl.poolEmpty')}
        </Text>
      ) : (
        <Card pad={0}>
          <List hasDividers>
            {pool.map((v) => {
              const p = placeOf(plan, v.placeRef);
              const bits = [p ? CATEGORY_LABEL[p.category] : '', REASON_LABEL[v.unassignedReason ?? 'NOT_SCHEDULED_YET'], v.fixed ? `${t('common.fixedAt', { time: v.fixed.time })} · ${t('tl.fixedPool')}` : ''].filter(Boolean);
              // The day is set in the place's details.
              return <ListItem key={v.visitId} label={p?.name ?? v.visitId} description={bits.join(' · ')} onClick={() => onOpenPlace(v.placeRef)} />;
            })}
          </List>
        </Card>
      )}

      <h3 className="tl-sheet-section" style={{ marginTop: 8 }}>
        {t('tl.favorites')}
      </h3>
      {favs.length === 0 ? (
        <Text type="supporting" color="secondary">
          {t('tl.favoritesEmpty')}
        </Text>
      ) : (
        <Card pad={0}>
          <List hasDividers>
            {favs.map((f) => {
              const already = inTrip.has(f.id);
              return (
                <ListItem
                  key={f.id}
                  label={f.name}
                  description={[CATEGORY_LABEL[f.category], already ? t('tl.inTrip') : f.address].filter(Boolean).join(' · ')}
                  onClick={already ? undefined : () => save(asNewPlace(f))}
                  endContent={
                    <IconButton
                      label={t('favorites.remove')}
                      icon={<span aria-hidden="true">★</span>}
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void unfavorite(f.id);
                      }}
                    />
                  }
                />
              );
            })}
          </List>
        </Card>
      )}
    </Sheet>
  );
}
