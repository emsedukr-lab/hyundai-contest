import { useEffect, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { t } from '../lib/i18n';

/**
 * "홈 화면에 추가" 안내. 지도앱의 공유 시트에 "떠날지도"가 뜨려면 PWA가 홈 화면에 설치돼 있어야 하고(그것도 Android
 * Chrome에서만) iOS Safari는 공유 수신을 지원하지 않는다. 그래서 설치가 공유 흐름의 전제 — 이 배너로 안내한다.
 *
 * - Android/Chrome: `beforeinstallprompt`를 가로채 "홈 화면에 추가" 버튼으로 바로 설치를 띄운다.
 * - iOS Safari: 설치 이벤트가 없으므로 수동 절차(공유 → 홈 화면에 추가)를 글로 안내하고, 공유 담기는 Android 한정임을 밝힌다.
 * - 이미 설치(standalone)됐거나 사용자가 닫았으면 아무것도 보이지 않는다(닫음은 localStorage에 기억).
 * 새 외부 호출·키 없음, 순수 클라이언트 동작.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'tteonaljido.installHintDismissed';

const isStandalone = (): boolean => {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
};

const isIos = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);

const wasDismissed = (): boolean => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

export function InstallHint() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(() => isStandalone() || wasDismissed());

  useEffect(() => {
    if (hidden) return;
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the browser's own mini-infobar from showing; we offer our own button
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [hidden]);

  if (hidden) return null;

  const ios = isIos();
  // Show only when we can actually help: an installable prompt is available, or it's iOS (manual install possible).
  if (!prompt && !ios) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode: just hide for this view */
    }
    setHidden(true);
  };

  const install = async () => {
    if (!prompt) return;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      /* user dismissed the native dialog */
    } finally {
      setPrompt(null);
      setHidden(true);
    }
  };

  return (
    <Banner
      status="info"
      title={t('install.title')}
      description={prompt ? t('install.benefit') : `${t('install.benefit')} · ${t('install.ios')}`}
      isDismissable
      onDismiss={dismiss}
      endContent={prompt ? <Button label={t('install.cta')} variant="secondary" size="sm" onClick={() => void install()} /> : undefined}
    />
  );
}
