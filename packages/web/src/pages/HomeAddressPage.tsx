import { useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import type { Home } from '@tteonaljido/shared';
import { HomeIcon } from '../components/shell/icons';
import { PushScreen } from '../components/shell/Screens';
import { Card } from '../components/toss/Card';
import { PlaceSearch, type NewPlace } from '../editor/PlaceSearch';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { defaultHome, setDefaultHome } from '../lib/settings';

/**
 * 설정 › 집 주소: set the home address once, ahead of time; new trips start with it. Only a search result can be home —
 * the car needs real coordinates, so name-only entry is hidden (`requireCoords`).
 */
export function HomeAddressPage() {
  const [home, setHome] = useState<Home | null>(defaultHome);
  const [note, setNote] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const pick = (p: NewPlace) => {
    if (p.latE7 === null || p.lonE7 === null) return setNote({ tone: 'error', text: t('editor.home.needsSearch') });
    const next: Home = { address: (p.address || p.name).slice(0, 120), latE7: p.latE7, lonE7: p.lonE7 };
    setDefaultHome(next);
    setHome(defaultHome()); // read back: shows what was actually kept (nothing, if storage is blocked)
    setNote({ tone: 'success', text: t('settings.home.saved') });
  };

  const clear = () => {
    setDefaultHome(null);
    setHome(null);
    setNote({ tone: 'success', text: t('settings.home.cleared') });
  };

  return (
    <PushScreen title={t('common.homeAddress')} onBack={() => navigate('/settings')}>
      <div className="tn-intro">
        <p>{t('settings.home.description')}</p>
      </div>
      <div className="tn-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {note && <Banner status={note.tone} title={note.text} isDismissable onDismiss={() => setNote(null)} />}
        {home && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span className="tn-lead" style={{ background: 'var(--color-background-surface)' }}>
                <HomeIcon />
              </span>
              <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: 15, lineHeight: 1.5 }}>{home.address}</span>
              <span style={{ flex: 'none' }}>
                <Button label={t('editor.home.remove')} variant="ghost" size="sm" onClick={clear} />
              </span>
            </div>
          </Card>
        )}
        <PlaceSearch label={home ? t('settings.home.change') : t('editor.home.search')} requireCoords onPick={pick} />
      </div>
    </PushScreen>
  );
}
