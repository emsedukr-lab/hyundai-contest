import { lazy, Suspense, useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CarIcon, MapIcon, QrIcon } from '../components/shell/icons';
import { Row, Section } from '../components/shell/rows';
import { PushScreen } from '../components/shell/Screens';
import { sendLog, trips } from '../lib/db';
import { dateLabel, dayOf } from '../lib/format';
import { t } from '../lib/i18n';
import { SERVER_ORIGIN } from '../lib/platform';
import { navigate } from '../lib/router';
import { carQrTarget } from '../lib/qrLink';
import { sendIntent } from '../lib/sendIntent';

// The scanner (camera + jsQR) loads when the button is pressed.
const QrScanner = lazy(() => import('../components/QrScanner').then((m) => ({ default: m.QrScanner })));

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
  const [scanTrip, setScanTrip] = useState<string>();

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

  const startScan = (tripId?: string) => {
    if (tripId) sendIntent.set(tripId);
    else sendIntent.clear();
    setScanTrip(recent?.find((r) => r.tripId === tripId)?.name);
    setScanning(true);
  };

  return (
    <PushScreen title={t('car.title')} onBack={() => navigate('/')}>
      <Section title={t('car.howTo')}>
        {/* instructions, not buttons: numbered stops on the route line, no card or chevron */}
        <div className="tn-panel">
        <ol className="tn-steps">
          {[t('car.step1'), t('car.step2b'), t('car.step3')].map((text, i) => (
            <li key={i}>
              <span className="tn-step-no" aria-hidden="true">
                {i + 1}
              </span>
              <span className="tn-step-text">{text}</span>
            </li>
          ))}
        </ol>
        </div>
      </Section>

      <div className="tn-pad" style={{ paddingTop: 16 }}>
        <Button label={t('car.scan')} icon={<QrIcon />} variant="primary" size="lg" width="100%" onClick={() => startScan()} />
        <details style={{ marginTop: 12 }}>
          <summary className="tn-note" style={{ cursor: 'pointer', margin: 0 }}>{t('car.cameraHelp')}</summary>
          <p className="tn-note">{t('car.cameraHelp.detail')}</p>
        </details>
      </div>

      {resumable && (
        <ul className="tn-cards">
          <li>
            <Row href="/c" onClick={() => navigate('/c')} lead={<CarIcon />} title={t('car.resume')} subtitle={t('car.resume.detail')} chevron />
          </li>
        </ul>
      )}

      <Section title={t('car.recent')}>
        {recent && recent.length === 0 ? (
          <div className="tn-panel" style={{ alignItems: 'center', padding: 24 }}>
            <CarIcon />
            <p className="tn-note" style={{ margin: 0 }}>{t('car.recent.empty')}</p>
          </div>
        ) : (
          <ul className="tn-cards">
            {(recent ?? []).map((r) => (
              <li key={r.tripId}>
                <Row
                  onClick={() => startScan(r.tripId)}
                  lead={<MapIcon />}
                  title={r.name}
                  subtitle={t('home.lastSend', { date: dateLabel(dayOf(r.at)) })}
                  end={<span>{t('car.resend')}</span>}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
      {scanning && (
        <Suspense fallback={null}>
        <QrScanner
          tripName={scanTrip}
          onClose={() => setScanning(false)}
          onResult={(text) => {
            const target = carQrTarget(text, SERVER_ORIGIN);
            if (!target) return false;
            setScanning(false);
            navigate(target);
            return true;
          }}
        />
        </Suspense>
      )}
    </PushScreen>
  );
}
