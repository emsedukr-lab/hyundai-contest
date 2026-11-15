import { useState } from 'react';
import { ToastNotice } from '../components/ToastNotice';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { PushScreen } from '../components/shell/Screens';
import { Card } from '../components/toss/Card';
import { PlaceSearch, type NewPlace } from '../editor/PlaceSearch';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { addPresetPlace, presetLabel, presetPlace, setPresetPlace, type PresetPlace, type PresetSlot } from '../lib/settings';

/** One saved endpoint, edited as a draft so an address and its custom name are saved together. */
export function StartPlacePage({ slot }: { slot: PresetSlot | 'new' }) {
  const custom = slot !== 'home' && slot !== 'work';
  const label = slot === 'new' ? t('settings.preset.add') : presetLabel(slot);
  const [place, setPlace] = useState<PresetPlace | null>(() => slot === 'new' ? null : presetPlace(slot));
  const [name, setName] = useState(() => place?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const pick = (p: NewPlace) => {
    if (p.latE7 === null || p.lonE7 === null) return setError(t('editor.home.needsSearch'));
    setPlace({ name: p.name, address: (p.address || p.name).slice(0, 120), latE7: p.latE7, lonE7: p.lonE7 });
    setName((old) => custom && old.trim() ? old : p.name);
    setError(null);
  };
  const save = () => {
    if (!place || (custom && !name.trim())) return;
    try {
      const next = { ...place, name: custom ? name.trim().slice(0, 60) : place.name };
      if (slot === 'new') addPresetPlace(next);
      else {
        setPresetPlace(slot, next);
        const stored = presetPlace(slot);
        if (!stored || stored.address !== next.address || stored.latE7 !== next.latE7 || stored.lonE7 !== next.lonE7 || (custom && stored.name !== next.name)) throw new Error('not saved');
      }
      navigate('/settings');
    } catch { setError(t('settings.preset.failed')); }
  };
  const clear = () => {
    if (slot === 'new') { setPlace(null); return; }
    setPresetPlace(slot, null);
    if (presetPlace(slot)) return setError(t('settings.preset.failed'));
    navigate('/settings');
  };
  return (
    <PushScreen title={label} onBack={() => navigate('/settings')} cta={<Button label={t('settings.preset.save')} variant="primary" size="lg" width="100%" isDisabled={!place || (custom && !name.trim())} onClick={save} />}>
      <div className="tn-intro"><p>{t('settings.origins.detail2')}</p></div>
      <div className="tn-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <ToastNotice status="error" title={error} isDismissable onDismiss={() => setError(null)} />}
        {custom && <TextInput label={t('settings.preset.name')} value={name} onChange={(v) => setName(v.slice(0, 60))} placeholder={t('settings.preset.nameHint')} />}
        {place && <Card>
          <strong>{slot === 'home' ? t('common.home') : custom ? name || place.name : place.name}</strong>
          <p className="tl-meta">{place.address}</p>
          <Button label={slot === 'new' ? t('common.cancel') : t(custom ? 'settings.preset.delete' : 'settings.preset.clear')} variant="secondary" size="sm" onClick={clear} />
        </Card>}
        <PlaceSearch label={place ? t('settings.home.change') : t('endpoint.search')} placeholder={t('endpoint.search')} requireCoords onPick={pick} />
      </div>
    </PushScreen>
  );
}
