# 떠날지도

**가고 싶은 장소만 담으면 날짜별로 효율적인 동선을 자동으로 짜 주고, 그 여행을 차량 화면의 일회용 QR로 불러와 고정 일정·숙소·귀가까지 다시 확인한 뒤 현대자동차그룹 내비게이션이 순서대로 안내하는 Pleos Connect 차량용 앱입니다.**

출발점: 여행 계획에서 장소를 고르는 일은 어렵지 않지만, 고른 장소를 날짜별로 나누고 효율적인 순서로 동선을 짜는 데 가장 많은 시간이 들고, 이 일을 건너뛰면 여행 시간의 대부분을 이동에 쓰게 됩니다. 떠날지도는 이 동선 구성을 자동으로 하는 데서 시작했습니다.

- 차량 앱: Kotlin · Jetpack Compose · Pleos Connect 2.1.5 디자인 토큰 · NaviHelper 3.0.5
- 모바일 웹: React 19 · Astryx 컴포넌트 + Pleos 모바일 테마 · 이 브라우저에만 저장 (계정 없음)
- 중계 서버: Cloudflare Worker + Durable Object · 종단간 암호화 (서버는 내용을 볼 수 없음) · 카카오 장소 검색·길찾기 중계 (저장·로그 없음)
- 배포: **https://tteonaljido.tteonaljido-worker.workers.dev** (모바일 웹 + API, 개인정보 안내 `/privacy`). 현재 M64 (2026-11-14, 휴대폰 [경로 추천]을 여행 전체 최적화 엔진으로 교체. 전날 M63: 차량이 현대차 내비로 전 구간의 시간·거리를 재고 날짜별 방문 순서를 내비 기준으로 최적화. 같은 날 M61: 휴대폰이 첫 구간을 현재 위치·집·회사·즐겨찾기 기준으로 계산. 같은 날 M60: 차량이 1일차 첫 구간을 내비 예상으로 자동 계산. 같은 날 M59: 출발지 규칙 — 1일차는 현재 위치(기본)·집·회사·즐겨찾기, 2일차부터는 전날 숙소 — 와 샘플 여행의 네이버 지도 영업시간 반영, 서명 APK 0.6.0). 디자인은 M58(2026-11-12)에 Pleos Connect 공식 디자인 명세 `design/DESIGN.md`로 전면 교체
- 시연 영상: [`media/demo/떠날지도_시연.mp4`](media/demo/떠날지도_시연.mp4) (3분 42초, 2026-11-10 M55 재녹화) — 새 여행의 동선 자동 구성부터 차량 불러오기·내비 안내까지, release APK 0.3.0(Pleos 에뮬레이터)와 휴대폰 브라우저를 배포 서버로 연결한 실제 화면 녹화
- 세로 숏폼: [`media/demo/떠날지도_숏폼.mp4`](media/demo/떠날지도_숏폼.mp4) (56초, 1080×1920) — 같은 녹화에서 편집, 게시 문구는 `submission/숏폼_게시문구.md`
- 시연 영상(2026-11-10)과 숏폼(2026-11-05)은 디자인 교체(M58, 2026-11-12) 전 화면입니다. 기능과 흐름은 같고, 지금 화면은 `docs/evidence/m58`·`docs/evidence/live-pair`(차량 ↔ 휴대폰 실제 연동)와 소개서에 있습니다. 영상은 다시 녹화할 예정입니다.

## 주요 기능

**휴대폰 (모바일 웹)** — 하단 탭 여행·장소·연결·설정

