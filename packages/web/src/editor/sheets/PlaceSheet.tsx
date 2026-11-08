import { Button } from '@astryxdesign/core/Button';
import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import type { Trip } from '@tteonaljido/shared';
import { Card } from '../../components/toss/Card';
import { t } from '../../lib/i18n';
import { REASON_LABEL, addPlace, addToDay, assign, placeOf, unassignedVisits } from '../../lib/trips';
import { CATEGORY_LABEL, PlaceSearch, type NewPlace } from '../PlaceSearch';
import { Sheet } from '../Sheet';

export type Notice = { tone: 'success' | 'error' | 'info'; text: string };

/**
 * "+ 장소 추가" and 보관함 in one sheet: places already collected for this trip but on no day (tap → end of the day being
 * viewed), then a search for new ones (one pick goes onto the day; a pasted batch is saved to the 보관함).
 */
export function PlaceSheet({ isOpen, onClose, plan, dayIndex, onChange, onOpenPlace, onNotice }: { isOpen: boolean; onClose: () => void; plan: Trip; dayIndex: number; onChange: (p: Trip) => void; onOpenPlace: (ref: string) => void; onNotice: (n: Notice) => void }) {
  const pool = unassignedVisits(plan);
  const nameOf = (ref: string) => placeOf(plan, ref)?.name ?? '';

  const put = (visitId: string, placeRef: string) => {
    try {
      onChange(assign(plan, visitId, dayIndex));
      onNotice({ tone: 'success', text: t('tl.added', { name: nameOf(placeRef), day: dayIndex }) });
      onClose();
    } catch (e) {
      onNotice({ tone: 'error', text: (e as Error).message });
    }
  };
  const pickNew = (p: NewPlace) => {
    const r = addToDay(plan, p, dayIndex);
    onChange(r.plan);
    const name = p.name;
    if (r.placed === 'day') onNotice({ tone: 'success', text: t('tl.added', { name, day: dayIndex }) });
    else if (r.placed === 'lodging') onNotice({ tone: 'success', text: t('tl.addedLodging', { name, day: dayIndex }) });
    else if (r.placed === 'kept') onNotice({ tone: 'info', text: t('tl.addedKept', { name }) });
    else onNotice({ tone: 'info', text: t('tl.addedPool', { name, reason: r.reason ?? '' }) });
    onClose();
  };
  const pickMany = (places: NewPlace[]) => {
    onChange(places.reduce((pl, p) => addPlace(pl, p), plan));
    onNotice({ tone: 'success', text: t('tl.addedMany', { n: places.length }) });
    onClose();
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={t('tl.placeSheet')} height="tall">
      <h3 className="tl-sheet-section">{t('tl.poolTitle')}</h3>
      {pool.length === 0 ? (
        <Text type="supporting" color="secondary">
          {t('tl.poolEmpty')}
        </Text>
      ) : (
        <>
          <Text type="supporting" color="secondary">
            {t('tl.poolHint', { day: dayIndex })}
          </Text>
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
      <PlaceSearch onPick={pickNew} onPickMany={pickMany} />
    </Sheet>
  );
}
