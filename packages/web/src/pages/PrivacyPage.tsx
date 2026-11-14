import { Row } from '../components/shell/rows';
import { PushScreen } from '../components/shell/Screens';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';

const ROWS: Array<[string, string]> = [
  [t('privacy.phone.label'), t('privacy.phone.text2')],
  [t('privacy.qr.label'), t('privacy.qr.text')],
  [t('privacy.camera.label'), t('privacy.camera.text')],
  [t('privacy.relay.label'), t('privacy.relay.text')],
  [t('privacy.car.label'), t('privacy.car.text')],
  [t('common.homeAddress'), t('privacy.home.text')],
  [t('privacy.notSent.label'), t('privacy.notSent.text')],
  [t('privacy.search.label'), t('privacy.search.text')],
  [t('privacy.route.label'), t('privacy.route.text3')],
  [t('privacy.location.label'), t('privacy.location.text')],
  [t('privacy.ongoing.label'), t('privacy.ongoing.text')],
];

/** 개인정보 안내 — opened from the 설정 tab, so back returns there. Read-only facts in one white container, like 설정 (M66: the grey captions need the white face for 4.5:1). */
export function PrivacyPage() {
  return (
    <PushScreen title={t('privacy.title')} onBack={() => navigate('/settings')}>
      <ul className="tn-cards">
        {ROWS.map(([label, description]) => (
          <li key={label}>
            <Row title={label} subtitle={description} />
          </li>
        ))}
      </ul>
      <p className="tn-note" style={{ marginTop: 16 }}>
        {t('privacy.processors2')}
      </p>
    </PushScreen>
  );
}
