import { useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { List, ListItem } from '@astryxdesign/core/List';
import type { Endpoint, Home, Trip } from '@tteonaljido/shared';
import { ChevronIcon } from '../components/shell/icons';
import { t } from '../lib/i18n';
import { presetSlots, presetLabel, presetPlace } from '../lib/settings';
import { endpointFromPreset, setEndpoint, type EndpointSide } from '../lib/trips';
import { PlaceSearch } from './PlaceSearch';
import { Sheet } from './Sheet';

export const endpointValue = (e: Endpoint) => (e.kind === 'PLACE' ? e.placeRef : e.kind);
export const toEndpoint = (v: string): Endpoint => (v === 'HOME' ? { kind: 'HOME' } : v === 'CURRENT' ? { kind: 'CURRENT' } : { kind: 'PLACE', placeRef: v });

/** One control for each endpoint: saved choices and direct search share a sheet. */
export function EndpointField({ which, plan, home, onChange, onOpenSettings, label, isLabelHidden = false, compact = false }: {
  which: EndpointSide;
  plan: Trip;
  home: Home | null;
  onChange: (p: Trip) => void;
  onOpenSettings: () => void;
  label?: string;
  isLabelHidden?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const presets = presetSlots().filter((s) => s !== 'home').flatMap((slot) => {
    const place = presetPlace(slot);
    return place ? [{ slot, place }] : [];
  });
  const current = plan[which];
  const fieldLabel = label ?? (which === 'origin' ? t('editor.startPlace') : t('tl.endPlace'));
  const chosen = current.kind === 'CURRENT' ? t('endpoint.current') : current.kind === 'HOME' ? t('common.home') : plan.places.find((p) => p.placeRef === current.placeRef)?.name ?? t('common.place');
  const apply = (update: () => Trip) => {
    try { onChange(update()); setOpen(false); setError(null); }
    catch (e) { setError((e as Error).message); }
  };
  return (
    <div>
      {!compact && !isLabelHidden && <span className="tl-kicker">{fieldLabel}</span>}
      <button type="button" className="ti-endpoint-button" aria-label={`${fieldLabel} · ${chosen}${current.kind === 'HOME' && home ? ` · ${home.address}` : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <span>{chosen}</span><ChevronIcon />
      </button>
      <Sheet isOpen={open} onClose={() => setOpen(false)} title={fieldLabel}>
        {error && <Banner status="error" title={error} />}
        <div className="tn-btnrow">
          {which === 'origin' && <Button label={t('endpoint.current')} variant="secondary" onClick={() => apply(() => setEndpoint(plan, which, { kind: 'CURRENT' }))} />}
          <Button label={t('common.home')} variant="secondary" onClick={() => apply(() => setEndpoint(plan, which, { kind: 'HOME' }))} />
          {presets.map(({ slot, place }) => <Button key={slot} label={presetLabel(slot)} variant="secondary" onClick={() => apply(() => endpointFromPreset(plan, which, place))} />)}
        </div>
        {which === 'origin' && <p className="tl-meta">{t('endpoint.currentHint')}</p>}
        <PlaceSearch compact requireCoords hideFavorites label={t('endpoint.search')} placeholder={t('endpoint.search')} onPick={(place) => {
          const { latE7, lonE7 } = place;
          if (latE7 === null || lonE7 === null) return setError(t('endpoint.needLocation'));
          apply(() => endpointFromPreset(plan, which, { name: place.name, address: place.address, latE7, lonE7 }));
        }} />
        {plan.places.length > 0 && <List hasDividers>
          {plan.places.map((p) => <ListItem key={p.placeRef} label={p.name} description={p.address} onClick={() => apply(() => setEndpoint(plan, which, { kind: 'PLACE', placeRef: p.placeRef }))} />)}
        </List>}
        <Button label={t('editor.home.openSettings')} variant="secondary" onClick={() => { setOpen(false); onOpenSettings(); }} />
      </Sheet>
    </div>
  );
}
