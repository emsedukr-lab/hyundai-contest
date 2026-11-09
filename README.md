# 떠날지도

**휴대폰에서 짠 여러 날 여행을 차량 화면의 일회용 QR로 불러와, 고정 일정·숙소·귀가까지 다시 확인하고 현대자동차그룹 내비게이션으로 다음 목적지를 안내하는 Pleos Connect 차량용 앱입니다.**

- 차량 앱: Kotlin · Jetpack Compose · Pleos Connect 2.1.5 디자인 토큰 · NaviHelper 3.0.5
- 모바일 웹: React 19 · Astryx 컴포넌트 + Pleos 모바일 테마 · 이 브라우저에만 저장 (계정 없음)
- 중계 서버: Cloudflare Worker + Durable Object · 종단간 암호화 (서버는 내용을 볼 수 없음) · 카카오 장소 검색·길찾기 중계 (저장·로그 없음)
- 배포: **https://tteonaljido.tteonaljido-worker.workers.dev** (모바일 웹 + API, 개인정보 안내 `/privacy`). 현재 M54 (2026-11-10)
- 시연 영상: [`media/demo/떠날지도_시연.mp4`](media/demo/떠날지도_시연.mp4) (2분) — release APK(Pleos 에뮬레이터)와 휴대폰 브라우저를 배포 서버로 연결한 실제 화면 녹화
- 세로 숏폼: [`media/demo/떠날지도_숏폼.mp4`](media/demo/떠날지도_숏폼.mp4) (56초, 1080×1920) — 같은 녹화에서 편집, 게시 문구는 `submission/숏폼_게시문구.md`
- 두 영상은 2026-11-05 녹화라 휴대폰 화면이 M43 이전 모습입니다. 마감 전 지금 화면으로 다시 녹화합니다. QR 불러오기 흐름은 같습니다.

## 주요 기능

**휴대폰 (모바일 웹)** — 하단 탭 여행·장소·연결·설정

- 여행 탭: 다음 여행 카드(D-day·전 일정 동선·준비 상태)와 다른 여행 목록(출발일 순, 날짜 겹침 표시). 왼쪽으로 밀어 삭제하고 8초 안에 되돌립니다.
- 새 여행 4단계 안내: 여행 정보 → 장소 담기 → 예약·꼭 갈 곳 → 경로 추천(날짜 나누기·방문 순서·카카오 이동시간) → [이 일정으로 시작].
- 편집기: 일차 칩 바, 하루 요약(운전 시간·거리·숙소 도착), 2줄 일정 카드, 끌어서 순서 바꾸기, 밀어서 빼기, 장소 상세 바텀 시트(도착 시각 자유·희망·고정/예약, 머무는 시간 프리셋).
- 시각은 오전/오후 30분 칩에서 고릅니다. 출발 시각은 모든 날 선택 사항입니다. 숙소는 '미정'과 '이어서 묵기' 칩이 있습니다.
- 이동시간·거리는 카카오모빌리티 길찾기로만 채우고, 당겨서 새로고침하면 지금 교통으로 다시 계산합니다.
- 일차 지도는 실제 도로 경로로 그립니다. 예약·고정 시각 앞에는 15분 여유를 둔 'HH:MM 출발'을 표시하고(휴대폰 화면만), 운전이 10분 이상 줄어드는 순서는 '더 빠른 순서' 카드로 제안합니다.
- 지도 앱 공유로 장소 담기, 친구에게 암호화 파일로 여행 공유(서버 미경유), 백업 내보내기·가져오기, 한국어·영어.

**차량 (Pleos Connect)**

- QR 불러오기: 일회용 QR → 6자리 확인 코드 → 재검증 요약 → 결정표(새 여행·업데이트·사본·불러오지 않기).
- 다음 목적지 안내(NaviHelper), 오늘 경로 묶음 전송(최대 3스톱), 이름만 있는 장소는 내비 검색으로 확인.
- 시간 지킴이(내비 남은 시간으로 여유·빠듯·늦음), 건너뛰기·미루기 제안, 자동 도착, '여기서 출발'(내비 예상·도착 시 배터리), EV·연료 권장.
- 주행 중에는 QR·승인 화면을 숨기고 다음 목적지 카드 하나만 보여 줍니다.

## 저장소 구조

| 경로 | 내용 |
|---|---|
| `packages/shared` | 전송 스키마(zod), 정규화 해시, 무결성 검사, WebCrypto E2E, 세션 상태 전이, 시각표, 샘플 여행 |
| `packages/worker` | Worker 라우터(`/api/v1`), `PairingSession` Durable Object, 카카오 장소 검색·길찾기(시간·거리·도로 경로)·공유 링크 해석, 웹 정적 파일 제공. 설정은 `wrangler.jsonc` |
| `packages/web` | 모바일 웹: 여행·편집기·연결(`/c`)·설정·개인정보 화면 |
| `car/` | 차량 앱: `core-trip`(파서·재검증·결정표·시각표), `core-pairing`(E2E 암호화·상태 머신), `app`(Compose UI·내비·저장소) |
| `schema/` | 언어 중립 계약: JSON Schema, 연결 프로토콜, TS·Kotlin 교차 시험 fixture |
| `design/` | Pleos 공식 디자인 에셋에서 추출한 토큰·Android 리소스·글꼴 ([design/README.md](design/README.md)) |
| `tools/` | E2E·스모크·실제 폰 시험, 시연 녹화·편집, 대비 점검, 접수양식 채우기 |
| `docs/` | 설계 문서 6종(아래), 화면 증거 `docs/evidence/`, 공모전·Pleos 조사 `docs/research/` |
| `submission/` | 제출물(아래) |
| `apk/` · `media/demo/` | 서명된 release APK · 시연 영상과 숏폼 |

