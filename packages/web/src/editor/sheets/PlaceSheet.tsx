import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { List, ListItem } from '@astryxdesign/core/List';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { TRANSFER_LIMITS, type Trip } from '@tteonaljido/shared';
import { Card } from '../../components/toss/Card';
import { shortDate } from '../../lib/format';
import { t } from '../../lib/i18n';
import { REASON_LABEL, addPlace, addToDay, assign, placeOf, placeRoom, unassignedVisits } from '../../lib/trips';
import { CATEGORY_LABEL, PlaceSearch, type NewPlace } from '../PlaceSearch';
import { Sheet } from '../Sheet';

/** A banner message; `undo` adds a 되돌리기 button (e.g. after a stop was swiped off a day). */
export type Notice = { tone: 'success' | 'error' | 'info'; text: string; undo?: () => void };

/**
 * The floating + button's sheet: which day to add to (the day in view by default), then the places already collected
 * for this trip but on no day (tap → end of that day), then a search for new ones (one pick goes onto the day; a pasted
 * batch is saved to the 보관함). After an add the sheet closes and the page scrolls to that day.
 */
export function PlaceSheet({
  isOpen,
  onClose,
  plan,
  initialDay,
  onChange,
  onOpenPlace,
  onNotice,
  onAdded,
}: {
  isOpen: boolean;
  onClose: () => void;
  plan: Trip;
  initialDay: number;
  onChange: (p: Trip) => void;
  onOpenPlace: (ref: string) => void;
  onNotice: (n: Notice) => void;
  onAdded: (day: number) => void;
}) {
  const [dayIndex, setDayIndex] = useState(initialDay);
  const pool = unassignedVisits(plan);
  const nameOf = (ref: string) => placeOf(plan, ref)?.name ?? '';

  const put = (visitId: string, placeRef: string) => {
    try {
      onChange(assign(plan, visitId, dayIndex));
      onNotice({ tone: 'success', text: t('tl.added', { name: nameOf(placeRef), day: dayIndex }) });
      onClose();
      onAdded(dayIndex);
    } catch (e) {
      onNotice({ tone: 'error', text: (e as Error).message });
    }
  };
  const full = () => onNotice({ tone: 'error', text: t('trip.placeLimit', { n: TRANSFER_LIMITS.maxPlaces }) });
  const pickNew = (p: NewPlace) => {
    if (placeRoom(plan) <= 0) return full();
    const r = addToDay(plan, p, dayIndex);
    onChange(r.plan);
    const name = p.name;
    if (r.placed === 'day') onNotice({ tone: 'success', text: t('tl.added', { name, day: dayIndex }) });
    else if (r.placed === 'lodging') onNotice({ tone: 'success', text: t('tl.addedLodging', { name, day: dayIndex }) });
    else if (r.placed === 'kept') onNotice({ tone: 'info', text: t('tl.addedKept', { name }) });
    else onNotice({ tone: 'info', text: t('tl.addedPool', { name, reason: r.reason ?? '' }) });
    onClose();
    if (r.placed === 'day' || r.placed === 'lodging') onAdded(dayIndex);
  };
  const pickMany = (places: NewPlace[]) => {
    const fit = places.slice(0, placeRoom(plan)); // the rest would break the trip's 100-place limit
    if (!fit.length) return full();
    onChange(fit.reduce((pl, p) => addPlace(pl, p), plan));
    if (fit.length < places.length) full();
    else onNotice({ tone: 'success', text: t('tl.addedMany', { n: fit.length }) });
    onClose();
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={t('tl.placeSheet')} height="tall">
      <Selector
        label={t('tl.targetDay')}
        isLabelHidden
        placement="below"
        options={plan.days.map((d) => ({ value: String(d.dayIndex), label: `${t('common.day', { day: d.dayIndex })} · ${shortDate(d.date)}` }))}
        value={String(dayIndex)}
        onChange={(v) => setDayIndex(Number(v))}
      />
      <h3 className="tl-sheet-section">{t('tl.poolTitle')}</h3>
      {pool.length === 0 ? (
        <Text type="supporting" color="secondary">
          {t('tl.poolEmpty')}
        </Text>
      ) : (
        <>
          <Card pad={0}>
            <List hasDividers>
              {pool.map((v) => {
                const p = placeOf(plan, v.placeRef);
                const bits = [p ? CATEGORY_LABEL[p.category] : '', REASON_LABEL[v.unassignedReason ?? 'NOT_SCHEDULED_YET'], v.fixed ? `${t('common.fixedAt', { time: v.fixed.time })} · ${t('tl.fixedPool')}` : ''].filter(Boolean);
                return (
                  <ListItem
                    key={v.visitId}
                    label={p?.name ?? v.visitId}
                    description={bits.join(' · ')}
                    onClick={() => put(v.visitId, v.placeRef)}
                    endContent={
                      <Button
                        label={t('days.details')}
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPlace(v.placeRef);
                        }}
                      />
                    }
                  />
                );
              })}
            </List>
          </Card>
        </>
      )}
      <h3 className="tl-sheet-section" style={{ marginTop: 8 }}>
        {t('tl.searchNew')}
      </h3>
      <PlaceSearch isLabelHidden placeholder={t('place.search')} onPick={pickNew} onPickMany={pickMany} />
    </Sheet>
  );
}
