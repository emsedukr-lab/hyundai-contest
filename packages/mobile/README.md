# 떠날지도 휴대폰 앱 (Android · iOS)

모바일 웹(`packages/web`)의 화면을 그대로 담은 휴대폰 앱입니다. [Capacitor](https://capacitorjs.com) 8.6으로 포장하며, 화면 코드는 하나이고 모바일 웹도 그대로 유지합니다(앱이 없으면 차량 QR은 지금처럼 브라우저에서 열립니다).

- 앱 ID `io.tteonaljido.mobile` (차량 앱은 `io.tteonaljido.car`), 버전 0.3.1
- 2026-11-15: release **0.3.1(4)**에서 출발지·최종 도착지 옆에 시간을 배치하고, '출발지와 동일'을 최종 도착지 선택창에 통합했습니다. 기본 출발지는 현위치를 유지하며, 동일 도착지는 출발지를 지정한 뒤 선택합니다. 경로 추천은 장소를 날짜별로 고르게 나눕니다(첫날·마지막 날은 가운데 날의 절반, 가까운 곳 묶기가 먼저).
- 2026-11-15: release **0.3.0(3)**에 통합된 여행 추가 화면, 네이버 목록 전체·개별 선택, 담은 장소의 숙소 지정, 여행 파일 백업·휴지통, 설정·용어·핀 아이콘 개선을 반영했습니다. 배포된 웹도 같은 소스로 갱신했습니다. 기존 인증서로 서명했고 Android 휴대폰 에뮬레이터에서 0.2.0 위에 업데이트 설치했습니다.
- 2026-11-15: 지금 웹 화면 그대로의 서명 release APK 0.2.0을 저장소 최상위 [`apk/mobile/`](../../apk/mobile/)에 두고, Android 휴대폰 에뮬레이터에서 실행해 확인했습니다(아래 '확인한 것'). **iOS 빌드와 실제 휴대폰 동작은 아직 확인하지 못했습니다.**

## 구조

```
packages/web  ──(vite build --mode app)──▶  packages/mobile/www  ──(cap sync)──▶  android/ · ios/
```

| 경로 | 내용 |
|---|---|
| `capacitor.config.ts` | 앱 ID·이름, 로그 끔 |
| `www/` | 웹의 앱용 빌드 결과 (git 제외, `npm run build:app`이 만듦) |
| `android/` | Android Studio 프로젝트 (Gradle 8.14.3 · AGP 8.13.0, minSdk 24 / targetSdk 36) |
| `ios/` | Xcode 프로젝트 (iOS 15 이상, Swift Package Manager) |
| `scripts/make-icons.py` | 앱 아이콘·시작 화면 그림 생성(차량 앱과 같은 표식). `rsvg-convert`·Pillow 필요 |
| `apk/` | 빌드해 둔 시험용 APK (git 제외) |
| [`../../apk/mobile/`](../../apk/mobile/) | 배포용 모바일 release APK (git 포함) |

중계 서버 주소는 한 곳(`car/gradle.properties`의 `tteonaljido.prodOrigin`)에만 있습니다. 웹의 앱용 빌드(`packages/web/vite.config.ts`)와 Android App Link 호스트(`android/app/build.gradle`)가 모두 이 값을 읽습니다. 시험 서버로 빌드하려면 `TTEONALJIDO_ORIGIN=https://… npm run build:app` (https만).

## 실행

필요 도구(Capacitor 8 기준): Node 22 이상, Android Studio Otter 2025.2.1 이상(JDK 21), iOS는 Xcode 26 이상.

```sh
npm install                               # 저장소 루트에서 한 번 (Capacitor 패키지 설치)
npm run app:sync                          # 웹 앱용 빌드 + android/·ios/로 복사

npm run android -w @tteonaljido/mobile    # Android Studio로 열기 → 실행
npm run ios -w @tteonaljido/mobile        # Xcode로 열기 → Signing에서 Team 선택 → 실행

# 또는 기기·에뮬레이터에 바로 설치
npm run run:android -w @tteonaljido/mobile
npm run run:ios -w @tteonaljido/mobile
```

화면이나 로직을 고치면 `npm run app:sync`를 다시 실행합니다. 일차 지도를 카카오 지도로 보려면 웹과 같이 `packages/web/.env.local`의 `VITE_KAKAO_JS_KEY`가 필요합니다(아래 '남은 일' 참고).

## APK

| 파일 | 내용 |
|---|---|
| [`../../apk/mobile/이충지_떠날지도_모바일용_release.apk`](../../apk/mobile/이충지_떠날지도_모바일용_release.apk) | 서명된 release, 버전 0.3.1(4), 6.9MB, 2026-11-15. sha256 `964b2bb0…` |
| `apk/떠날지도_모바일_debug.apk` | 예전(0.1.0) debug 빌드(임시 debug 키). release와 서명이 달라 서로 덮어 설치되지 않음 |

저장소 루트에서 `adb install -r apk/mobile/이충지_떠날지도_모바일용_release.apk`로 Android 7(API 24) 이상 휴대폰에 넣거나 파일을 옮겨 설치합니다.

- **서명**: 차량 앱과 같은 키(`.secrets/tteonaljido.jks`, 별칭 `tteonaljido`), APK 서명 v2 + v3. 인증서 SHA-256 지문은 `8F:E7:CC:E9:A3:62:10:A5:48:54:0B:2D:03:48:DB:89:DF:88:51:1F:55:3F:39:23:58:B4:52:C6:5D:0D:ED:99`이고 차량 APK와 같은 것을 확인했습니다. 이 지문이 App Link 검증 파일(남은 일 2)에 들어갑니다.
- **다시 만들기**: `.secrets/`가 있는 Mac에서 `npm run app:sync` 후 `cd android && ANDROID_HOME=~/Library/Android/sdk JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew :app:assembleRelease` → `app/build/outputs/apk/release/app-release.apk`. `android/app/build.gradle`이 차량 앱과 같은 `.secrets/signing.properties`를 읽고, 키가 없으면 서명 없이 만듭니다. (2026-11-11의 파일은 서명 없는 release를 따로 빌드한 뒤, 키가 있는 Mac 안에서 `apksigner`로 서명했습니다. 키와 비밀번호는 Mac 밖으로 나가지 않았습니다.)
- 카카오 지도 키(`packages/web/.env.local`)를 넣어 빌드했고, 에뮬레이터에서 카카오 지도가 실제로 표시됐습니다.
- 실제 휴대폰에서는 아직 실행해 보지 않았습니다(에뮬레이터만).

## 웹과 다른 점

앱에서만 달라지는 부분은 `packages/web/src/lib/platform.ts`(서버 주소·앱 여부), `nativeShell.ts`(QR 링크·뒤로 버튼), `fileOut.ts`(파일 내보내기)에 모았습니다. 웹 빌드에는 이 차이가 들어가지 않습니다.

| 항목 | 모바일 웹 | 휴대폰 앱 |
|---|---|---|
| 화면이 오는 곳 | 중계 서버(같은 출처) | 앱 안(`https://localhost`, iOS는 `capacitor://localhost`) |
| API 호출 | `/api/v1/…` (같은 출처) | 배포 주소로 교차 출처 호출. 서버는 위 두 출처만 CORS로 허용(`packages/worker/src/index.ts`) |
| CSP | 응답 헤더(`public/_headers`) | 같은 정책을 `<meta>`로 넣고 `connect-src`에 중계 서버 추가 |
| 차량 QR | 휴대폰 카메라 → 브라우저, 또는 연결 탭 스캔 | 연결 탭 스캔. 휴대폰 카메라로 읽어 앱이 열리게 하려면 링크 검증 파일 필요(남은 일) |
| 백업·친구 공유 파일 | 다운로드 / Web Share | 앱 캐시에 잠깐 쓴 뒤 시스템 공유 시트로 넘기고 바로 삭제 |
| Android 뒤로 버튼 | — | 앞 화면으로, 첫 화면에서는 앱을 뒤로 보냄 |
| '홈 화면에 추가' 안내 | 표시 | 숨김 |
| 기기 백업 | — | Android: 클라우드 백업·기기 이전에서 제외. iOS: 미적용(남은 일) |
| 로그 | — | Capacitor 로그 끔(`loggingBehavior: 'none'`): 파일 내용·QR 링크가 logcat·Xcode 콘솔에 남지 않게 |

QR 내용(`#v1.sid.scanSecret.fp`), 종단간 암호화, 전송 스키마, 저장 위치(휴대폰 안 IndexedDB)는 웹과 같습니다.

## 확인한 것 (2026-11-15, 0.2.0)

Android 15 휴대폰 에뮬레이터(Pixel 7)에 release APK를 설치해 확인했습니다.

- 서명 v2+v3, 인증서 지문이 차량 앱과 같음. 런처 아이콘·시작 화면이 새 아이콘
- 첫 화면: 하단 탭 없음, 상단 QR(연결)·톱니(설정), 플로팅 ＋ 메뉴(여행 추가·장소 추가), 샘플 여행 추가, 한국어·영어(기기 언어)
- 배포 서버 연결(CORS): 네이버 지도 저장 목록 링크 → '인천' 목록 9곳과 카카오 지도 표시
- 카카오맵 링크를 붙여넣으면 담지 않고 '카카오맵 링크는 지원하지 않아요' 안내
- QR 아이콘 → 카메라 스캔 화면(에뮬레이터 카메라라 실제 QR 인식은 미확인), Android 뒤로 버튼으로 앞 화면·첫 화면
- 앱은 지도 앱의 '공유'를 아직 받지 못하므로, 장소 화면의 '네이버 지도에서 공유 → 떠날지도' 안내는 앱에서 숨김(웹에는 그대로)

## 확인한 것 (2026-11-10)

- TypeScript 시험: shared 53 · worker 38(CORS 4개 추가) · web 147 통과, 타입 검사 통과
- 웹 빌드(`npm run build`) 결과물에는 Capacitor 코드가 들어가지 않음(파일 구성 그대로)
- 앱용 빌드를 데스크톱 Chrome(390×844)으로 열어 확인: CSP 위반 없이 첫 화면 표시, 설치 안내 숨김, QR 링크(`/c#v1…`) → 연결 화면 → 연결 요청이 배포 주소의 `/api/v1/sessions/…/claim`으로 나가고 오류 코드를 읽음(서버 응답은 가짜로 대체)
- Android: `./gradlew :app:assembleDebug` 성공(Linux x86_64, JDK 21). APK에서 권한(INTERNET·CAMERA), 백업 제외, App Link 호스트·경로(`/c`), 플러그인 3개(App·Filesystem·Share), 앱 아이콘(차량 앱과 같은 접힌 지도 + 핀) 확인

## 아직 확인하지 못한 것

- iOS 빌드(Xcode 필요)와 iOS에서의 동작 전부 — 특히 `capacitor://localhost`에서 WebCrypto(암호화)와 카메라가 되는지
- 실제 기기·에뮬레이터 실행: 카메라 QR 스캔, 공유 시트로 파일 내보내기, 백업 파일 가져오기, 뒤로 버튼, 다크 모드, 노치·제스처 바 여백
- 배포 서버와의 실제 연결 — CORS 변경은 **서버를 다시 배포해야** 적용됩니다(그 전에는 앱의 API 호출이 모두 막힘)

## 남은 일 (2차 PT 전)

- **위치 권한(M61)**: 웹은 출발 장소 '현재 위치'의 첫 구간을 휴대폰 위치로 계산합니다. 앱 포장에는 위치 권한(Android `ACCESS_COARSE_LOCATION`, iOS `NSLocationWhenInUseUsageDescription`)을 아직 선언하지 않아 앱에서는 그 구간이 비고 차량이 계산합니다. 권한을 선언하고 기기에서 확인해야 합니다.

1. **서버 배포**: `packages/worker` 재배포(CORS). 모바일 웹 동작은 바뀌지 않습니다.
2. **휴대폰 카메라 → 앱 열기**
   - Android: `packages/web/public/.well-known/assetlinks.json`에 패키지 `io.tteonaljido.mobile`과 release 서명 지문(위 'APK')을 등록한 뒤 서버 배포. debug 빌드는 지문이 달라 검증되지 않습니다.
   - iOS: Apple Developer 팀 ID로 `apple-app-site-association` 파일을 서버에 두고, Xcode에서 Associated Domains(`applinks:<서버 호스트>`) 추가. Associated Domains는 유료 개발자 계정이 필요합니다.
3. **카카오 지도**: JS 키는 도메인 제한이라 앱 출처(`https://localhost`)를 카카오 개발자 콘솔에 등록해야 합니다. iOS 출처(`capacitor://localhost`)를 등록할 수 있는지는 확인이 필요하며, 지도를 못 불러오면 지금처럼 SVG 스케치가 나옵니다.
4. **지도 앱 '공유'로 장소 담기**: 웹은 설치형 PWA의 공유 대상(`/add`)으로 받습니다. 앱은 Android 공유 인텐트 수신, iOS Share Extension을 따로 붙여야 합니다.
5. **붙여넣기**: 장소 붙여넣기의 `navigator.clipboard.readText()`가 앱 웹뷰에서 되는지 확인, 안 되면 Clipboard 플러그인.
6. **iOS 서명**(프로비저닝)·**iOS 백업 제외**, 실제 기기 점검. (Android release 서명과 앱 아이콘·시작 화면은 2026-11-11 완료. Play 스토어에 올리게 되면 모바일 전용 키로 분리할지 다시 정할 것)
