import { useEffect, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { FileInput } from '@astryxdesign/core/FileInput';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useInstallPrompt } from '../components/InstallHint';
import { DownloadIcon, InfoIcon, PhoneIcon, PresetIcon, ShieldIcon, UploadIcon } from '../components/shell/icons';
import { Row, Section } from '../components/shell/rows';
import { TabScreen } from '../components/shell/Screens';
import { trips } from '../lib/db';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { PRESET_SLOTS, presetLabel, presetPlace } from '../lib/settings';
import { docFromShare, importShare, isShareFile } from '../lib/share';
import { newDoc, nowIso, type TripDoc } from '../lib/trips';

/**
 * 설정 tab: start places for new trips (집, 회사, 즐겨찾기 1–3), trip data (backup out, backup or a friend's share file in) and
 * the app (install, privacy, about). The import logic is the one that used to sit on the trips screen, moved as-is.
 */
export function SettingsPage() {
  const [docs, setDocs] = useState<TripDoc[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  // A friend's encrypted share needs a passcode; hold the file text until it is entered.
  const [shareText, setShareText] = useState<string | null>(null);
  const [sharePass, setSharePass] = useState('');
  const install = useInstallPrompt();
  const [presets] = useState(() => PRESET_SLOTS.map((slot) => ({ slot, place: presetPlace(slot) })));

  const reload = async () => setDocs(await trips.all());
  useEffect(() => void reload(), []);

  const exportAll = () => {
    const blob = new Blob([JSON.stringify({ format: 'tteonaljido-backup', version: 1, trips: docs }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = t('home.backupFileName', { date: nowIso().slice(0, 10) });
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    // A friend's share is encrypted: hold it and ask for the passcode instead of importing immediately.
    if (isShareFile(text)) {
      setShareText(text);
      setSharePass('');
      setShowImport(false);
      return;
    }
    try {
      const data = JSON.parse(text) as { format?: string; trips?: TripDoc[] };
      if (data.format !== 'tteonaljido-backup' || !Array.isArray(data.trips)) throw new Error('not a backup');
      // A backup replaces trips with the same id; warn before overwriting any.
      const existing = new Set(docs.map((d) => d.tripId));
      const overwrites = data.trips.filter((d) => existing.has(d.tripId)).length;
      if (overwrites > 0 && !window.confirm(t('home.import.overwrite', { n: overwrites }))) return;
      for (const d of data.trips) await trips.put(await newDoc({ ...d.plan, revision: d.revision, updatedAt: d.updatedAt }, d.home));
      setMessage(t('home.imported', { n: data.trips.length }));
      await reload();
    } catch {
      setMessage(t('home.notBackup'));
    }
  };

  const importSharedTrip = async () => {
    if (!shareText) return;
    const r = await importShare(shareText, sharePass.trim());
    if (!r.ok) return setMessage(t(r.reason === 'passcode' ? 'share.wrongPass' : 'share.invalid'));
    await trips.put(await docFromShare(r.transfer));
    setShareText(null);
    setSharePass('');
    setMessage(t('share.received'));
    await reload();
  };

  return (
    <TabScreen path="/settings" title={t('nav.settings')}>
      {message && (
        <div className="tn-pad" style={{ paddingTop: 8 }}>
          <Banner status="info" title={message} isDismissable onDismiss={() => setMessage(null)} />
        </div>
      )}

      {/* Start places for new trips: 집 (the one home every trip shares), 회사, 즐겨찾기 1–3. */}
      <Section title={t('settings.origins')}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {presets.map(({ slot, place }) => (
            <li key={slot}>
              <Row
                href={`/settings/place/${slot}`}
                onClick={() => navigate(`/settings/place/${slot}`)}
                lead={<PresetIcon slot={slot} />}
                title={slot === 'home' ? t('common.homeAddress') : presetLabel(slot)}
                subtitle={!place ? t('settings.home.unset') : slot === 'home' ? place.address : place.name}
                chevron
              />
            </li>
          ))}
        </ul>
        <p className="tn-pad" style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
          {t('settings.origins.detail')}
        </p>
      </Section>

      <Section title={t('more.data')}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          <li>
            <Row lead={<DownloadIcon />} title={t('home.exportBackup')} subtitle={t('more.export.detail')} onClick={docs.length ? exportAll : undefined} />
          </li>
          <li>
            <Row lead={<UploadIcon />} title={t('home.importBackup')} subtitle={t('more.import.detail')} onClick={() => setShowImport((v) => !v)} />
          </li>
        </ul>
        {showImport && (
          <div className="tn-pad" style={{ paddingTop: 4, paddingBottom: 8 }}>
            <FileInput
              label={t('home.backupFile.label')}
              mode="input"
              accept="application/json"
              value={null}
              onChange={(f) => {
                const file = Array.isArray(f) ? f[0] : f;
                if (file) void importFile(file).then(() => setShowImport(false));
              }}
              description={t('home.backupFile.description')}
            />
          </div>
        )}
        {shareText && (
          <div className="tn-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4, paddingBottom: 8 }}>
            <Banner status="info" title={t('share.importTitle')} description={t('share.importHint')} />
            <TextInput label={t('share.passcode')} value={sharePass} inputMode="numeric" onChange={setSharePass} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button label={t('common.cancel')} variant="secondary" size="lg" onClick={() => setShareText(null)} />
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <Button label={t('share.importAction')} variant="primary" size="lg" width="100%" isDisabled={sharePass.trim().length < 4} onClick={() => void importSharedTrip()} />
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section title={t('more.app')}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {install.available && (
            <li>
              <Row
                lead={<PhoneIcon />}
                title={t('install.cta')}
                subtitle={install.canPrompt ? t('more.install.detail') : t('install.ios')}
                onClick={install.canPrompt ? () => void install.install() : undefined}
              />
            </li>
          )}
          <li>
            <Row lead={<ShieldIcon />} title={t('privacy.title')} subtitle={t('more.privacy.detail')} href="/privacy" onClick={() => navigate('/privacy')} chevron />
          </li>
          <li>
            <Row lead={<InfoIcon />} title={t('more.about')} subtitle={t('home.tagline')} />
          </li>
        </ul>
      </Section>

      <p className="tn-pad" style={{ margin: '16px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
        {t('home.storageNote')}
      </p>
    </TabScreen>
  );
}