## APK 위치

| 파일 | 상태 |
|---|---|
| `apk/떠날지도_release.apk` | 서명된 release (prod, 서버 `https://tteonaljido.tteonaljido-worker.workers.dev`). 2026-11-10 M48에서 재빌드했고 이후 차량 앱 변경은 없습니다. 제출 시 `팀명_떠날지도_release.apk`로 이름 변경. 해시는 `apk/SHA256SUMS.txt` |
| `car/app/build/outputs/apk/dev/debug/app-dev-debug.apk` | 로컬 개발용 (`./gradlew :app:assembleDevDebug`) |

## 실행 방법

### 1) 중계 서버 + 모바일 웹 (로컬)

```sh
npm ci --ignore-scripts
npm run dev        # 웹을 packages/web/dist로 빌드한 뒤 http://localhost:8787 (API + 웹)
```

- `packages/worker/.dev.vars`에 `KAKAO_REST_KEY=...`(카카오 REST 키)를 넣으면 장소 검색·이동시간·지도 도로 경로가 동작합니다. 없으면 장소는 이름으로 추가하고, 이동시간은 비워 두어 차량 내비가 계산합니다.
- `packages/web/.env.local`에 `VITE_KAKAO_JS_KEY=...`(도메인 제한 카카오 JS 키)를 넣고 빌드하면 일차 지도가 카카오 지도로 나옵니다. 없으면 외부 요청 없는 SVG 스케치입니다.
- 화면만 고칠 때는 `npm run dev -w @tteonaljido/web`(Vite, :5173, `/api`는 :8787로 전달)을 함께 띄웁니다.

### 2) 차량 앱 (Pleos Connect Emulator)

처음 clone했다면 Android SDK 위치를 알려 줍니다. Android Studio로 `car/`를 열면 `car/local.properties`가 자동으로 생기고, 터미널에서는 `export ANDROID_HOME=~/Library/Android/sdk`(macOS 기본 위치)로 지정합니다. 서명 키(`.secrets/`)가 없으면 release APK는 서명 없이 만들어집니다. 제출용 서명본은 `apk/`에 있습니다.

```sh
cd car
./gradlew :app:assembleDevDebug          # dev: 서버 http://10.0.2.2:8787
adb install -r app/build/outputs/apk/dev/debug/app-dev-debug.apk
adb shell am start --user 10 -n io.tteonaljido.car/.MainActivity   # 사용자 번호는 `adb shell am get-current-user`
```

### 3) 흐름 확인

1. 차량(기어 P): **모바일 여행 불러오기** → QR 표시
2. 휴대폰 역할: debug 빌드는 QR 링크를 logcat(`Tteonaljido`)에 남깁니다. 데스크톱 브라우저로 `http://localhost:8787/c#v1…`를 엽니다. 배포 서버에서는 실제 폰 카메라나 연결 탭의 '카메라로 차량 QR 스캔'으로 읽습니다.
3. [연결하고 확인 코드 보기] → 차량과 같은 6자리 확인 → [샘플 여행 추가] → 보낼 정보 확인 → [차량으로 보내기]
4. 차량: 요약·재검증 결과 확인 → [불러오기] → [여행 보기] → [다음 목적지 안내]

샘플 여행은 연결 화면의 [샘플 여행 추가]나 `/?sample=1`로 넣습니다.

## 시험

```sh
npm test                    # shared 53 · worker 34 · web 147 (TypeScript 234)
npm run typecheck
(cd car && ./gradlew test)  # Kotlin 137 (car 모듈)
npm run smoke               # 서버 흐름 (기본 http://localhost:8787, 다른 주소는 `npm run smoke -- <URL>`)
npm run e2e                 # Chrome 휴대폰 + 가짜 차량 (같은 방식으로 주소 지정, 화면은 docs/evidence/m3/에 덮어씀)
npm run e2e:car             # 에뮬레이터 차량 앱(dev debug) + Chrome 휴대폰 (기본 emulator-5580)
npx tsx tools/phone-test.mts                 # 실제 폰 + 가짜 차량 (Mac 화면에 QR 표시, 기본 배포 서버)
npx tsx tools/record-demo.mts emulator-5580  # release APK + 배포 서버 전체 흐름 녹화·메모리 기록
npx tsx tools/compose-demo.mts               # 녹화 → media/demo/떠날지도_시연.mp4
npx tsx tools/compose-shorts.mts             # 녹화 → media/demo/떠날지도_숏폼.mp4 (세로)
```

