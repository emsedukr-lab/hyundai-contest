import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 휴대폰 앱(Android·iOS). 화면은 packages/web을 `--mode app`으로 빌드한 www/ 그대로이고, 이 패키지는 그것을 담는
 * 네이티브 껍데기와 설정만 가진다. 중계 서버 주소는 web 빌드가 car/gradle.properties의 prodOrigin에서 읽는다.
 */
const config: CapacitorConfig = {
  appId: 'io.tteonaljido.mobile',
  appName: '떠날지도',
  webDir: 'www',
  // 로그에 본문·토큰·검색어를 남기지 않는 규칙: 브리지를 지나는 값(내보내는 파일, 앱을 연 QR 링크)이 logcat·Xcode
  // 콘솔에 찍히지 않도록 Capacitor 로그를 끈다. 기기에서 디버깅할 때만 잠깐 'debug'로 바꾼다.
  loggingBehavior: 'none',
};

export default config;
