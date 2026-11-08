import { Row } from '../components/shell/rows';
import { PushScreen } from '../components/shell/Screens';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';

const ROWS: Array<[string, string]> = [
  [t('privacy.phone.label'), t('privacy.phone.text')],
  [t('privacy.qr.label'), t('privacy.qr.text')],
  [t('privacy.relay.label'), t('privacy.relay.text')],
  [t('privacy.car.label'), t('privacy.car.text')],
  [t('common.homeAddress'), t('privacy.home.text')],
  [t('privacy.notSent.label'), t('privacy.notSent.text')],
  [t('privacy.search.label'), t('privacy.search.text')],
  [t('privacy.ongoing.label'), t('privacy.ongoing.text')],
];

/** 개인정보 안내 — opened from the 전체 tab, so back returns there. Plain, full-bleed rows (read-only facts). */
export function PrivacyPage() {
  return (
    <PushScreen title={t('privacy.title')} onBack={() => navigate('/more')}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {ROWS.map(([label, description]) => (
          <li key={label}>
            <Row title={label} subtitle={description} />
          </li>
        ))}
      </ul>
      <p className="tn-pad" style={{ margin: '16px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
        {t('privacy.processors')}
      </p>
    </PushScreen>
  );
}