- 여행 탭: 다음 여행 카드(D-day·전 일정 동선·준비 상태)와 다른 여행 목록(출발일 순, 날짜 겹침 표시). 왼쪽으로 밀어 삭제하고 8초 안에 되돌립니다.
- 새 여행 4단계 안내: 여행 정보 → 장소 담기 → 예약·꼭 갈 곳 → 경로 추천(날짜 나누기·방문 순서·카카오 이동시간) → [이 일정으로 시작].
- 경로 추천 엔진(M64, `packages/shared/src/optimizer.ts`): 여행 전체를 한 번에 놓고 날짜 배정과 순서를 함께 정합니다(적응형 대규모 근방 탐색 + 담금질, 의존성 없는 TypeScript). 계획 규칙은 이동마다 주차 10분, 예약은 10분 전 도착 후 정각 시작, 문 열기 전·쉬는 시간은 기다림, 쉬는 날·영업시간 밖은 금지, 식사는 식사 시간대(하루 한 번씩), 카페는 하루 2곳까지·점심 뒤가 가장 좋음, 숙소가 바뀌는 날은 퇴실·입실 시간. 이동시간은 잰 값을 먼저 쓰고 없으면 직선거리로 추정한 뒤, 추천 순서의 실제 시간을 받아 한 번 더 계산합니다. 2시간 이상 비는 시간과 입실·퇴실에 걸리는 날은 추천 결과에 알려 주고, 즐겨찾기 가운데 들어갈 만한 곳을 보여 줍니다. 이미 날짜에 넣은 장소는 뚜렷한 이득이 있을 때만 다른 날로 옮기고, 지금 계획보다 낫지 않으면 그대로 둡니다. 새 장소의 머무는 시간은 종류별 기본값(식사 60·카페 45·관광 90분)으로 시작합니다.
- 늦게 출발하기(`lib/laterStart.ts`): 그 날의 첫 예약에 15분 일찍 닿고도 1시간 이상 남으면, 기다리거나 다른 곳을 넣는 대신 **출발을 늦추는 대안**을 일차 제목 아래 카드로 보여 줍니다('오전 11:00에 출발해도 돼요', [오전 11:00 출발]). 숙소를 떠나는 날은 퇴실 시간이 한도이고(입력한 시간, 없으면 통상 11:00이라고 밝힘), 같은 숙소에 또 묵는 날은 한도가 없습니다. 늦춘 시각에 영업시간이 깨지는 곳이 있으면 그보다 이른 시각을 제안합니다. 경로 추천 결과에도 한 줄로 나옵니다.
- 검색한 장소의 종류(관광·산책 / 식사 / 카페·디저트 / 숙소 / 기타)는 카카오 분류에서 정합니다. 카카오가 음식점으로 주는 곳 가운데 간식 갈래는 식사하는 곳이 아니어서 떡·한과 가게 등은 '기타', 제과·아이스크림 등은 '카페·디저트'로 둡니다(이미 담아 둔 장소는 장소 상세의 종류에서 바꿉니다). '꼭 갈 곳'은 3단계에서 핀을 눌러 정하고, 일정에도 같은 핀으로 표시됩니다.
- 편집기: 일차 칩 바, 하루 요약(운전 시간·거리·숙소 도착), 2줄 일정 카드, 끌어서 순서 바꾸기, 밀어서 빼기, 장소 상세 바텀 시트(도착 시각 자유·희망·고정/예약, 머무는 시간 프리셋).
- 시각은 오전/오후 30분 칩에서 고릅니다. 출발 시각은 모든 날 선택 사항입니다. 숙소는 '미정'과 '이어서 묵기' 칩이 있습니다.
- 출발 장소: 1일차는 현재 위치(기본)·집·회사·즐겨찾기 1~3·여행의 장소 중에서 고르고, 2일차부터는 전날 숙소에서 출발합니다. 첫 구간 이동시간은 고른 출발지에서 계산합니다 — 집·회사·즐겨찾기는 설정에 넣은 주소로, '현재 위치'는 허용한 경우 이 휴대폰의 위치(약 100m 단위, 저장·전송 안 함)로(M61). 차량에서는 차량의 현재 위치로 다시 계산합니다.
- 영업시간: 장소마다 '모름 · 따로 없음 · 직접 입력' 중 하나입니다. 직접 입력은 요일별 시간·정기 휴무·쉬는 시간을 담고, 방문 시각이 영업시간 밖이거나 휴무일이면 휴대폰과 차량이 알려 줍니다. 호수·해변·거리처럼 영업시간이 따로 없는 곳은 '따로 없음'으로 두면 차량이 '영업정보 미확인'으로 세지 않습니다. 샘플 '강릉 3박 4일'에는 네이버 지도(2026-11-13)에서 확인한 9곳의 영업시간이 들어 있고, 경포호·안목해변 커피거리는 '따로 없음'입니다.
- 이동시간·거리는 카카오모빌리티 길찾기로만 채우고, 당겨서 새로고침하면 지금 교통으로 다시 계산합니다. 휴대폰의 값은 일정을 짤 때 쓰는 예상값이고, 차량에서는 현대차 내비가 다시 잽니다(M63, 구간 시트와 전송 동의 화면에 그렇게 적음).
- 일차 지도는 실제 도로 경로로 그립니다. 예약·고정 시각 앞에는 15분 여유를 둔 'HH:MM 출발'을 표시하고(휴대폰 화면만), 운전이 10분 이상 줄어드는 순서는 '더 빠른 순서' 카드로 제안합니다.
- 지도 앱 공유로 장소 담기, 친구에게 암호화 파일로 여행 공유(서버 미경유), 백업 내보내기·가져오기, 한국어·영어.

