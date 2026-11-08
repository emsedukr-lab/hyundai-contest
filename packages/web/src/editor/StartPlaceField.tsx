import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { Endpoint, Home, Trip } from '@tteonaljido/shared';
import { t } from '../lib/i18n';
import { PRESET_SLOTS, presetLabel, presetPlace } from '../lib/settings';
import { presetInPlan, setOrigin, startFromPreset } from '../lib/trips';

export const endpointValue = (e: Endpoint) => (e.kind === 'HOME' ? 'HOME' : e.placeRef);
export const toEndpoint = (v: string): Endpoint => (v === 'HOME' ? { kind: 'HOME' } : { kind: 'PLACE', placeRef: v });

/**
 * 출발 장소: 집 and the saved places (설정 › 회사, 즐겨찾기 1–3) first — a saved place already in the trip answers to its
 * place — then the trip's other places. A slot not set yet is listed but disabled, pointing at 설정. Shown at the top of
 * a new trip's first sheet and in the day-1 start card's sheet.
 */
export function StartPlaceField({ plan, home, onChange, onOpenSettings }: { plan: Trip; home: Home | null; onChange: (p: Trip) => void; onOpenSettings: () => void }) {
  const [presets] = useState(() => PRESET_SLOTS.filter((s) => s !== 'home').map((slot) => ({ slot, place: presetPlace(slot) })));
  const seen = new Set<string>(['HOME']);
  const savedStarts = [
    { value: 'HOME', label: t('common.home'), description: home ? home.address : t('editor.startPlace.homeUnset') },
    ...presets.flatMap(({ slot, place }) => {
      if (!place) return [{ value: `preset:${slot}`, label: presetLabel(slot), description: t('settings.home.unset'), disabled: true }];
      const value = presetInPlan(plan, place)?.placeRef ?? `preset:${slot}`;
      if (seen.has(value)) return []; // two slots saved as the same place: list it once
      seen.add(value);
      return [{ value, label: `${presetLabel(slot)} · ${place.name}`, description: place.address }];
    }),
  ];
  const tripStarts = plan.places.filter((p) => !seen.has(p.placeRef)).map((p) => ({ value: p.placeRef, label: p.name, description: p.address || undefined }));
  const options = [
    { type: 'section' as const, title: t('editor.startPlace.saved'), options: savedStarts },
    ...(tripStarts.length ? [{ type: 'section' as const, title: t('editor.startPlace.tripPlaces'), options: tripStarts }] : []),
  ];
  const origin = plan.origin;
  const address = origin.kind === 'HOME' ? (home ? home.address : t('editor.startPlace.homeUnset')) : plan.places.find((p) => p.placeRef === origin.placeRef)?.address || undefined;
  const pick = (v: string) => {
    if (v === 'HOME') return onChange(setOrigin(plan, { kind: 'HOME' }));
    const preset = v.startsWith('preset:') ? presets.find((x) => `preset:${x.slot}` === v)?.place : undefined;
    onChange(preset ? startFromPreset(plan, preset) : setOrigin(plan, toEndpoint(v)));
  };

  return (
    <VStack gap={2}>
      <VStack gap={1}>
        <Selector label={t('editor.startPlace')} options={options} value={endpointValue(plan.origin)} onChange={pick} />
        {address && (
          <div style={{ wordBreak: 'keep-all' }}>
            <Text type="supporting">{address}</Text>
          </div>
        )}
      </VStack>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: '1 1 auto', minWidth: 0, wordBreak: 'keep-all' }}>
          {presets.some((x) => !x.place) && (
            <Text type="supporting" color="secondary">
              {t('editor.startPlace.hint')}
            </Text>
          )}
        </div>
        <div style={{ flex: 'none' }}>
          <Button label={t('editor.home.openSettings')} variant="secondary" size="sm" onClick={onOpenSettings} />
        </div>
      </div>
    </VStack>
  );
}
