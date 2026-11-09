import { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CarIcon, MapIcon, QrIcon, SendIcon } from '../components/shell/icons';
import { Row, Section } from '../components/shell/rows';
import { TabScreen } from '../components/shell/Screens';
import { sendLog, trips } from '../lib/db';
import { dateLabel, dayOf } from '../lib/format';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { carQrTarget } from '../lib/qrLink';
import { QrScanner } from '../components/QrScanner';

/** The pairing page remembers its session per browser window (ConnectPage's LAST_SID); /c resumes it. */
const hasOpenConnection = () => {
  try {
    return !!sessionStorage.getItem('tteonaljido.lastSid');
  } catch {
    return false;
  }
};

interface RecentSend {
  tripId: string;
  name: string;
  revision: number;
  at: number;
}

/**
 * 차량 tab: how a trip gets to the car (the car shows a QR, the phone scans it — the phone can't start a connection
 * itself), a way back into a connection already in progress in this window, and the trips sent most recently.
 */
export function CarPage() {
  const [recent, setRecent] = useState<RecentSend[] | null>(null);
  const [resumable] = useState(hasOpenConnection);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    void (async () => {
      const [log, all] = await Promise.all([sendLog.recent(200), trips.all()]);
      const names = new Map(all.map((d) => [d.tripId, d.plan.name]));
      const out: RecentSend[] = [];
      for (const e of log) {
        const name = names.get(e.tripId);
        if (!name || out.some((r) => r.tripId === e.tripId)) continue; // one row per trip, deleted trips skipped
        out.push({ tripId: e.tripId, name, revision: e.revision, at: e.at });
        if (out.length >= 10) break;
      }
      setRecent(out);
    })();
  }, []);

  return (
    <TabScreen path="/car" title={t('nav.connect')}>
      <div className="tn-intro">
        <p>{t('car.intro')}</p>
      </div>
      {/* Scan in the app: one tap opens the camera (asking permission), and the car's QR opens the connection here. */}
      <div className="tn-pad" style={{ paddingBottom: 8 }}>
        <Button label={t('car.scan')} variant="primary" size="lg" width="100%" onClick={() => setScanning(true)} />
      </div>

      {resumable && (
        <ul className="tn-cards">
          <li>
            <Row href="/c" onClick={() => navigate('/c')} lead={<CarIcon />} title={t('car.resume')} subtitle={t('car.resume.detail')} chevron />
          </li>
        </ul>
      )}

      <Section title={t('car.howTo')}>
        <ol className="tn-cards">
          <li>
            <Row lead={<CarIcon />} title={t('car.step1')} />
          </li>
          <li>
            <Row lead={<QrIcon />} title={t('car.step2b')} />
          </li>
          <li>
            <Row lead={<SendIcon />} title={t('car.step3')} />
          </li>
        </ol>
      </Section>

      <Section title={t('car.recent')}>
        {recent && recent.length === 0 ? (
          <p className="tn-pad" style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
            {t('car.recent.empty')}
          </p>
        ) : (
          <ul className="tn-cards">
            {(recent ?? []).map((r) => (
              <li key={r.tripId}>
                <Row
                  href={`/trips/${r.tripId}`}
                  onClick={() => navigate(`/trips/${r.tripId}`)}
                  lead={<MapIcon />}
                  title={r.name}
                  subtitle={t('home.lastSend', { version: r.revision, date: dateLabel(dayOf(r.at)) })}
                  chevron
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
      {scanning && (
        <QrScanner
          onClose={() => setScanning(false)}
          onResult={(text) => {
            const target = carQrTarget(text, location.origin);
            if (!target) return false;
            setScanning(false);
            navigate(target);
            return true;
          }}
        />
      )}
    </TabScreen>
  );
}
