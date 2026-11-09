# 03 Pleos 개발 환경 점검 (2026-11-10)

공식 문서 [Pleos Connect SDK·Emulator 설치](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator)와 Getting started·SDK·심사 문서 64쪽, 공식 샘플 저장소 3개를 다시 읽고(로그인 불필요), 저장소 설정·서명 APK·에뮬레이터에서 직접 확인한 결과입니다. 기존 조사 `02_PLEOS_개발자가이드.md`와 내용이 같고, 그 뒤 바뀐 점은 Playground 주소 이전(`developers.pleos.ai`, 2026-10-29)뿐입니다.

## 1. 일치하는 항목

| 항목 | 문서 요구 | 이 프로젝트 | 판정 |
|---|---|---|---|
| minSdk | API 28 이상(서명 키 로테이션·리니지) | 28 | 일치 |
| Android SDK·에뮬레이터 | API 34 + Pleos Connect Emulator 2.1.0 | 시스템 이미지 `release_connect_v2.1.0`, API 34, android-automotive, 42dot | 일치 |
| Gradle | 8.0 이상 | 9.4.1 | 충족 |
| 언어 | Java·Kotlin | Kotlin 2.2.10 · Compose | 일치 |
| AVD | Automotive, RAM 4GB, Cold boot(아니면 VHAL 불가) | `anchortrip_pleos`: RAM 4096, `fastboot.forceColdBoot=yes`, GPU host, 2560×1440·160dpi(Connect-S-17 기본) | 일치 |
| Maven | `nexus-playground.pleos.ai/repository/maven-releases/` | 같은 주소 | 일치 |
| SDK 버전 | Vehicle 2.3.2, NaviHelper 3.0.5(2026-10-19 릴리스) | 같음 | 최신 |
| NaviHelper 권한 | `NAVI_ROUTE`(get*Info·requestTrip), `NAVI_ROUTE_SEARCH`(경로·경유지), `NAVI_CUSTOM_MAP`(requestNavigationScreen) | 세 개만 선언, 쓰는 API와 맞음 | 일치 |
| 주행 제한 | DO 선언 앱은 CarUxRestrictions로 직접 제한 | `distractionOptimized` + `CarUxRestrictionsManager`, 모르면 잠금 | 일치 |
| CCP 뒤로 키 | 최상위 화면은 `moveTaskToBack(true)`(finish 금지) | `BackHandler`에서 `moveTaskToBack(true)` | 일치 |
| 보안 | 정식 서명, 디버그 비활성, TLS 1.2+, 불필요 컴포넌트 비노출 | release 서명, debuggable 아님, 평문 통신은 debug 빌드만, 노출 컴포넌트는 런처 1개, 로그는 DEBUG 한정 | 일치 |
| 성능 | 실행 10초, 터치 0.25초, RAM 400MB, CPU 정차 25%·주행 5%(비내비) | 콜드 스타트 2.2–2.6초, 프레임 최대 84ms, PSS 61MB, CPU 0–0.5%(목록·상세, 에뮬레이터) | 충족 |
| 전체 흐름 | — | 2026-11-10 에뮬레이터 차량 E2E 16항목 통과(QR·확인 코드·승인·재전송·재사용 거부·묶음 전송) | 통과 |

툴체인(AGP 9.2.1, compileSdk 37, JDK 17 타깃)은 샘플(AGP 8.8.x, compileSdk 35)보다 새롭습니다. 문서는 제품 앱의 AGP·compileSdk를 정하지 않으므로 문제는 아니지만, 최신 Android Studio가 필요합니다.

## 2. 고칠 점

> 2026-11-10 같은 날 1~5·8번을 반영해 서명 APK를 다시 만들었습니다(버전 0.2.0(2), sha256 `31f347be…`, 에뮬레이터 설치·실행·차량 E2E 16항목 통과, 앱 목록에 적응형 아이콘 표시 확인). 6·7번은 실차/폼팩터 시험과 마켓 등록 때 할 일입니다. 4절의 휴대폰 문구도 새 키로 고쳐 배포했습니다.