**차량 (Pleos Connect)**

- QR 불러오기: 일회용 QR → 6자리 확인 코드 → 재검증 요약 → 결정표(새 여행·업데이트·사본·불러오지 않기).
- 다음 목적지 안내(NaviHelper), 오늘 경로 묶음 전송(최대 3스톱), 이름만 있는 장소는 내비 검색으로 확인.
- 시간 지킴이(내비 남은 시간으로 여유·빠듯·늦음), 건너뛰기·미루기 제안, 자동 도착, '여기서 출발'(내비 예상·도착 시 배터리. 1일차는 출발지를 현재 위치로 바꾸고, 2일차부터는 전날 숙소 출발을 그대로 둠), EV·연료 권장.
- 1일차 첫 구간 자동 계산(M60): 계획에 첫 구간 이동시간이 없으면(출발지가 '현재 위치'이거나 휴대폰에 집 주소가 없을 때) 주차 중 여행을 열 때 내비에 현재 위치 기준 예상을 물어 채웁니다. 버튼을 누르지 않아도 1일차 시각이 계산됩니다.
- 현대차 내비로 전 구간 측정(M63): 차량에서는 내비가 잰 값이 구간의 시간·거리입니다. [전 구간 내비로 측정]을 누르고 확인하면 내비에 경유지 경로를 걸어 구간별 시간·거리를 읽고 경로를 지웁니다(`requestTrip`은 차가 있는 곳에서만 재므로, 떨어진 구간은 경유지별 남은 값의 차이로 구함). 잰 구간은 '↓ 7분 · 3.0km · 내비', 하루 요약은 '운전 37분 · 17.0km'로 표시됩니다. 샘플 여행 13구간이 경로 2번, 약 30초입니다.
- 내비 기준 순서 최적화(M63): [N일차 순서 최적화]는 그 날 장소 사이의 모든 구간을 내비로 재고 가장 빠른 순서를 찾습니다. 운전이 10분 이상 줄고 시간표 충돌·예약 15분 여유를 해치지 않을 때만 제안하며, [이 순서로 바꾸기]는 차량에서만 순서를 바꿉니다(휴대폰이 보낸 계획은 그대로, [계획 순서로 되돌리기]).
- '오늘 경로 전송'은 남은 장소를 모두(최대 10곳) 경유지로 보냅니다(M63 전에는 3곳).
- 차량 신호 조합(M57, 모두 조회 전용): 출발 전 점검(주행가능거리 × 오늘 남은 거리, 탑승 × 안전벨트, 문·트렁크, 충전 포트 등), 일정 끝 배터리 예상, 2시간 연속 운전 시 쉬어 가기 권고(휴게소 거리·일정 여유와 함께), 오늘 경로를 보낸 뒤 경유지마다 도착 표시·다음 장소 기준 도착 예정, 가는 길 정체. 무엇을 써서 무엇을 만들었는지는 [docs/research/04_Pleos_SDK_API_활용.md](docs/research/04_Pleos_SDK_API_활용.md).
- 주행 중에는 QR·승인 화면을 숨기고 다음 목적지 카드 하나만 보여 줍니다.

