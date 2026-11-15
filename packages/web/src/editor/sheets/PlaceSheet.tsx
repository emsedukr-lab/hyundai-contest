import { Suspense, lazy, useEffect, useState } from 'react';
import { IconButton } from '@astryxdesign/core/IconButton';
import { List, ListItem } from '@astryxdesign/core/List';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Text } from '@astryxdesign/core/Text';
import { TRANSFER_LIMITS, type Trip } from '@tteonaljido/shared';
import { Card } from '../../components/toss/Card';
import { favorites } from '../../lib/db';
import { asNewPlace, favoriteId, type FavoritePlace } from '../../lib/favorites';
import { CloseIcon } from '../../components/shell/icons';
import { placeRegion } from '../../lib/format';
import { t } from '../../lib/i18n';
import type { ResolvedList } from '../../lib/pairing';
import { BulkAddDialog } from '../BulkAddDialog';
import { JS_KEY } from '../../lib/kakaoSdk';
import { lastMode, rememberMode, type CollectMode } from '../../lib/mapPick';
import { REASON_LABEL, addPlace, collectedPlaces, placeRoom, removePlace } from '../../lib/trips';
import { CATEGORY_LABEL, PlaceSearch, type NewPlace } from '../PlaceSearch';
import { Sheet } from '../Sheet';

const CollectedPlacesMap = lazy(() => import('../CollectedPlacesMap').then((m) => ({ default: m.CollectedPlacesMap })));
const PlaceMapPicker = lazy(() => import('../PlaceMapPicker').then((m) => ({ default: m.PlaceMapPicker })));
/** The map SDK failed to load in this tab (offline, blocked): the 지도 toggle stays hidden until a reload. */
let mapBroken = false;

/** A banner message; `undo` adds a 되돌리기 button (e.g. after a stop was swiped off a day). */
export type Notice = { tone: 'success' | 'error' | 'info'; text: string; undo?: () => void; action?: { label: string; onClick: () => void } };

/**
 * Collecting places for a trip (M40/M43) — the body of the + sheet and of the new-trip setup's step 2. Every place goes
 * to the whole trip first ("저장 목록", on no day yet); a day is chosen only in the place's details or by 경로 추천.
 * Top to bottom: a search for new places (several can be collected in a row), the places saved for this trip (tap →
 * details; in setup each has a remove icon), and favorites shared by every trip (tap → saved to this trip).
 */
