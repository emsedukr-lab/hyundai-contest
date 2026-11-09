import { timeLabel, timeOptions } from '../lib/format';
import { t } from '../lib/i18n';
import './timeSelect.css';

/**
 * 시각 선택 (M47): times are chosen, never typed. A native `<select>` styled as a Pleos field — on a phone it opens the
 * system picker (the iOS wheel, the Android list), on a desktop a dropdown — with every `step` minutes of the day.
 * `clearable` adds a first "없음" choice; when there is no value yet the placeholder shows in its place.
 */
export function TimeSelect({
  label,
  value,
  onChange,
  step = 30,
  clearable = false,
  placeholder,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (time: string | null) => void;
  step?: number;
  clearable?: boolean;
  placeholder?: string;
}) {
  const current = value ?? null;
  const options = timeOptions(step, current);
  return (
    <span className={`ts${current ? '' : ' is-empty'}`}>
      <svg className="ts-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select className="ts-select" aria-label={label} value={current ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        {(clearable || !current) && (
          <option value="" disabled={!clearable}>
            {current || !placeholder ? t('time.none') : placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o} value={o}>
            {timeLabel(o)}
          </option>
        ))}
      </select>
      <svg className="ts-chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
