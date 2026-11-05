# 떠날지도

**휴대폰에서 짠 여러 날 여행을 차량 화면의 일회용 QR로 불러와, 고정 일정·숙소·귀가까지 다시 확인하고 현대자동차그룹 내비게이션으로 다음 목적지를 안내하는 Pleos Connect 차량용 앱입니다.**

- 차량 앱: Kotlin · Jetpack Compose · Pleos Connect 2.1.5 디자인 토큰 · NaviHelper 3.0.5
- 모바일 웹: React · Astryx · 기기 안에만 저장 (계정 없음)
- 중계 서버: Cloudflare Worker + Durable Object · 종단간 암호화 (서버는 내용을 볼 수 없음)
- 배포: **https://tteonaljido.tteonaljido-worker.workers.dev** (모바일 웹 + API, 개인정보 안내 `/privacy`)
- 시연 영상: [`media/demo/떠날지도_시연.mp4`](media/demo/떠날지도_시연.mp4) (2분) — release APK(Pleos 에뮬레이터)와 휴대폰 브라우저를 배포 서버로 연결한 실제 화면 녹화
- 세로 숏폼: [`media/demo/떠날지도_숏폼.mp4`](media/demo/떠날지도_숏폼.mp4) (56초, 1080×1920) — 같은 녹화에서 편집, 게시 문구는 `submission/숏폼_게시문구.md`

## APK 위치

| 파일 | 상태 |
|---|---|
| `apk/떠날지도_release.apk` | 서명된 release (prod, 서버 `https://tteonaljido.tteonaljido-worker.workers.dev`). 제출 시 `팀명_떠날지도_release.apk`로 이름 변경. 해시는 `apk/SHA256SUMS.txt` |
| `car/app/build/outputs/apk/dev/debug/app-dev-debug.apk` | 로컬 개발용 (`./gradlew :app:assembleDevDebug`) |

## 실행 방법

### 1) 중계 서버 + 모바일 웹 (로컬)

```sh
npm ci --ignore-scripts
npm run build -w @tteonaljido/web        # 웹 정적 파일 → packages/web/dist
npm run dev -w @tteonaljido/worker       # http://localhost:8787 (API + 웹)
```

카카오 장소 검색을 쓰려면 `packages/worker/.dev.vars`에 `KAKAO_REST_KEY=...`를 넣습니다. 키가 없으면 직접 입력으로 동작합니다.

### 2) 차량 앱 (Pleos Connect Emulator)

```sh
cd car
./gradlew :app:assembleDevDebug          # dev: 서버 http://10.0.2.2:8787
adb install -r app/build/outputs/apk/dev/debug/app-dev-debug.apk
adb shell am start --user 10 -n io.tteonaljido.car/.MainActivity   # 사용자 번호는 `adb shell am get-current-user`
```

### 3) 흐름 확인

1. 차량(기어 P): **모바일 여행 불러오기** → QR 표시
2. 휴대폰 역할: debug 빌드는 QR 링크를 logcat(`Tteonaljido`)에 남깁니다. 데스크톱 브라우저로 `http://localhost:8787/c#v1…`를 엽니다. 배포 서버에서는 실제 폰 카메라로 스캔합니다.
3. [연결하고 확인 코드 보기] → 차량과 같은 6자리 확인 → [샘플 여행 추가] → 보낼 정보 확인 → [차량으로 보내기]
4. 차량: 요약·재검증 결과 확인 → [불러오기] → [여행 보기] → [다음 목적지 안내]

자동 시험:

```sh
npm test                                              # shared 43 · worker 12 · web 17
(cd car && ./gradlew test)                            # Kotlin 44
npx tsx tools/pairing-smoke.mts http://localhost:8787 # 서버 흐름
npx tsx tools/e2e-mobile.mts                          # Chrome 휴대폰 + 가짜 차량
npx tsx tools/e2e-car.mts emulator-5580               # 에뮬레이터 차량 앱(dev debug) + Chrome 휴대폰
npx tsx tools/record-demo.mts emulator-5580           # release APK + 배포 서버 전체 흐름 녹화·메모리 기록
npx tsx tools/compose-demo.mts                        # 녹화 → media/demo/떠날지도_시연.mp4
npx tsx tools/compose-shorts.mts                      # 녹화 → media/demo/떠날지도_숏폼.mp4 (세로)
```

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

## 문서

| 문서 | 내용 |
|---|---|
| [01 사용자 흐름](docs/01_사용자_흐름.md) | 11단계 흐름, 화면·문구, 결정표, 복구, 주행 중 동작, 검수 기준 대응 |
| [02 기술 구조](docs/02_기술_구조.md) | 프로토콜·암호화·스키마·재검증·내비 연동·시험·배포, 지속 동기화 설계(미구현) |
| [03 개인정보 설계](docs/03_개인정보_설계.md) | 데이터 위치·보관 기간, 집 주소 동의, 삭제, 위협 모델 |
| [04 디자인 시스템](docs/04_디자인_시스템.md) | Pleos 토큰·컴포넌트, QR 규격, Astryx 화면, 인식 시험 |
| [05 개발 계획](docs/05_개발_계획.md) | 마일스톤, 실제와 시연의 구분, 위험, 남은 작업 |
| [06 시연 시나리오](docs/06_시연_시나리오.md) | PT 대본, 장애 대응 |

공식 디자인 자료와 추출 방법은 [design/README.md](design/README.md), 공모전·Pleos 조사는 `docs/research/`에 있습니다.
