import { useEffect, useState } from 'react';
import { CloseIcon, MapIcon, PinIcon, PlusIcon } from './shell/icons';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import './addFab.css';

/**
 * The main screen's one floating add button. It opens a short menu — 여행 추가 (a new trip) and 장소 추가 (the places
 * screen, where a pasted place goes into a trip) — so those two ways in no longer need a tab bar. Tapping outside,
 * Escape or the button again closes it.
 */
export function AddFab() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };
  return (
    <>
      {open && <button type="button" className="tn-fab-scrim" tabIndex={-1} aria-label={t('common.close')} onClick={() => setOpen(false)} />}
      {open && (
        <ul className="tn-fab-menu" role="menu" aria-label={t('home.add.label')}>
          <li role="none">
            <button type="button" role="menuitem" className="tn-fab-item" onClick={() => go('/trips/new')}>
              <MapIcon />
              <span>{t('home.add.trip')}</span>
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" className="tn-fab-item" onClick={() => go('/places')}>
              <PinIcon />
              <span>{t('home.add.place')}</span>
            </button>
          </li>
        </ul>
      )}
      <button type="button" className={`tn-fab${open ? ' is-open' : ''}`} aria-label={t('home.add.label')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? <CloseIcon /> : <PlusIcon />}
      </button>
    </>
  );
}
