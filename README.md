# 떠날지도

가고 싶은 장소만 담으면 날짜별 동선을 자동으로 짜 주고, 그 여행을 차량 화면의 QR로 불러와 현대자동차그룹 내비게이션이 순서대로 안내하는 Pleos Connect 차량용 앱입니다.

| 항목 | 내용 |
|---|---|
| 앱 이름 | 떠날지도 (`io.tteonaljido.car`) |
| 한 줄 소개 | 장소만 담으면 날짜별 동선을 짜 주고, 차에서 QR로 불러와 내비가 순서대로 안내하는 여행 앱 |
| APK | [`apk/이충지_떠날지도_release.apk`](apk/이충지_떠날지도_release.apk) · release 0.9.0 (versionCode 9) · 서명 v2+v3 · SHA-256은 [`apk/SHA256SUMS.txt`](apk/SHA256SUMS.txt) |
| 개발 에뮬레이터 | Pleos Connect Emulator 2.1.0 (Android 14, API 34, arm64) |
| 화면 규격 | 2560×1440, 160dpi (Connect-S-17 기본) |
| 휴대폰 웹 | https://tteonaljido.tteonaljido-worker.workers.dev (설치 없이 브라우저에서 사용) |
| 시연 영상 | [`media/demo/떠날지도_시연.mp4`](media/demo/떠날지도_시연.mp4) (3분 42초) |

## 실행 방법

### APK로 바로 실행 (권장)

release APK는 배포된 서버에 연결되어 있어 서버를 따로 띄울 필요가 없습니다.

1. Pleos Connect Emulator 2.1.0 AVD를 cold boot로 켭니다 (RAM 4GB, `-gpu host` 권장).
2. APK를 설치합니다.
   ```sh
   adb install -r apk/이충지_떠날지도_release.apk
   ```
3. 차량(기어 P): 떠날지도 실행 → **모바일 여행 불러오기** → QR 표시
4. 휴대폰: 위 휴대폰 웹 첫 화면 오른쪽 위의 **QR 아이콘(연결)**에서 차량 QR을 스캔 → 차량과 같은 6자리 확인 코드 확인 → **샘플 여행 추가** → **차량으로 보내기**
5. 차량: 요약 확인 → **불러오기** → **여행 보기** → **길안내 시작** (Pleos 내비가 안내 시작)

### 소스에서 빌드

```sh
# 중계 서버 + 휴대폰 웹 (http://localhost:8787)
npm ci --ignore-scripts
npm run dev

# 차량 앱 (dev: 에뮬레이터에서 10.0.2.2:8787로 접속)
cd car
./gradlew :app:assembleDevDebug
adb install -r app/build/outputs/apk/dev/debug/app-dev-debug.apk
adb shell am start --user 10 -n io.tteonaljido.car/.MainActivity
```

- release 빌드는 `./gradlew :app:assembleProdRelease`입니다. 서버 주소는 `car/gradle.properties`의 `tteonaljido.prodOrigin`이고, 서명 키가 없으면 서명 없이 만들어집니다.
- dev 빌드는 QR 링크를 logcat(`Tteonaljido`)에 남기므로, 데스크톱 브라우저에서 `http://localhost:8787/c#v1…`를 열어 휴대폰 역할을 할 수 있습니다.
- 샘플 여행은 연결 화면의 **샘플 여행 추가** 또는 `/?sample=1`로 넣습니다.
- 커밋 메시지 검사: `brew install lefthook && lefthook install` (첫 줄 `영역: 무엇을`, 영역은 차량·휴대폰·서버·공통·문서·제출)

## 테스트 환경 및 필요한 설정

| 항목 | 값 |
|---|---|
| 에뮬레이터 | Pleos Connect Emulator 2.1.0, Android 14(API 34) arm64, 2560×1440 160dpi, RAM 4GB, cold boot |
| 개발 도구 | Android Studio 내장 JDK 21, AGP 9.2.1, Gradle 9.4.1, compileSdk 37 / targetSdk 34 / minSdk 28 |
| Node | 22.13 이상 (wrangler 4.151.3, Vite 7.3.7) |
| 브라우저 | Chrome·Safari 최신 (WebCrypto 사용, HTTPS 또는 localhost 필요) |
| 권한 | 내비 `NAVI_ROUTE`·`NAVI_ROUTE_SEARCH`·`NAVI_CUSTOM_MAP`, 차량 신호 조회 `CAR_ENERGY`·`CAR_DRIVE`·`CAR_SAFETY`·`CAR_DOORS`·`CAR_SEATS`, `INTERNET`, `FOREGROUND_SERVICE` (차량 제어 권한 없음) |
| 카카오 키 (선택) | `packages/worker/.dev.vars`에 `KAKAO_REST_KEY`를 넣으면 로컬에서 장소 검색·이동시간이 동작합니다. 배포 서버에는 이미 설정되어 있습니다. |
| 시연 모드 | 차량 앱 설정 → 시연 모드 (에뮬레이터 전용, 데이터 별도 보관) |
| 알려진 제약 | Apple Silicon Mac에서는 Virtual Console로 차량 신호(기어·SOC·주행가능거리)를 넣을 수 없어, 이 신호는 지원 GPU가 있는 Windows/Linux PC에서 시험해야 합니다. |