export function PlaceCollector({
  plan,
  onChange,
  onOpenPlace,
  onNotice,
  onBulkDone,
  onRecommend,
  onRemovePlace,
  importReview,
  onImportClose,
}: {
  importReview?: { terms?: string[]; list?: ResolvedList } | null;
  onImportClose?: () => void;
  plan: Trip;
  onChange: (p: Trip) => void;
  onOpenPlace: (ref: string) => void;
  onNotice: (n: Notice) => void;
  /** After a pasted batch was saved (the sheet closes). */
  onBulkDone?: () => void;
  /** Editor: the batch's notice offers 경로 추천으로 날짜 나누기 (setup recommends in its own step 4). */
  onRecommend?: () => void;
  /** Setup: remove a collected place from the trip. */
  onRemovePlace?: (placeRef: string) => void;
}) {
  const [added, setAdded] = useState<string | null>(null);
  const [favs, setFavs] = useState<FavoritePlace[]>([]);
  const [favVersion, setFavVersion] = useState(0);
  useEffect(() => {
    void favorites.all().then(setFavs);
  }, [favVersion]);
  // Newest first: what was just added sits right under the search.
  const pool = [...collectedPlaces(plan)].reverse();
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
    else onNotice({ tone: 'success', text: t('tl.addedMany', { n: fit.length }), action: onRecommend ? { label: t('tl.recommendSplit'), onClick: onRecommend } : undefined });
    onBulkDone?.();
  };
  const unfavorite = async (id: string) => {
    await favorites.remove(id);
    setFavVersion((v) => v + 1);
  };

  // 목록 | 지도 (지도에서 보고 담기): only offered where the Kakao map can load; the last choice holds for this tab.
  const [mode, setModeState] = useState<CollectMode>(() => (JS_KEY && !mapBroken ? lastMode() : 'list'));
  const canMap = !!JS_KEY && !mapBroken;
  const [searchingMap, setSearchingMap] = useState(false);
  const setMode = (m: CollectMode) => {
    setModeState(m);
    rememberMode(m);
  };
  /** 담기 on the map: saved like a search pick; returns the new placeRef so the map can offer 되돌리기. */
  const saveFromMap = (p: NewPlace): string | null => {
    if (placeRoom(plan) <= 0) return (full(), null);
    const next = addPlace(plan, p);
    onChange(next);
    setAdded(p.category === 'LODGING' ? t('tl.addedKept', { name: p.name }) : t('tl.addedSaved', { name: p.name }));
    return next.places[next.places.length - 1].placeRef;
  };
  const toggle = canMap ? (
    <SegmentedControl label={t('mapPick.view')} value={mode} onChange={(v) => setMode(v as CollectMode)}>
      <SegmentedControlItem value="list" label={t('mapPick.list')} />
      <SegmentedControlItem value="map" label={t('mapPick.map')} />
    </SegmentedControl>
  ) : null;

  return (
    <>
      {importReview && (
        <BulkAddDialog
          isOpen
          {...importReview}
          existing={plan.places}
          room={placeRoom(plan)}
          lodgingOnly={false}
          onClose={() => onImportClose?.()}
          onAdd={pickMany}
        />
      )}
      <PlaceSearch
        isLabelHidden
        placeholder={t('place.search')}
        onPick={save}
        onPickMany={pickMany}
        tripPlaces={plan.places}
        room={placeRoom(plan)}
        hideFavorites
        favoritesVersion={favVersion}
        onFavoritesChange={() => setFavVersion((v) => v + 1)}
        onOpenMap={canMap ? () => setSearchingMap(true) : undefined}
      />
      {added && <div role="status" className="tl-added-line">{added}</div>}

      <div className="pc-saved-head">
        <h3 className="tl-sheet-section">{t('tl.savedCount', { n: pool.length })}</h3>
        {toggle}
      </div>
      {pool.length === 0 ? (
        <Text type="supporting" color="secondary">{t('tl.poolEmpty')}</Text>
      ) : canMap && mode === 'map' ? (
        <Suspense fallback={<span className="tl-map-wait" />}>
          <CollectedPlacesMap places={pool} onPick={onOpenPlace} onMapFailed={() => {
            mapBroken = true;
            setModeState('list');
            onNotice({ tone: 'info', text: t('mapPick.savedFailed') });
          }} />
        </Suspense>
      ) : (
        <Card pad={0}>
          <List hasDividers>
            {pool.map((p) => {
              const visit = plan.visits.find((v) => v.placeRef === p.placeRef);
              const reason = visit?.unassignedReason && visit.unassignedReason !== 'NOT_SCHEDULED_YET' ? REASON_LABEL[visit.unassignedReason] : '';
              return <ListItem
                key={p.placeRef}
                label={p.name}
                description={[CATEGORY_LABEL[p.category], placeRegion(p.address), reason, visit?.fixed ? t('common.fixedAt', { time: visit.fixed.time }) : ''].filter(Boolean).join(' · ')}
                onClick={() => onOpenPlace(p.placeRef)}
                endContent={onRemovePlace ? (
                  <button type="button" className="tn-iconbtn pc-remove" aria-label={t('place.removeNamed', { name: p.name })} onClick={(e) => {
                    e.stopPropagation();
                    onRemovePlace(p.placeRef);
                  }}><CloseIcon /></button>
                ) : undefined}
              />;
            })}
          </List>
        </Card>
      )}
      {searchingMap && (
        <Sheet isOpen onClose={() => setSearchingMap(false)} title={t('mapPick.searchNew')} height="tall">
          <Suspense fallback={<span className="tl-map-wait" />}>
            <PlaceMapPicker
              plan={plan}
              onAdd={saveFromMap}
              onUndo={(ref) => { onChange(removePlace(plan, ref)); setAdded(null); }}
              onUnavailable={() => {
                setSearchingMap(false);
                onNotice({ tone: 'info', text: t('mapPick.off') });
              }}
              onMapFailed={() => {
                mapBroken = true;
                setSearchingMap(false);
                onNotice({ tone: 'info', text: t('mapPick.mapFailed') });
              }}
              primary={false}
            />
          </Suspense>
        </Sheet>
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
    </>
  );
}

/** The floating + button's sheet: collecting places for the trip (see PlaceCollector). */
export function PlaceSheet({
  isOpen,
  onClose,
  plan,
  onChange,
  onOpenPlace,
  onNotice,
  onRecommend,
}: {
  isOpen: boolean;
  onClose: () => void;
  plan: Trip;
  onChange: (p: Trip) => void;
  onOpenPlace: (ref: string) => void;
  onNotice: (n: Notice) => void;
  /** Opens 경로 추천 (offered after a pasted batch). */
  onRecommend?: () => void;
}) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={t('tl.placeSheet')} height="tall">
      <PlaceCollector plan={plan} onChange={onChange} onOpenPlace={onOpenPlace} onNotice={onNotice} onBulkDone={onClose} onRecommend={onRecommend} />
    </Sheet>
  );
}
