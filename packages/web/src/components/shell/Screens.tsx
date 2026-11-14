import type { ReactNode } from 'react';
import { TopBar } from './TopBar';

/** The main screen (여행): large top bar with its icon actions, scrolling content on the grey canvas. No tab bar — 연결 and 설정 are icons in the top bar, 장소 comes from the floating add button. */
export function RootScreen({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="tn-screen">
      <div className="tn-col">
        <TopBar title={title} actions={actions} large />
        <main className="tn-main-tab">{children}</main>
      </div>
    </div>
  );
}

/**
 * A screen opened from a tab (editor, share landing, pairing, privacy): top bar with back, content, and at most one
 * bottom CTA area — one filled primary action, optionally with a secondary button beside it (`className="is-secondary"`).
 */
export function PushScreen({ title, onBack, actions, cta, children }: { title: ReactNode; onBack?: () => void; actions?: ReactNode; cta?: ReactNode; children: ReactNode }) {
  return (
    <div className="tn-screen">
      <div className="tn-col">
        <TopBar title={title} onBack={onBack} actions={actions} />
        <main className={cta ? 'tn-main-push' : 'tn-main-plain'}>{children}</main>
      </div>
      {cta && (
        <div className="tn-cta">
          <div className="tn-cta-inner">{cta}</div>
        </div>
      )}
    </div>
  );
}
