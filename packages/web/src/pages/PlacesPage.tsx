import { useEffect, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { TextArea } from '@astryxdesign/core/TextArea';
import { CloseIcon, PinIcon, ShareIcon } from '../components/shell/icons';
import { Row, Section } from '../components/shell/rows';
import { TabScreen } from '../components/shell/Screens';
import { CATEGORY_LABEL } from '../editor/PlaceSearch';
import { favorites } from '../lib/db';
import type { FavoritePlace } from '../lib/favorites';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';

/**
 * 장소 tab: put places from map apps into a trip, and manage saved places. A pasted share goes through the same
 * /add landing the share sheet uses (search, link resolving and the duplicate guard live there), so nothing here
 * writes a trip itself.
 */
export function PlacesPage() {
  const [favs, setFavs] = useState<FavoritePlace[]>([]);
  const [manage, setManage] = useState(false);
  const [paste, setPaste] = useState('');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void favorites.all().then(setFavs);
  }, []);

  const remove = async (id: string) => {
    await favorites.remove(id);
    setFavs(await favorites.all());
  };

  const readClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setPaste(text);
      else setNote(t('place.paste.clipboardEmpty'));
    } catch {
      setNote(t('place.paste.clipboardFail'));
    }
  };

  return (
    <TabScreen path="/places" title={t('nav.places')}>
      <div className="tn-intro">
        <p>{t('places.intro')}</p>
      </div>

      <Section title={t('places.paste.title')}>
        <div className="tn-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TextArea label={t('place.paste.label')} value={paste} onChange={setPaste} placeholder={t('place.paste.placeholder')} description={t('places.paste.hint')} rows={3} />
          {note && <Banner status="info" title={note} isDismissable onDismiss={() => setNote(null)} />}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button label={t('place.paste.fromClipboard')} variant="secondary" size="lg" onClick={() => void readClipboard()} />
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <Button label={t('places.paste.action')} variant="primary" size="lg" width="100%" isDisabled={!paste.trim()} onClick={() => navigate(`/add?text=${encodeURIComponent(paste.trim())}`)} />
            </div>
          </div>
        </div>
      </Section>

      <Section title={t('places.howTo')}>
        <ul className="tn-cards">
          <li>
            <Row lead={<ShareIcon />} title={t('places.share.title')} subtitle={t('places.share.detail')} />
          </li>
        </ul>
      </Section>

      <Section
        title={t('favorites.title')}
        action={favs.length > 0 ? <Button label={manage ? t('favorites.done') : t('favorites.manage')} variant="ghost" size="sm" onClick={() => setManage((m) => !m)} /> : undefined}>
        {favs.length === 0 ? (
          <p className="tn-pad" style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
            {t('places.favorites.empty')}
          </p>
        ) : (
          <ul className="tn-cards">
            {favs.map((f) => (
              <li key={f.id}>
                <Row
                  lead={<PinIcon />}
                  title={f.name}
                  subtitle={f.address || CATEGORY_LABEL[f.category]}
                  end={
                    manage ? (
                      <button type="button" className="tn-iconbtn" aria-label={`${f.name} · ${t('favorites.remove')}`} onClick={() => void remove(f.id)}>
                        <CloseIcon />
                      </button>
                    ) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </TabScreen>
  );
}
