import { useState } from 'react';
import { ToastNotice } from '../components/ToastNotice';
import { Button } from '@astryxdesign/core/Button';
import { t } from '../lib/i18n';
import { defaultHome, setTripDefaults } from '../lib/settings';
import { emptyPlan } from '../lib/trips';
import { Sheet } from './Sheet';
import { TripEndpoints } from './TripEndpoints';

export function TripDefaultsSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [plan, setPlan] = useState(emptyPlan);
  const [failed, setFailed] = useState(false);
  const save = () => {
    try { setTripDefaults(plan); onSaved(); }
    catch { setFailed(true); }
  };
  return (
    <Sheet isOpen onClose={onClose} title={t('setup.endpoints')}
      footer={<Button label={t('editor.save')} variant="primary" size="lg" width="100%" onClick={save} />}>
      {failed && <ToastNotice status="error" title={t('settings.tripDefaults.failed')} onDismiss={() => setFailed(false)} />}
      <TripEndpoints plan={plan} home={defaultHome()} onChange={setPlan} onOpenSettings={onClose} />
    </Sheet>
  );
}