## 저장소 구조

| 경로 | 내용 |
|---|---|
| `packages/shared` | 전송 스키마(zod), 정규화 해시, 무결성 검사, WebCrypto E2E, 세션 상태 전이, 시각표, 샘플 여행, Fleet 웹훅 payload 검사·준비 점검(`fleet.ts`) |
| `packages/worker` | Worker 라우터(`/api/v1`), `PairingSession` Durable Object, 카카오 장소 검색·길찾기(시간·거리·도로 경로)·공유 링크 해석, Fleet API 웹훅 수신(`FleetVehicle` Durable Object, 토큰이 없으면 꺼짐), 웹 정적 파일 제공. 설정은 `wrangler.jsonc` |
| `packages/web` | 모바일 웹: 여행·편집기·연결(`/c`)·설정·개인정보 화면 |
| `packages/mobile` | 휴대폰 앱(Android·iOS): 모바일 웹 화면을 Capacitor로 포장한 네이티브 프로젝트. 뼈대 단계 — [packages/mobile/README.md](packages/mobile/README.md) |
| `car/` | 차량 앱: `core-trip`(파서·재검증·결정표·시각표·출발 전 점검·배터리 예상·쉬어 가기), `core-pairing`(E2E 암호화·상태 머신), `app`(Compose UI·내비·차량 신호 조회·저장소) |
| `schema/` | 언어 중립 계약: JSON Schema, 연결 프로토콜, TS·Kotlin 교차 시험 fixture |
| `design/` | 디자인의 단일 기준 [design/DESIGN.md](design/DESIGN.md)(Pleos Connect 2.1.5 공식 디자인 에셋 명세)와, 같은 에셋에서 추출한 토큰·Android 리소스·글꼴 ([design/README.md](design/README.md)) |
| `tools/` | E2E·스모크·실제 폰 시험, 시연 녹화·편집, 대비 점검, 접수양식 채우기 |
| `docs/` | 설계 문서 6종(아래), 화면 증거 `docs/evidence/`, 공모전·Pleos 조사 `docs/research/` |
| `submission/` | 제출물(아래) |
| `apk/` · `media/demo/` | 서명된 release APK · 시연 영상과 숏폼 |

## APK 위치

