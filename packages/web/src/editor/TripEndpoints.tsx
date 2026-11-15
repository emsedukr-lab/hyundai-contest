import type { Home, Trip } from '@tteonaljido/shared';
import { FlagIcon, PinIcon } from '../components/shell/icons';
import { t } from '../lib/i18n';
import { setEndBy } from '../lib/trips';
import { EndpointField } from './EndpointField';
import { TimeSelect } from './TimeSelect';
import './timeline.css';

export function TripEndpoints({ plan, home, onChange, onOpenSettings }: {
  plan: Trip;
  home: Home | null;
  onChange: (plan: Trip) => void;
  onOpenSettings: () => void;
}) {
  const first = plan.firstDay;
  const lastDay = plan.days[plan.days.length - 1];
  return (
    <div className="ti-endpoints">
      <div className="ti-endpoint-row">
        <span className="ti-endpoint-icon is-start" aria-hidden="true"><PinIcon /></span>
        <div className="ti-endpoint-field">
          <span className="tl-kicker">{t('editor.startPlace')}</span>
          <EndpointField which="origin" compact plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} />
        </div>
        <div className="ti-endpoint-field ti-endpoint-time">
          <span className="tl-kicker">{first.basis === 'DEPART_ORIGIN' ? t('setup.departTimeShort') : t('editor.arriveTime')}</span>
          <TimeSelect label={first.basis === 'DEPART_ORIGIN' ? t('setup.departTime') : t('editor.arriveTime')} value={first.basis === 'DEPART_ORIGIN' ? first.departTime : first.arriveTime} clearable={first.basis === 'DEPART_ORIGIN'} placeholder={t('time.none')} onChange={(time) => {
            if (first.basis === 'ARRIVE_FIRST_STOP') { if (time) onChange({ ...plan, firstDay: { ...first, arriveTime: time } }); }
            else onChange({ ...plan, firstDay: { ...first, departTime: time } });
          }} />
        </div>
      </div>
      <div className="ti-endpoint-row">
        <span className="ti-endpoint-icon" aria-hidden="true"><FlagIcon /></span>
        <div className="ti-endpoint-field">
          <span className="tl-kicker">{t('tl.endPlace')}</span>
          <EndpointField which="finalDestination" compact plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} />
        </div>
        <div className="ti-endpoint-field ti-endpoint-time">
          <span className="tl-kicker">{t('setup.returnTimeShort')}</span>
          <TimeSelect label={t('setup.returnTime')} value={lastDay.endBy} clearable clearLabel={t('time.undecided')} placeholder={t('time.undecided')} suggest="18:00" onChange={(time) => onChange(setEndBy(plan, lastDay.dayIndex, time))} />
        </div>
      </div>
    </div>
  );
}
