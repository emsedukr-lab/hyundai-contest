import { useEffect, useState } from 'react';
import { ToastNotice } from '../components/ToastNotice';
import { Button } from '@astryxdesign/core/Button';
import { Row } from '../components/shell/rows';
import { PushScreen } from '../components/shell/Screens';
import { TRASH_RETENTION_MS, TRIPS_CHANGED, trash, type TrashedTrip } from '../lib/db';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';

export function TrashPage() {
  const [entries, setEntries] = useState<TrashedTrip[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const reload = async () => {
    try { setEntries(await trash.all()); }
    catch { setMessage(t('trash.failed')); }
  };
  useEffect(() => {
    void reload();
    const refresh = () => void reload();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(timer); };
  }, []);
  const restore = async (entry: TrashedTrip) => {
    try {
      const doc = await trash.restore(entry.tripId);
      setMessage(doc ? t('trash.restored', { name: doc.plan.name }) : t('trash.restoreFailed'));
      if (doc) window.dispatchEvent(new Event(TRIPS_CHANGED));
      await reload();
    } catch { setMessage(t('trash.failed')); }
  };
  return (
    <PushScreen title={t('trash.title')} onBack={() => navigate('/settings')}>
      <div className="tn-intro"><p>{t('trash.hint')}</p></div>
      <div className="tn-pad">
        {message && <ToastNotice status="info" title={message} isDismissable onDismiss={() => setMessage(null)} />}
        {entries.length === 0 ? <p className="tn-note">{t('trash.empty')}</p> : (
          <ul className="tn-cards">
            {entries.map((entry) => (
              <li key={entry.tripId}>
                <Row
                  title={entry.doc.plan.name}
                  subtitle={t('trash.remaining', { days: Math.max(1, Math.ceil((entry.deletedAt + TRASH_RETENTION_MS - Date.now()) / 86_400_000)) })}
                  end={<Button label={t('trash.restore')} variant="secondary" size="sm" onClick={() => void restore(entry)} />}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </PushScreen>
  );
}
