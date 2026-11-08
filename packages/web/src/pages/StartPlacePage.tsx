import { useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { PresetIcon } from '../components/shell/icons';
import { PushScreen } from '../components/shell/Screens';
import { Card } from '../components/toss/Card';
import { PlaceSearch, type NewPlace } from '../editor/PlaceSearch';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { presetLabel, presetPlace, setPresetPlace, type PresetPlace, type PresetSlot } from '../lib/settings';

/**
 * 설정 › 출발 장소 › one slot (집, 회사, 즐겨찾기 1–3): set it once, ahead of time, then pick it at the top of a new trip.
 * Only a search result can be saved — the car needs real coordinates, so name-only entry is hidden (`requireCoords`).
 * 집 is the one home address every trip shares; the other four join a trip as a place when chosen as its start.
 */
export function StartPlacePage({ slot }: { slot: PresetSlot }) {
  const isHome = slot === 'home';
  const label = presetLabel(slot);
  const [place, setPlace] = useState<PresetPlace | null>(() => presetPlace(slot));
  const [note, setNote] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const pick = (p: NewPlace) => {
    if (p.latE7 === null || p.lonE7 === null) return setNote({ tone: 'error', text: t('editor.home.needsSearch') });
    setPresetPlace(slot, { name: p.name, address: (p.address || p.name).slice(0, 120), latE7: p.latE7, lonE7: p.lonE7 });
    setPlace(presetPlace(slot)); // read back: shows what was actually kept (nothing, if storage is blocked)
    setNote({ tone: 'success', text: isHome ? t('settings.home.saved') : t('settings.preset.saved') });
  };

  const clear = () => {
    setPresetPlace(slot, null);
    setPlace(null);
    setNote({ tone: 'success', text: isHome ? t('settings.home.cleared') : t('settings.preset.cleared') });
  };

  return (
    <PushScreen title={isHome ? t('common.homeAddress') : label} onBack={() => navigate('/settings')}>
      <div className="tn-intro">
        <p>{isHome ? t('settings.home.description') : t('settings.preset.description2')}</p>
      </div>
      <div className="tn-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {note && <Banner status={note.tone} title={note.text} isDismissable onDismiss={() => setNote(null)} />}
        {place && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span className="tn-lead" style={{ background: 'var(--color-background-surface)' }}>
                <PresetIcon slot={slot} />
              </span>
              <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 15, lineHeight: 1.5 }}>
                {!isHome && <strong style={{ fontWeight: 600 }}>{place.name}</strong>}
                <span style={isHome ? undefined : { fontSize: 13, color: 'var(--color-text-secondary)' }}>{place.address}</span>
              </span>
              <span style={{ flex: 'none' }}>
                <Button label={t('editor.home.remove')} variant="ghost" size="sm" onClick={clear} />
              </span>
            </div>
          </Card>
        )}
        <PlaceSearch
          label={place ? t('settings.home.change') : isHome ? t('editor.home.search') : t('settings.preset.search', { label })}
          requireCoords
          onPick={pick}
        />
      </div>
    </PushScreen>
  );
}