## 주요 기능

**휴대폰 (웹)**
- 새 여행 4단계: 여행 정보 → 장소 담기 → 예약·꼭 갈 곳 → 경로 추천
- 장소 담기: 카카오 검색, 지도에서 보고 담기, 네이버 지도 공유(장소 하나 또는 '저장 목록' 통째로). 카카오맵 공유 링크는 지원하지 않습니다
- 여행 전체를 한 번에 놓고 날짜 배정과 방문 순서를 정하는 동선 최적화 (영업시간·예약·아침·점심·저녁 식사 시간·숙소 입실/퇴실 반영)
- 카카오모빌리티 길찾기로 이동시간·거리, 실제 도로 경로 지도
- 출발을 늦춰도 되는 날은 늦게 출발하기 제안
- 계정 없이 이 브라우저에만 저장, 서버를 거치는 내용은 종단간 암호화

**차량 (Pleos Connect)**
- 일회용 QR과 6자리 확인 코드로 여행 불러오기, 불러오기 전 재검증
- 첫 화면 다음 여행 카드에 카카오 지도 미리보기, 상세는 하루 동선(장소 종류·시간·경고 뱃지)과 다음 목적지
- NaviHelper로 다음 목적지 안내와 오늘 경로 경유지 전송
- 현대차 내비로 전 구간 시간·거리를 재고 날짜별 방문 순서 최적화
- 내비 남은 시간으로 여유·빠듯·늦음 표시, 건너뛰기·미루기 제안
- 출발 전 점검(주행가능거리·안전벨트·문), 배터리 예상, 2시간 연속 운전 시 휴식 권고 (모두 조회 전용)
- 주행 중에는 QR·승인 화면을 숨기고 다음 목적지 카드만 표시

자세한 동작은 [docs/00_주요_기능_상세.md](docs/00_주요_기능_상세.md)에 있습니다.

## 저장소 구조

| 경로 | 내용 |
|---|---|
| `car/` | 차량 앱 (Kotlin, Jetpack Compose) |
| `packages/web` | 휴대폰 웹 (React) |
| `packages/worker` | 중계 서버 (Cloudflare Worker, Durable Object) |
| `packages/shared` | 전송 스키마, 암호화, 동선 최적화 엔진 |
| `schema/` | TS·Kotlin 공통 JSON Schema와 시험 fixture |
| `design/` | Pleos Connect 디자인 기준과 토큰 |
| `docs/` | 설계 문서, 화면 기록, 조사 자료 |
| `tools/` | E2E·스모크 시험, 시연 녹화 도구 |
| `apk/` · `media/demo/` | 서명된 release APK, 시연 영상 |
| `submission/` | 접수양식, 소개서 |

## 시험

```sh
npm test                    # TypeScript 392개
npm run typecheck
(cd car && ./gradlew test)  # Kotlin 221개
npm run e2e                 # 휴대폰 + 가짜 차량
npm run e2e:car             # 에뮬레이터 차량 앱 + 휴대폰
```

## 문서

| 문서 | 내용 |
|---|---|
| [00 주요 기능 상세](docs/00_주요_기능_상세.md) | 휴대폰·차량 기능별 동작 |
| [01 사용자 흐름](docs/01_사용자_흐름.md) | 여행 만들기, 불러오기 흐름, 주행 중 동작 |
| [02 기술 구조](docs/02_기술_구조.md) | 연결 프로토콜, 암호화, 내비 연동, 배포 |
| [03 개인정보 설계](docs/03_개인정보_설계.md) | 데이터 위치·보관 기간, 위협 모델 |
| [04 디자인 시스템](docs/04_디자인_시스템.md) | Pleos 토큰·컴포넌트, 대비 시험 |
| [05 개발 기록](docs/05_개발_계획.md) | 남은 일, 날짜별 변경 기록, 실제 동작과 시연의 구분, 위험 |
| [06 시연 시나리오](docs/06_시연_시나리오.md) | 시연 순서와 장애 대응 |
