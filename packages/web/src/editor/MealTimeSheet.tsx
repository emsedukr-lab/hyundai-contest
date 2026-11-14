import { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { t } from '../lib/i18n';
import { Sheet } from './Sheet';
import { TimeSelect } from './TimeSelect';

/**
 * 설정 › 식사 시간 › one meal (M67): its start and end, chosen on the half-hour grid like every other time. A draft until
 * 저장 — the times must stay in order with the other meals, so what is wrong is said in place and 저장 waits for it.
 */
export function MealTimeSheet({
  title,
  fromLabel,
  toLabel,
  value,
  error,
  onChange,
  onSave,
  onClose,
}: {
  title: string;
  fromLabel: string;
  toLabel: string;
  value: [string, string];
  error: string | null;
  onChange: (value: [string, string]) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  // Mounted closed, opened on the next frame, so the sheet rises instead of appearing.
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(true), []);
  return (
    <Sheet isOpen={open} onClose={onClose} title={title} footer={<Button label={t('settings.meals.save')} variant="primary" size="lg" width="100%" isDisabled={!!error} onClick={onSave} />}>
      <div className="tn-mealpair">
        <span className="tn-mealpair-label">{t('settings.meals.from')}</span>
        <span aria-hidden="true" />
        <span className="tn-mealpair-label">{t('settings.meals.to')}</span>
        <TimeSelect label={fromLabel} value={value[0]} onChange={(v) => v && onChange([v, value[1]])} />
        <span className="tn-mealpair-dash" aria-hidden="true">
          –
        </span>
        <TimeSelect label={toLabel} value={value[1]} onChange={(v) => v && onChange([value[0], v])} />
      </div>
      {/* Always in the tree so the message is announced when it appears. */}
      <p className="tn-fielderror" role="alert">
        {error}
      </p>
    </Sheet>
  );
}
