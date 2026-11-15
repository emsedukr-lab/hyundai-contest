import { Button } from '@astryxdesign/core/Button';
import { Row, Section } from '../components/shell/rows';
import { PushScreen } from '../components/shell/Screens';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';

export function AboutPage() {
  return (
    <PushScreen title={t('more.about')} onBack={() => navigate('/settings')}>
      <div className="tn-intro"><p>{t('about.intro')}</p></div>
      <Section title={t('car.howTo')}>
        <div className="tn-panel"><ol className="tn-steps">
          {[t('car.step1'), t('car.step2b'), t('car.step3')].map((text, i) => <li key={i}><span className="tn-step-no" aria-hidden="true">{i + 1}</span><span className="tn-step-text">{text}</span></li>)}
        </ol></div>
        <div className="tn-pad"><Button label={t('about.connect')} variant="primary" size="lg" width="100%" onClick={() => navigate('/car')} /></div>
      </Section>
      <Section title={t('privacy.title')}>
        <ul className="tn-cards"><li><Row title={t('privacy.title')} subtitle={t('more.privacy.detail')} href="/privacy" onClick={() => navigate('/privacy')} chevron /></li></ul>
      </Section>
    </PushScreen>
  );
}