| # | 내용 | 근거 | 영향 | 조치 |
|---|---|---|---|---|
| 1 | **주행가능거리 조회에 `CAR_DRIVE` 권한이 빠짐** | Vehicle 2.3.2 바이트코드: `Odometer.getRangeRemainingDistance`는 `@RequiresPermission("pleos.car.permission.CAR_DRIVE")`. 매니페스트는 `CAR_ENERGY`만 선언 | 실차에서 거리 조회가 `ERROR_SECURITY_PERMISSION`으로 실패 → 앱은 '알 수 없음'으로 처리해 EV '숙소까지 못 감 → 다음 정류장 급속' 판단이 나오지 않음(SOC 기준만 동작) | `CAR_DRIVE`(조회) 추가, 또는 AAOS 표준 `RANGE_REMAINING`으로 이전(Pleos '표준 우선' 원칙) |
| 2 | **APK 서명이 v2만** | `apksigner`: v2 true, v3 false. 문서는 minSdk 28 요구를 서명 키 로테이션·리니지(APK Signature Scheme v3) 때문이라고 설명 | 배포 심사에서 키 로테이션 지원 요구에 못 미칠 수 있음 | `signingConfig`에 `enableV3Signing = true` |
| 3 | **CCP(로터리) 미지원 선언 없음** | 「CCP 미지원 앱은 `com.hmg.rotary.ROTARY_SUPPORTED=false` 선언」 | 심사 지적 가능 | `<meta-data android:name="com.hmg.rotary.ROTARY_SUPPORTED" android:value="false"/>` |
| 4 | **앱 아이콘이 적응형(Adaptive Icon)이 아님** | 디자인 가이드: 앱 아이콘은 Android Adaptive Icon 형식 | 런처 표시·심사 | `mipmap-anydpi-v26` 적응형 아이콘(전경·배경) + 512×512 등록용 PNG |
| 5 | **버전 1 / 0.1.0** | 「앱 배포 또는 심사 요청 시에는 반드시 앱 버전을 변경」 | 제출·재제출 시 거부 | APK를 다시 만들 때 versionCode·versionName 올림 |
| 6 | 반쪽 화면(세로 840×1184dp) 미확인 | 화면 2개 정책: Connect-S는 1:1 분할, 세로 창도 지원해야 함 | 분할 화면에서 배치가 깨질 수 있음 | 코드는 1000dp 미만이면 한 줄 배치로 바뀜. form-factor 시험(host-display-bridge)으로 확인 필요 |
| 7 | Vehicle 권한 사전 승인 | 「승인되지 않은 퍼미션을 선언하거나 호출하면 심사 불통과」. My Project에서 Vehicle State는 신청 없이 사용 가능 | 마켓 배포 시 `CAR_ENERGY`(와 1번의 `CAR_DRIVE`) 협의·승인 필요 | My Project 생성, 등록 시 프로젝트 ID 기입 |
| 8 | `build.gradle.kts` 주석 '실차 검증됨' | 실차 검증은 아직 안 함 | 문서·코드 불일치 | 주석 수정 |

카테고리: 내비게이션 앱만 매니페스트에 `APP_MAPS`를 선언합니다. 떠날지도는 지도를 그리는 내비 앱이 아니므로 선언하지 않고, 등록 때 여행 계열 카테고리를 고릅니다(선언과 실제 기능이 다르면 즉시 반려).

## 3. 개발 환경의 한계 (이 Mac)

- **에뮬레이터 이미지·AVD가 다른 폴더에 있음**: `/Volumes/1/현대기아/.work/pleos-image/…`, `/Volumes/1/현대기아/.work/avd/anchortrip_pleos.avd`. SDK Manager 업데이트 사이트(Mac: `https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-arm64-sys-img.xml`)로 설치한 것이 아니라 내려받은 이미지를 직접 지정했습니다. 실행: `ANDROID_AVD_HOME=/Volumes/1/현대기아/.work/avd emulator -avd anchortrip_pleos -port 5580 -no-snapshot-load -no-boot-anim -gpu host`. 다른 PC에서는 공식 절차(업데이트 사이트 → API 34 → Pleos Connect v2.1.0, RAM 4GB, Cold boot)로 만듭니다.
- **주행 상태 전환 명령 없음**: `adb shell cmd hmg_car_service --service drivingstate driving_regulation on`은 에뮬레이터에서 `Can't find service: hmg_car_service`(문서: CCS adb 명령은 Devbox·에뮬레이터 미지원). 실제 주행 제한 경로는 실차·Devbox에서만 확인됩니다.
- **Virtual Console 차량 신호 주입 불가**: `adb forward tcp:8088 tcp:8088` 후 콘솔은 열리지만 `/vehicle/state`가 `bridge_ready:false`·`emulator_active:false`이고 SOC·주행가능거리 쓰기는 `emulator_inactive`. 문서의 GPU 요구는 NVIDIA·AMD 외장 GPU만 적혀 있고 Apple Silicon 기준은 없습니다. 차량 신호(기어·SOC·주행가능거리)는 지원 GPU가 있는 Windows/Linux PC, Devbox, 실차에서 시험해야 합니다.

## 4. 휴대폰 웹 문구 (개인정보 심사 관련)

- `privacy.processors`가 처리 위탁에 Cloudflare·카카오(장소 검색)만 적고 카카오모빌리티(길찾기·도로 경로)·카카오 지도를 빠뜨림.
- `privacy.phone.text`는 집 주소가 IndexedDB에 있다고 하지만 실제는 localStorage(`lib/settings.ts`).
- 전송 동의 문구 `connect.consent.days.detail`의 '입력한 이동시간'은 M43 이후 사실과 다름(카카오가 채움).
