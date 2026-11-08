import { useState } from 'react';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Selector } from '@astryxdesign/core/Selector';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { Endpoint, Home, Trip } from '@tteonaljido/shared';
import { PencilIcon } from '../components/shell/icons';
import { t } from '../lib/i18n';
import { PRESET_SLOTS, presetLabel, presetPlace } from '../lib/settings';
import { endpointFromPreset, presetInPlan, setEndpoint, type EndpointSide } from '../lib/trips';

export const endpointValue = (e: Endpoint) => (e.kind === 'HOME' ? 'HOME' : e.placeRef);
export const toEndpoint = (v: string): Endpoint => (v === 'HOME' ? { kind: 'HOME' } : { kind: 'PLACE', placeRef: v });

/**
 * One end of the trip — 출발 장소 or 귀가 시 도착 장소. 집 and the saved places (설정 › 회사, 즐겨찾기 1–3) come first;
 * a saved place already in the trip answers to its place; then the trip's other places. A slot not set yet is listed
 * but disabled. The pencil beside the select opens 설정, where those places are kept.
 */
export function EndpointField({
  which,
  plan,
  home,
  onChange,
  onOpenSettings,
  label,
  isLabelHidden = false,
  compact = false,
}: {
  which: EndpointSide;
  plan: Trip;
  home: Home | null;
  onChange: (p: Trip) => void;
  onOpenSettings: () => void;
  label?: string;
  /** Hide the select's visible label when a section title above already says it (kept for screen readers). */
  isLabelHidden?: boolean;
  /** The concise editor form: no visible label (the card or sheet around it says which end), no address or hint lines. */
  compact?: boolean;
}) {
  const [presets] = useState(() => PRESET_SLOTS.filter((s) => s !== 'home').map((slot) => ({ slot, place: presetPlace(slot) })));
  const seen = new Set<string>(['HOME']);
  const savedPlaces = [
    { value: 'HOME', label: t('common.home'), description: home ? home.address : t('editor.startPlace.homeUnset') },
    ...presets.flatMap(({ slot, place }) => {
      if (!place) return [{ value: `preset:${slot}`, label: presetLabel(slot), description: t('settings.home.unset'), disabled: true }];
      const value = presetInPlan(plan, place)?.placeRef ?? `preset:${slot}`;
      if (seen.has(value)) return []; // two slots saved as the same place: list it once
      seen.add(value);
      return [{ value, label: `${presetLabel(slot)} · ${place.name}`, description: place.address }];
    }),
  ];
  const tripPlaces = plan.places.filter((p) => !seen.has(p.placeRef)).map((p) => ({ value: p.placeRef, label: p.name, description: p.address || undefined }));
  const options = [
    { type: 'section' as const, title: which === 'origin' ? t('editor.startPlace.saved') : t('tl.savedEndPlaces'), options: savedPlaces },
    ...(tripPlaces.length ? [{ type: 'section' as const, title: t('editor.startPlace.tripPlaces'), options: tripPlaces }] : []),
  ];
  const current = plan[which];
  const address = current.kind === 'HOME' ? (home ? home.address : t('editor.startPlace.homeUnset')) : plan.places.find((p) => p.placeRef === current.placeRef)?.address || undefined;
  const pick = (v: string) => {
    if (v === 'HOME') return onChange(setEndpoint(plan, which, { kind: 'HOME' }));
    const preset = v.startsWith('preset:') ? presets.find((x) => `preset:${x.slot}` === v)?.place : undefined;
    onChange(preset ? endpointFromPreset(plan, which, preset) : setEndpoint(plan, which, toEndpoint(v)));
  };
  const fieldLabel = label ?? (which === 'origin' ? t('editor.startPlace') : t('tl.endPlace'));

  return (
    <VStack gap={1}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <Selector
            label={fieldLabel}
            isLabelHidden={isLabelHidden || compact}
            placement="below"
            options={options}
            value={endpointValue(current)}
            onChange={pick}
          />
        </div>
        <div style={{ flex: 'none' }}>
          <IconButton label={t('editor.home.openSettings')} icon={<PencilIcon />} variant={compact ? 'ghost' : 'secondary'} size="md" onClick={onOpenSettings} />
        </div>
      </div>
      {!compact && address && (
        <div style={{ wordBreak: 'keep-all' }}>
          <Text type="supporting">{address}</Text>
        </div>
      )}
      {!compact && presets.some((x) => !x.place) && (
        <div style={{ wordBreak: 'keep-all' }}>
          <Text type="supporting" color="secondary">
            {t('editor.startPlace.hint')}
          </Text>
        </div>
      )}
    </VStack>
  );
}