| 파일 | 상태 |
|---|---|
| `apk/떠날지도_release.apk` | 서명된 release (prod, 서버 `https://tteonaljido.tteonaljido-worker.workers.dev`). 버전 0.6.0(6), 2026-11-13 M59 출발지 규칙 반영 후 재빌드(서명 v2+v3). 그 전 0.5.0: M58 디자인 전면 교체(`design/DESIGN.md`). 권한은 조회 전용뿐: 내비 3종과 `CAR_ENERGY`·`CAR_DRIVE`·`CAR_SAFETY`·`CAR_DOORS`·`CAR_SEATS`(제어·비공개 권한 없음). 로터리 미지원 선언·적응형 아이콘 포함. 제출 시 `팀명_떠날지도_release.apk`로 이름 변경. 해시는 `apk/SHA256SUMS.txt` |
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
npm test                    # shared 111 · worker 53 · web 172 (TypeScript 336)
npm run typecheck
(cd car && ./gradlew test)  # Kotlin 212 (car 모듈)
npm run smoke               # 서버 흐름 (기본 http://localhost:8787, 다른 주소는 `npm run smoke -- <URL>`)
npm run e2e                 # Chrome 휴대폰 + 가짜 차량 (같은 방식으로 주소 지정, 화면은 docs/evidence/m3/에 덮어씀)
npm run e2e:car             # 에뮬레이터 차량 앱(dev debug) + Chrome 휴대폰 (기본 emulator-5580)
npx tsx tools/live-pair.mts # 서명 release APK + 배포된 모바일 웹·서버 실제 연동, 양쪽 화면을 docs/evidence/live-pair/에 저장
npx tsx tools/fleet-webhook-sample.mts       # Fleet 웹훅 예시 payload → 로컬 wrangler dev (토큰은 .dev.vars, 파일 머리말 참고)
npx tsx tools/phone-test.mts                 # 실제 폰 + 가짜 차량 (Mac 화면에 QR 표시, 기본 배포 서버)
npx tsx tools/record-demo.mts emulator-5580  # release APK + 배포 서버 전체 흐름 녹화·메모리 기록
npx tsx tools/compose-demo.mts               # 녹화 → media/demo/떠날지도_시연.mp4
npx tsx tools/compose-shorts.mts             # 녹화 → media/demo/떠날지도_숏폼.mp4 (세로)
```

2026-11-14(M64) 기준 TypeScript 336개와 Kotlin 212개가 모두 통과하고, 모바일 E2E(`npm run e2e`, 15항목)와 차량 에뮬레이터 E2E(`tools/e2e-car.mts`, 16항목)도 통과합니다. 같은 날 서명 release APK 0.6.0과 배포 서버·모바일 웹의 실제 연동(`tools/live-pair.mts`, 15항목)을 다시 확인했습니다([다음 목적지 안내]로 Pleos 내비가 경로 안내를 시작하는 것까지 0.6.0으로 확인) — 화면은 `docs/evidence/live-pair/overview.png`(2026-11-13 0.6.0으로 다시 저장). 출발지 규칙과 영업시간 화면은 `docs/evidence/m59`에, 내비 측정·순서 최적화 화면은 `docs/evidence/m63`에 있습니다. 전송 스키마를 바꾸면 `npm run schema`로 JSON Schema·fixture를 다시 만들고 TS·Kotlin 시험을 모두 돌립니다.

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
| `기획서_초안.md` | 접수양식 02장(앱 프로젝트 소개) 원본. `tools/fill_form.py`로 DOCX에 옮김 — 글줄은 답변 칸에, `![설명](figures/…)` 줄은 같은 칸의 그림(캡션 '그림 N.')으로 |
| `figures/` | 접수양식 그림 15장(three.js 3D 장면 5장 + 실제 앱 화면을 엮은 그림 10장)과 원본(`figures/src`) |
| `떠날지도_접수양식_초안.docx` | 공식 접수양식에 채운 초안(02장 8칸 + 그림 15장, A4 12쪽). 01 참가신청서·동의·서명은 직접 작성 |
| `떠날지도_소개서.html` · `.pdf` | 소개서와 진행 현황 |
| `떠날지도_파이프라인_한장.html` · `.pdf` | A4 한 장 요약 |
| `숏폼_게시문구.md` | 숏폼 게시 문구·해시태그 |

APK(`apk/`)와 시연 영상(`media/demo/`)도 함께 제출합니다. 마감(2026-11-15) 전 남은 일은 숏폼 다시 만들기, 실제 폰 점검, 팀명 확정 후 파일 이름 변경입니다.

## 문서

| 문서 | 내용 |
|---|---|
| [01 사용자 흐름](docs/01_사용자_흐름.md) | 휴대폰에서 여행 만들기, 11단계 불러오기 흐름, 화면·문구, 결정표, 복구, 주행 중 동작, 검수 기준 대응 |
| [02 기술 구조](docs/02_기술_구조.md) | 프로토콜·암호화·스키마·재검증·내비 연동·모바일 웹·시험·배포, 지속 동기화·주차 시간 추정 설계(미구현) |
| [03 개인정보 설계](docs/03_개인정보_설계.md) | 데이터 위치·보관 기간, 카카오로 보내는 좌표, 집 주소 동의, 삭제, 위협 모델 |
| [04 디자인 시스템](docs/04_디자인_시스템.md) | 차량 Pleos 토큰·컴포넌트, QR 규격, 휴대폰 Pleos 모바일 테마와 화면, 대비·인식 시험 |
| [05 개발 계획](docs/05_개발_계획.md) | 마일스톤(M0~M55), 실제와 시연의 구분, 위험, 남은 작업 |
| [06 시연 시나리오](docs/06_시연_시나리오.md) | PT 대본, 장애 대응, 정직하게 밝힐 범위 |

공식 디자인 자료와 추출 방법은 [design/README.md](design/README.md), 공모전·Pleos 조사는 `docs/research/`에 있습니다.