2026-11-10(M54) 기준 TypeScript 234개와 Kotlin 137개가 모두 통과하고, 모바일 E2E(`npm run e2e`)도 통과합니다. 전송 스키마를 바꾸면 `npm run schema`로 JSON Schema·fixture를 다시 만들고 TS·Kotlin 시험을 모두 돌립니다.

## 배포

```sh
npm run build                                   # packages/web/dist (지도 키는 packages/web/.env.local)
(cd packages/worker && npx wrangler deploy)     # Worker 하나가 API와 웹을 함께 제공
(cd packages/worker && npx wrangler secret put KAKAO_REST_KEY)   # 처음 한 번 (장소 검색·길찾기)
```

- 정적 파일 보안 헤더(CSP·no-referrer·HSTS 등)는 `packages/web/public/_headers`에 있습니다.
- `wrangler.jsonc`에서 요청 제한(세션 생성·claim·API·검색·길찾기)을 정하고, 요청 로그가 남지 않도록 observability를 꺼 둡니다.
- 차량 prod 빌드의 서버 주소는 `car/gradle.properties`의 `tteonaljido.prodOrigin`(또는 `-Ptteonaljido.prodOrigin=https://…`)입니다.

## 테스트 환경과 설정

| 항목 | 값 |
|---|---|
| 에뮬레이터 | Pleos Connect Emulator 2.1.0, Android 14(API 34) arm64, 2560×1440 160dpi, RAM 4GB, `-gpu host`로 cold boot 권장 |
| 개발 도구 | Android Studio 내장 JDK 21, AGP 9.2.1, Gradle 9.4.1, compileSdk 37 / targetSdk 34 / minSdk 28 |
| Node | 22.13 이상 (wrangler 4.151.3, Vite 7.3.7) |
| 브라우저 | Chrome/Safari 최신 (WebCrypto 필요 → HTTPS 또는 localhost) |
| 권한 | `INTERNET`, `ACCESS_NETWORK_STATE`, `pleos.car.permission.NAVI_ROUTE`, `NAVI_ROUTE_SEARCH`, `NAVI_CUSTOM_MAP` |
| 서버 주소 | dev: `-Ptteonaljido.devApi`, `-Ptteonaljido.devWeb` / prod: `car/gradle.properties`의 `tteonaljido.prodOrigin` (배포 주소) |
| 설치 | `adb install -r apk/떠날지도_release.apk` (기어 P 상태에서 실행) |
| 시연 모드 | 설정 → 시연 모드 (에뮬레이터 전용, 데이터 별도 보관, 주행 시연 스위치) |

## 제출물 (`submission/`)

| 파일 | 내용 |
|---|---|
| `기획서_초안.md` | 접수양식 02장(앱 프로젝트 소개) 원본. `tools/fill_form.py`로 DOCX에 옮김 |
| `떠날지도_접수양식_초안.docx` | 공식 접수양식에 채운 초안. 01 참가신청서·동의·서명은 직접 작성 |
| `떠날지도_소개서.html` · `.pdf` | 소개서와 진행 현황 |
| `떠날지도_파이프라인_한장.html` · `.pdf` | A4 한 장 요약 |
| `숏폼_게시문구.md` | 숏폼 게시 문구·해시태그 |

APK(`apk/`)와 시연 영상(`media/demo/`)도 함께 제출합니다. 마감(2026-11-15) 전 남은 일은 지금 휴대폰 화면으로 영상 다시 녹화, 실제 폰 점검, 팀명 확정 후 파일 이름 변경입니다.

## 문서

| 문서 | 내용 |
|---|---|
| [01 사용자 흐름](docs/01_사용자_흐름.md) | 휴대폰에서 여행 만들기, 11단계 불러오기 흐름, 화면·문구, 결정표, 복구, 주행 중 동작, 검수 기준 대응 |
| [02 기술 구조](docs/02_기술_구조.md) | 프로토콜·암호화·스키마·재검증·내비 연동·모바일 웹·시험·배포, 지속 동기화·주차 시간 추정 설계(미구현) |
| [03 개인정보 설계](docs/03_개인정보_설계.md) | 데이터 위치·보관 기간, 카카오로 보내는 좌표, 집 주소 동의, 삭제, 위협 모델 |
| [04 디자인 시스템](docs/04_디자인_시스템.md) | 차량 Pleos 토큰·컴포넌트, QR 규격, 휴대폰 Pleos 모바일 테마와 화면, 대비·인식 시험 |
| [05 개발 계획](docs/05_개발_계획.md) | 마일스톤(M0~M54), 실제와 시연의 구분, 위험, 남은 작업 |
| [06 시연 시나리오](docs/06_시연_시나리오.md) | PT 대본, 장애 대응, 정직하게 밝힐 범위 |

공식 디자인 자료와 추출 방법은 [design/README.md](design/README.md), 공모전·Pleos 조사는 `docs/research/`에 있습니다.
