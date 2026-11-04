# Pleos Connect 개발 문서 조사 정리

**열람 기준: 2026년 11월 5일**

Getting Started에서 시작해 사이드바의 개발 환경, 설계 원칙, 디자인, 앱 개발, SDK, Gleo, 테스트, 등록, 샘플, 릴리스 문서를 방문했습니다. 디자인 가이드 **34개**, SDK·Gleo 가이드 **56개**를 포함하며, Vehicle의 **19개 도메인 인터페이스**와 주요 데이터 모델도 추가 확인했습니다.

다만 API Reference의 수백 개 개별 메서드·속성 페이지까지 전부 방문한 것은 아닙니다. 아래에서 **인용문은 원문**, 나머지는 조사 요약입니다. 단위가 없는 수치와 문서 간 불일치는 임의로 보정하지 않았습니다.

---

# 1. 앱 설계 원칙

## 1.1 차량용 앱의 기본 방향

차량용 앱은 모바일 화면을 단순 확대하는 방식이 아니라 다음을 전제로 설계해야 합니다.

- 운전 중 짧게 보고 이해할 수 있는 정보 구조.
- 최소한의 조작과 간단한 메뉴.
- 터치보다 음성·프리셋·최근 항목 우선.
- 주행·정차 상태에 따른 기능 제한.
- 여러 앱이 동시에 실행되는 멀티윈도우 환경.
- 차량별 기능 지원 여부 차이.
- 네트워크 단절과 저대역폭 대응.
- 운전자 교체, 차량 공유, 계정 전환과 개인정보 보호.

원문:

> “Pleos Connect에서 동작하는 앱은 차량 환경과 주행 상황을 고려하여 운전자의 주의를 분산시키지 않도록 설계해야 합니다.”

> “필요한 기능에 최소한의 조작으로 도달할 수 있도록 화면과 메뉴 구조를 단순화합니다.”

> “검색·로그인에서도 키보드 입력보다 프리셋 선택, 최근 항목 및 음성 입력을 우선하도록 설계합니다.”

출처:  
[앱 설계 가이드](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/intro) · [주행 안전을 고려한 설계](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/driver-distraction-guideline)

## 1.2 앱 카테고리

설계 시점부터 카테고리를 정해야 합니다.

- **Maps/Navigation:** 위치 기반 길 안내.
- **Mobility Services:** 이동 수단·이동 서비스.
- **Lifestyle:** 일상생활 관리·향상.
- **Entertainment:** 오락·여가.
- **Business:** 업무·생산성.
- **Music/Audio:** 오디오 콘텐츠.
- **Kids:** 아동 대상 콘텐츠.
- **Social/Communication:** 소통·네트워크.

원문:

> “앱 설계 시점부터 앱의 카테고리를 명확히 정의해야 합니다.”

주행 중 제한적으로 허용될 수 있는 예시:

- Music/Audio: 재생·일시정지·곡 넘기기, 라디오 채널 변경, 오디오북.
- Maps/Navigation: 경로 안내, 간결한 지도, TBT 음성 안내, 교통 정보.
- Mobility Services: 충전소·주유소·주차장 위치, 주행 관련 차량 관리.

이는 **무조건 허용 목록이 아니라**, 주행 상태와 지역 정책을 적용해야 하는 예시입니다.

출처: [앱 카테고리](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/app-category)

## 1.3 화면 구조·멀티윈도우·생명주기

- Driving view와 앱 영역이 함께 표시됩니다.
- 앱 영역에는 최대 **2개 앱**이 배치됩니다.
- Portrait는 일반적으로 앱 window 하나를 사용합니다.
- Landscape는 두 앱 영역을 확장해 사용합니다.
- 화면에서 사라진 앱이 종료된 것은 아닙니다.
- 앱은 foreground/background 전환, window 크기 변경, 프로세스 재생성을 처리해야 합니다.

원문:

> “Driving view는 운전자와 가까운 고정 영역에 표시되며, 앱이 임의로 가리거나 종료할 수 없습니다.”

> “screenOrientation을 별도로 지정하지 않으면 Activity는 기본적으로 portrait로 실행되며 하나의 window를 사용합니다.”

> “screenOrientation을 landscape로 지정하면 두 개의 window 영역을 사용할 수 있습니다.”

> “Window 크기가 변경되어도 핵심 기능을 사용할 수 있도록 화면을 유연하게 구성해야 합니다.”

구현상 요구:

- Foreground 복귀 시 상태 복원, 현재 크기·방향에 맞게 UI 재구성.
- Background 이동 시 화면 갱신·애니메이션·불필요한 센서 수집 중단.
- 통신·다운로드·오디오의 지속 조건과 중단·재개 정책 정의.
- 불필요한 상주, 타이머, 폴링, 네트워크 요청 최소화.
- 프로세스 재생성에 대비해 사용자 데이터와 진행 상태 저장.

출처: [앱 구조 및 동작 모델](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/app-structure-screen-model)

## 1.4 하드웨어 접근·네트워크

원문:

> “직접 접근 금지: 차량의 물리적 제어나 센서에 직접 접근해서는 안 됩니다.”

> “플랫폼 API 우선 원칙: 차량 상태 정보는 Pleos Connect SDK가 제공하는 표준 플랫폼 API를 통해 확인하고 제어해야 합니다.”

모바일 API는 그대로 지원된다고 가정하면 안 됩니다. 제한될 수 있는 예:

- Telephony, SMS.
- 자이로·근접 센서 등 일부 센서.
- 캘린더·주소록.

지원 여부를 확인하고 Optional 구조 또는 대체 흐름을 마련해야 합니다.

네트워크 대응 권장:

- 최근 콘텐츠 로컬 캐싱.
- Retry와 적절한 타임아웃.
- 오프라인 상태 안내 UI.
- 저대역폭에서도 핵심 기능 유지.

출처: [하드웨어 접근 정책](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/platform-api-architecture)

## 1.5 AAOS 우선·호환성 정책

원문:

> “표준 우선 정책: 동일하거나 유사한 기능의 API가 AAOS 표준에 이미 존재하는 경우, 해당 표준 API 사용을 권장하며 Pleos Connect SDK에서는 중복 기능을 제공하지 않습니다.”

> “호환성 보장: Pleos Connect SDK의 특정 API가 AAOS 표준으로 수용되더라도, 기존 SDK API는 최소 2개의 메이저 버전(Major Version)까지 하위 호환성을 유지합니다.”

구분:

- AAOS Car API: 속도, 기어, 외기 온도, 연료 레벨 등 표준 데이터.
- Pleos SDK: 제조사 특화 제어, 시트·라이팅·보안 기능 등.

지원 확인:

- Vehicle: 도메인별 `checkXXXCapabilities()`.
- FusedLocation: `isSupported()`.
- NaviHelper: 내비게이션이 탑재된 차량에 한해 호환.
- TTS/STT: 호환성 문서상 전체 호환으로 안내.

원문:

> “차량 모델에 따라 프로퍼티 지원 여부가 다를 수 있으므로, 모델명을 기준으로 분기 처리하지 말고 VehiclePropertyIds와 CarPropertyManager를 사용하여 실제 지원 여부와 접근 가능 상태를 확인하시기 바랍니다.”

> “Pleos Connect SDK API가 제공하지 않는 특수 프로퍼티가 필요한 경우, 직접 구현 전 반드시 기술 지원팀에 검토를 요청하시기 바랍니다.”

출처:  
[SDK API 정책](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/pleos-connect-sdk-api) · [API 호환성 및 가용성](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/api-compatibility-availability)

## 1.6 성능·리소스 기준

원문 수치:

> “내비게이션 앱(주행 중): 15% 이하”  
> “내비게이션 앱이 아닌 앱(주행 중): 5% 미만”  
> “모든 앱(정차 중): 25% 이하”

> “RAM 사용량은 400 MB 이하로 유지합니다.”

추가 요구:

- Cold start에서는 필요한 최소 초기화만 수행.
- 초기 필수 리소스 외에는 lazy loading.
- 긴 background 작업과 불필요한 타이머·폴링 최소화.
- 이미지·리스트의 재활용과 캐싱.
- 오디오 포커스 변화 대응 필수.

출처: [성능 및 리소스 효율을 고려한 설계](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/performance-resource-mgmt)

## 1.7 공유 차량·개인정보 설계

원문:

> “차량 소유자 변경, 운전자 교체 시 쉽게 로그아웃 및 계정 전환이 가능해야 합니다.”

> “소셜 로그인, OTT 계정 등 토큰은 Keystore 등 안전한 스토리지에 저장해야 합니다.”

> “불필요한 개인정보(PII)는 저장하지 않고, 로그에 개인정보가 포함될 경우 마스킹하여 기록합니다.”

Telemetry에는 차량 ID·사용자 ID의 익명화/가명화 정책이 필요하며, 운전 행동 데이터를 마케팅 목적으로 사용하지 않도록 구분해야 합니다.

출처: [보안 및 개인정보 보호를 고려한 설계](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/security-privacy)

---

# 2. UI/UX·레이아웃·타이포그래피·컴포넌트

## 2.1 기본 디자인 원칙과 정확한 수치

### 사용성과 안전

원문:

> “운전 중 동영상, 애니메이션 이미지, 텍스트 자동 스크롤과 같이 운전자의 시선을 유도하면 안 됩니다.”

> “앱 조작은 한 손만으로도 가능해야 하며, 양손을 모두 사용하게 해서는 안 됩니다. 단순한 조작만을 요구해야 합니다. 운전자의 손이나 발을 움직이는 동작을 유도해서는 안 됩니다.”

### 즉시성

> “운전자는 짧은 시간(1~2초) 내에 정보를 파악해야 하므로, 핵심 정보만 노출하고 불필요한 요소는 배제합니다.”

> “사용자 입력 후 시스템 응답 시간이 0.25초를 초과하지 않아야 합니다. 응답이 지연되거나 시간이 필요한 경우에는 시각적으로 응답 중인 상태를 알리세요.”

### 대비

> “아이콘, 텍스트 및 기타 이미지의 대비율이 4.5:1 이상이어야 합니다.”

### 텍스트 길이

> “영어로 된 단일 메시지 또는 텍스트는 120자(영문 기준) 또는 24 단어(영문 기준) 이하여야 합니다.”

> “일본어 단일 메시지 또는 일본어 텍스트는 30자(영문 기준) 이하여야 합니다.”

> “한 줄의 텍스트는 80자(영문 기준) 이하여야 합니다.”

> “문장 또는 단락은 텍스트 3줄을 넘지 않아야 합니다.”

일본어 항목의 **“30자(영문 기준)”은 원문 표기 그대로**입니다.

### 텍스트 물리적 높이

> “중요 정보(예: 속도, 내비게이션 안내, 경고 메시지 등)를 표시하는 기본 텍스트는 높이 5 mm 이상, 보조 텍스트는 최소 3 mm 이상으로 설정하여 주행 중 빠르게 인식할 수 있도록 합니다.”

### 아이콘·알림·음성

> “국제적으로 통용되는 직관적인 아이콘을 사용하며, 텍스트 라벨과 함께 제공하여 이해도를 높입니다.”

> “앱은 운전자의 필요와 관련된 경우에만 알림을 표시해야 합니다.”

> “알림을 통해 광고를 표시하거나, 광고주 이름 또는 제품 이름 외의 텍스트 기반 광고를 표시해서는 안 됩니다.”

> “음성 기반 통신 시스템은 핸즈프리로 말하고 들을 수 있어야 합니다.”

야간/주간 환경에 따라 밝기와 대비를 자동 조정하고, 다국어와 다양한 해상도·화면비를 지원하도록 안내합니다.

출처: [Pleos Connect UI Design Guide](https://document.pleos.ai/docs/connect/guide/docs-design/Introduction/intro)

## 2.2 최소 터치 영역: 확인된 것과 미명시 사항

- 큰 터치 영역, 충분한 버튼 간격, 한 손 조작을 요구합니다.
- 그러나 조사한 공개 가이드 본문과 버튼 크기 도해에서 **모든 앱에 공통 적용되는 최소 터치 영역의 가로×세로 dp 수치와 최소 버튼 간격 수치는 확인되지 않았습니다.**
- `48 x 48dp`는 아래 Iconography의 **아이콘 기본 그리드**입니다. 이를 최소 터치 영역으로 바꾸면 부정확합니다.
- Bar의 Control은 “Handle과 최소 drag 영역”으로 설명되지만 구체 수치는 없습니다.
- Basic/Icon/Text button의 Large·Medium·Small도 공개 본문에 dp 수치가 없습니다.

따라서 **“Pleos 최소 터치 영역은 48dp”라고 단정할 근거는 이번 문서에 없습니다.**

출처:  
[주행 안전 설계](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/driver-distraction-guideline) · [Basic button](https://document.pleos.ai/docs/connect/guide/docs-design/components/actions/basic-button) · [Icon button](https://document.pleos.ai/docs/connect/guide/docs-design/components/actions/icon-button) · [Bar](https://document.pleos.ai/docs/connect/guide/docs-design/components/bar) · [Iconography](https://document.pleos.ai/docs/connect/guide/docs-design/foundations/contents-creation/iconography)

## 2.3 Display Layout와 해상도

화면 구성:

- **Status bar:** Driving status, Gleo AI·검색, 시계, 네트워크·마이크 상태, 알림, 프로필.
- **Driving view:** 경고등, 속도, 차량 상태 등.
- **GNB:** App library, 즐겨찾는 앱, 공조.
- **Application window:** 앱 1개 또는 2개.

원문:

> “가로 전용 게임 등 한 가지 모드로만 실행 가능한 애플리케이션을 제외한 모든 앱은 Landscape, Portrait 두 가지 레이아웃에 적절하게 조절되도록 설계해야 합니다.”

> “상단의 상태 표시줄, GNB의 App library, 공조 등 패널과 키보드 등 System UI는 앱보다 상위 레이어에 위치하므로, 사용자가 해당 기능을 사용할 경우 일시적으로 애플리케이션 윈도우를 가릴 수 있습니다.”

### 도해에 명시된 수치

원본 표의 머리글은 **`Resolution (dp)`**, **`Landscape (dp)`**, **`Portrait (dp)`**입니다. 다음 Resolution을 px로 변경하지 않았습니다.

- **Connect-S-17 (Default)**
  - Screen Ratio `16:9`, `17 in`, `160 DPI`.
  - Resolution `2560 x 1440 dp`.
  - Landscape `1700 x 1184 dp`.
  - Portrait `840 x 1184 dp`.
- **Connect-S-14.6**
  - `16:9`, `14.6 in`, `200 DPI`.
  - Resolution `2048 x 1152 dp`.
  - Landscape `1360 x 948 dp`.
  - Portrait `672 x 948 dp`.
- **Connect-L-12.9**
  - `16:9`, `12.9 in`, `160 DPI`.
  - Resolution `1920 x 1080 dp`.
  - Landscape `1274 x 855 dp`.
  - Portrait `628 x 855 dp`.
- **Connect-W-Standard**
  - `9:2`, `24.6 in`, `160 DPI`.
  - Resolution `3840 x 850 dp`.
  - Landscape `1640 x 810 dp`.
  - Portrait `800 x 810 dp`.
- **Connect-W-Extended**
  - `24:9`, `24.6 in`, `160 DPI`.
  - Resolution `3840 x 1440 dp`.
  - Landscape `1640 x 1400 dp`.
  - Portrait `800 x 1400 dp`.
- **Connect-WF**
  - `32:9`, `18.5 in`, `200 DPI`.
  - Resolution `3072 x 816 dp`.
  - Landscape `1256 x 800 dp`.
  - Portrait `648 x 800 dp`.

본문은 기존 Connect-L이 Connect-S로 재분류됐다고 설명하지만, 이미지의 모델명은 여전히 `Connect-L-12.9`입니다.

출처: [Display Layout](https://document.pleos.ai/docs/connect/guide/docs-design/getting-started/layout) · [원본 해상도 도해](https://document.pleos.ai/assets/images/pleos_connect_deisgnguide_displaylayout_02-86ea4e4c69813e5c635d8b501d057271.svg)

## 2.4 Window Policy

### Connect-S

- 앱 2개: **1:1**.
- 앱 1개: **2:0**.
- 기본값: **1:1**.
- 최초 실행·재탑승 시 Primary Navigation.
- 새 앱은 기존 앱의 orientation을 따릅니다.
- 두 Portrait 앱이 표시 중이면 새 앱은 Primary window에 표시됩니다.
- 화면에서 사라진 앱은 background에 남을 수 있습니다.
- 앱 종료 시 최근 활성화 앱 순으로 복귀합니다.
- 3핑거 스와이프·window bar로 위치/크기/방향 전환.
- 기본 Navigation 앱은 종료할 수 없습니다.

### Connect-W

- **2:1 또는 1:2**, 기본 **2:1**.
- 최초 Primary Navigation, Secondary Media.
- 재탑승 시 Secondary는 마지막 사용한 Media.
- 신규 앱은 항상 Landscape로 Primary에 표시.
- 기존 Primary는 Secondary로 이동.
- 조수석 App library에서 실행한 앱은 조수석 window에서만 실행.

원문:

> “최대 실행 가능한 앱의 개수는 2개로 제한합니다.”

> “Pleos Connect에서 제공하는 프리로딩 앱은 landscape view, portrait view 모두를 지원합니다.”

> “Deep link(App to App): App A에서 App B를 실행할 경우 App A를 덮고 실행되며, App B의 기능 수행이 종료될 때 화면은 App A로 전환됩니다.”

후방카메라 등의 **3:0 fullscreen 예외는 적용 예정**으로 적혀 있으므로 일반 앱의 현재 fullscreen 권한으로 해석하면 안 됩니다.

출처: [Window Policy](https://document.pleos.ai/docs/connect/guide/docs-design/getting-started/window)

## 2.5 Status bar·GNB·App library

### Status bar

- SP0 Static: Door Lock·Search 등 높은 우선순위 고정 요소.
- SP0 Dynamic: 알림·통화·privacy indicator.
- SP1 Dynamic: Download·Update·WPC·Hi-Pass·Sound 등.
- SP1 Static: Profile·Bluetooth·Network.
- 시계: **24h / 12h**.
- 공간이 부족한 Dynamic indicator는 More 메뉴로 이동.

원문:

> “SP0과 SP1 영역의 시각적 구분을 위해, 40dp의 safe bounds를 right padding으로 포함합니다.”

출처: [Status bar](https://document.pleos.ai/docs/connect/guide/docs-design/components/status-bar)

### GNB

- 운전석 공조, Application control, 조수석 공조.
- Vehicle settings 편집 불가.
- Navigation fixed app은 위치 이동 가능하지만 삭제 불가.
- 중앙 Editable slots: 앱·Climate shortcut **최대 3개**.
- 기본 앱: Bluetooth Music·Phone·App Market.
- Recent apps: **2개**, 최근 앱이 왼쪽.
- GNB에 배치된 앱은 Recent에 중복 표시하지 않음.
- Recent apps 영역 편집 불가.
- Climate shortcut은 이동만 가능, 삭제 불가.

OSD 원문:

> “OSD 패널이 나타나고 나서 추가적인 조작이 없을 경우 2초 후에 자동으로 사라집니다,”

출처: [GNB](https://document.pleos.ai/docs/connect/guide/docs-design/components/gnb)

### App library

- Connect-S: **1줄 최대 7개**.
- **2줄 이상 넘어가면** 좌우 이동 인디케이터.
- 상단 차량 제어, 하단 앱 실행.
- 차량 제어와 앱은 지정 영역으로만 이동.
- 이동 불가 영역은 Drag 시 비활성화.
- 국가 법규에 따라 Frost·Defrost를 GNB에 필수 제공할 수 있음.

출처: [App library](https://document.pleos.ai/docs/connect/guide/docs-design/components/app-library)

## 2.6 Typography

원문:

> “폰트는 중립적인 형태와 균일한 수준의 시인성을 확보할 수 있는 서체를 사용해야 합니다.”

> “Android 접근성 가이드라인에 따르면, 최소 폰트 크기는 12sp 이상을 권장합니다. (12sp ≈ 12dp → 12 × (160dpi / 160) = 12px)”

> “가독성을 위해 일반적으로 1.5배 이상 사용하는 것이 권장되며, 약 18~20px 정도의 높이를 확보하는 것이 안전합니다.”

> “실제 픽셀 기준 최소 높이: 18px 이상”

- 시스템 폰트: **Asta Sans Font**.
- Language Support: **Korean, English**.
- 브랜드 폰트를 지정할 수 있으나 캐릭터성이 강조된 폰트는 지양.
- 정보 위계별 일관된 크기 사용.

### 계층 표

아래는 **Size / Line height** 순서입니다. 원본 표에 단위가 없어 sp·dp를 덧붙이지 않았습니다.

- Headline Large: **60 / 80**, Extra Bold·Bold.
- Headline Medium: **56 / 72**, Extra Bold·Bold.
- Headline Small: **48 / 64**, Extra Bold·Bold.
- Title Large: **40 / 52**, Extra Bold·Bold·Regular.
- Title Medium: **36 / 44**, Extra Bold·Bold·Regular.
- Title Small: **32 / 40**, Extra Bold·Bold·Regular.
- Body Large: **30 / 38**, Strong·Normal.
- Body Medium: **28 / 36**, Strong·Normal.
- Body Small: **26 / 34**, Strong·Normal.
- Label Medium: **24 / 28**, Normal.
- Label Small: **20 / 24**, Normal.

**주의:** `12sp`, 실제 높이 `18px`, 중요 정보 `5mm`·보조 `3mm`는 서로 다른 기준이므로 하나로 합치면 안 됩니다.

출처: [Typography](https://document.pleos.ai/docs/connect/guide/docs-design/foundations/typography) · [Headline](https://document.pleos.ai/assets/images/headline-cdddc157495a452d70cb6fc2cc2d7359.svg) · [Title](https://document.pleos.ai/assets/images/title-4ba825297b802194558f4ac3a33de511.svg) · [Body](https://document.pleos.ai/assets/images/body-a60c3c3a40cf6fcc0b4b2c4e39eeccf1.svg) · [Label](https://document.pleos.ai/assets/images/label-573dca295b60eefe86fabf8f0f0ba734.svg)

## 2.7 Iconography·앱 아이콘

Iconography 원문:

> “아이콘은 누구나 직관적으로 인지할 수 있어야 합니다.”

> “Grid system : 기본 사이즈(48 x 48dp)를 기준으로 작성된 그리드 시스템으로 제작합니다.”

> “Style : 시인성 확보를 위해 상황에 따라 Filled/Outlined 2가지 타입으로 사용할 수 있습니다.”

> “Variant : 1벌을 제작 후 필요한 사이즈로 조정하여 디자인을 합니다.”

앱 아이콘:

- Foreground와 Background를 분리 제작.
- 브랜드별 디자인 정책 적용.
- **Android Adaptive Icon** 형식.
- 시스템 마스킹으로 브랜드별 형태 적용.
- Design Assets의 Figma 템플릿 참조.
- 디자인 본문에는 별도의 앱 아이콘 px 규격이 없지만, 마켓 제출 규격은 뒤의 **512 x 512 px**입니다.

출처: [Iconography](https://document.pleos.ai/docs/connect/guide/docs-design/foundations/contents-creation/iconography) · [App Icon](https://document.pleos.ai/docs/connect/guide/docs-design/foundations/contents-creation/app-icon)

## 2.8 Animation·Shadow

Animation은 상태 설명용입니다.

- Linear: 정적인 로딩.
- Tension: 로딩 시간이 다소 긴 페이지 로딩.
- **애니메이션 지속 시간 수치는 미명시**.
- 주행 중 시선 유도 애니메이션 금지 규칙과 함께 적용해야 합니다.

Shadow 수치의 **X·Y·Blur·Spread 단위는 미기재**입니다.

- Level 1:
  - `X 0, Y 6, Blur 24, Spread 0, Color #14000000 (8%)`.
- Level 2:
  - `X 0, Y 8, Blur 32, Spread 0, Color #29000000 (16%)`.
  - `X 0, Y 2, Blur 2, Spread 0, Color #14000000 (8%)`.
- Level 3:
  - `X 0, Y 20, Blur 40, Spread 0, Color #3D000000 (24%)`.
  - `X 0, Y 2, Blur 4, Spread 0, Color #33000000 (20%)`.

출처: [Animation](https://document.pleos.ai/docs/connect/guide/docs-design/foundations/animation) · [Shadow](https://document.pleos.ai/docs/connect/guide/docs-design/foundations/shadow)

## 2.9 컴포넌트 전체

각 컴포넌트의 공개 가이드가 설명하는 핵심 상태·속성입니다.

### Actions

- **Basic button**
  - Root, Label, Prefix/Suffix icon.
  - Pressed·Disabled·Loading.
  - Loading이면 Loader 표시 및 제어 불가.
  - Large·Medium·Small.
  - 출처: [Basic button](https://document.pleos.ai/docs/connect/guide/docs-design/components/actions/basic-button)
- **Toggle button**
  - Toggled·Pressed·Disabled, Floating.
  - Large·Medium·Small.
  - Pressed 설명에 “Drag 가능한 window일 때 True로 전환”이라는 원문 표기가 있습니다.
  - 출처: [Toggle button](https://document.pleos.ai/docs/connect/guide/docs-design/components/actions/toggle-button)
- **Text button**
  - 부가 링크·Prefix/Suffix icon.
  - Pressed·Disabled·Loading.
  - Loading 시 제어 불가.
  - Medium·Small.
  - 출처: [Text button](https://document.pleos.ai/docs/connect/guide/docs-design/components/actions/text-button)
- **Icon button**
  - 직관적으로 의미를 인지할 수 있을 때 사용.
  - Basic·Plain·Circle.
  - Large·Medium·Small.
  - Pressed·Disabled.
  - 출처: [Icon button](https://document.pleos.ai/docs/connect/guide/docs-design/components/actions/icon-button)
- **Keypad**
  - Primary·Secondary·Special.
  - Keyboard는 Text·Voice.
  - Pressed·Disabled.
  - 출처: [Keypad](https://document.pleos.ai/docs/connect/guide/docs-design/components/actions/keypad)

### Bar·Controller·Indicator·Dropdown

- **Bar**
  - Window bar와 Scroll bar.
  - Light/Dark, Dragging, Disabled, Pressed.
  - Disabled이면 handle 숨김 및 drag 불가.
  - 출처: [Bar](https://document.pleos.ai/docs/connect/guide/docs-design/components/bar)
- **Controllers**
  - Continuous Slider, Centered Slider, Stepper.
  - MinValue·MaxValue·Step.
  - Basic/Floating.
  - Volume: `Max 100%`, `High 76~100%`, `Mid 26~75%`, `Low 1~25%`, `Min 0%`.
  - 출처: [Controllers](https://document.pleos.ai/docs/connect/guide/docs-design/components/controllers)
- **Indicator**
  - Present Value, Next/Prev Value.
  - Wide/Narrow.
  - 출처: [Indicator](https://document.pleos.ai/docs/connect/guide/docs-design/components/indicator)
- **Dropdown**
  - Opened·Pressed·Disabled.
  - Prefix는 App Icon/Icon, Suffix는 Switch/Icon.
  - Medium·Small.
  - 출처: [Dropdown](https://document.pleos.ai/docs/connect/guide/docs-design/components/dropdown)

### 입력 필드

- **Text Field**
  - Text·Tel·Url·Email·Password.
  - Value·Focused·Disabled·Read Only·Invalid.
  - Disabled: 입력·접근 불가, Focused 작동 안 함.
  - Read Only: 값 접근 가능, 변경 불가, Focused 작동.
  - 크기 원문: `Medium, Samll`.
  - 출처: [Text Field](https://document.pleos.ai/docs/connect/guide/docs-design/components/fields/text-field)
- **Number Field**
  - 숫자 입력.
  - Disabled/Read Only 동작은 Text Field와 동일.
  - Large·Medium.
  - 출처: [Number Field](https://document.pleos.ai/docs/connect/guide/docs-design/components/fields/number-field)

### 탐색·팝업

- **Page Navigation**
  - Main/Depth.
  - Primary Menu, Secondary Menu, Subtitle, Suffix.
  - Depth에서 Back 버튼.
  - 출처: [Page Navigation](https://document.pleos.ai/docs/connect/guide/docs-design/components/page-navigation)
- **System Popup**
  - Title, Description, Body, Confirm, Cancel.
  - Large·Medium.
  - Button Align: Single·Vertical·Horizontal.
  - 출처: [System Popup](https://document.pleos.ai/docs/connect/guide/docs-design/components/popups/system-popup)
- **Toast Popup**
  - 원문: “앱에서 필요한 시스템 메시지를 24dp 공간을 두고 Max로 제공할 수 있습니다.”
  - 출처: [Toast Popup](https://document.pleos.ai/docs/connect/guide/docs-design/components/popups/toast-popup)
- **Tabs**
  - **2개 이상** 콘텐츠·기능 옵션.
  - Box·Line.
  - Fitted=True: 전체 너비에 균등 확장.
  - False: Left Aligned.
  - 출처: [Tabs](https://document.pleos.ai/docs/connect/guide/docs-design/components/segmented-menu)

### 선택·기타

- **Checkbox:** 다중 선택, Checked·Pressed·Disabled.  
  출처: [Checkbox](https://document.pleos.ai/docs/connect/guide/docs-design/components/selections/checkbox)
- **Radio button:** Value `Num / Null`, Pressed·Disabled·Invalid.  
  출처: [Radio](https://document.pleos.ai/docs/connect/guide/docs-design/components/selections/radio)
- **Switch:** Checked On/Off, Pressed·Disabled·Invalid.  
  출처: [Switch](https://document.pleos.ai/docs/connect/guide/docs-design/components/selections/switches)
- **Spinner:** Drag로 Date·Time 옵션 선택.  
  출처: [Spinner](https://document.pleos.ai/docs/connect/guide/docs-design/components/spinner)
- **System Notification:** Imagery·Header·Action, Single·Vertical·Horizontal 버튼 정렬. 본문에 표시 시간 수치 없음.  
  출처: [System Notification](https://document.pleos.ai/docs/connect/guide/docs-design/components/notification/system-notification)
- **Toast**
  - 원문: `App panel 내 side padding 24, bottom padding 24`
  - 원문: `Toast 전체 max width 792`
  - 원문: `Message text max width 712`
  - 이 페이지는 위 숫자에 **단위를 기재하지 않았습니다**.
  - 출처: [Toast](https://document.pleos.ai/docs/connect/guide/docs-design/components/toast)
- **Widgets:** 아래로 당기는 Handle, Pagination, Title/Action, Information 영역. 본문에 크기·시간 수치 없음.  
  출처: [Widgets](https://document.pleos.ai/docs/connect/guide/docs-design/components/widgets)

---

# 3. 운전 중 주의분산·지역별 제한·카테고리별 규칙

## 3.1 DO 선언과 실제 기능 제한은 별개

원문:

> “앱은 CarUxRestrictions를 기준으로 주행 중 제한 상태를 확인하고, 제한 대상 기능의 UI와 동작을 적절히 축소하거나 비활성화해야 합니다.”

> “주행 규제 상태에서 영상 재생을 시작하거나 재개하지 않도록 처리하고, 오디오 재생은 오디오 포커스 개발 가이드에 정의된 정책을 준수합니다.”

- DO를 선언하지 않은 앱: Parking 사용 가능, Drive 사용 불가.
- DO 선언 앱도 `CarUxRestrictions`와 `ActiveRestrictions`를 받아 기능별 제한을 적용해야 합니다.
- 특정 속도 임계값을 앱이 임의로 정해 대체하면 안 됩니다.
- 주행 정책은 차량 신호·지역·플랫폼/차량 버전에 따라 달라집니다.

AAOS가 설명하는 Activity 선언 예:

```xml
<activity android:name=".DistractionOptimizedMainActivity"....>
....
<meta-data android:name="distractionOptimized" android:value="true"/>
</activity>
```

플랫폼은 선언을 확인할 뿐, 실질적인 준수 여부 전체를 자동 판별하는 것은 아닙니다.

출처: [주행 안전 설계](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/driver-distraction-guideline) · [지역별 주행 규제](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/driving-restiction-policy) · [AAOS 원문](https://source.android.com/docs/automotive/driver_distraction/guidelines?hl=ko)

## 3.2 지역별 기능 허용 범위

Parking에서는 문서의 9개 기능이 모두 사용 가능합니다. Driving 상태는 다음과 같습니다.

### 북미

- 키보드: 제한.
- 다이얼패드: 제한.
- 통합 검색: **음성한정**.
- 미디어 앱 로그인·설정·검색: 제한.
- 디지털키·도어·시트·차량 설정: 제한.
- 동영상: 제한.
- 내비게이션 검색: 제한.
- QR 로그인: 제한.
- 매뉴얼 등 대용량 텍스트: 제한.

### 유럽

- 키보드·다이얼패드·통합 검색·내비게이션 검색: 가능.
- 미디어 앱 로그인·설정·검색: 제한.
- 디지털키·도어·시트·차량 설정: 제한.
- 동영상·QR 로그인·대용량 텍스트: 제한.

### 그외 지역

- 키보드·다이얼패드·통합 검색: 가능.
- 미디어 앱 로그인·설정·검색: 가능.
- 내비게이션 검색: 가능.
- 디지털키·도어·시트·차량 설정: 제한.
- 동영상·QR 로그인·대용량 텍스트: 제한.

여기서 검색은 **웹 검색이 아니라 IVI 통합 검색**입니다. “가능”은 해당 표의 기능 제한 여부이며, 다른 카테고리·안전 규칙을 면제하지 않습니다.

### 문서에 연결된 제한 상수

- 다이얼패드: `UX_RESTRICTIONS_NO_DIALPAD(1)`
- 검색 필터링: `UX_RESTRICTIONS_NO_FILTERING(2)`
- 문자열 길이: `UX_RESTRICTIONS_LIMIT_STRING_LENGTH(4)`
- 키보드: `UX_RESTRICTIONS_NO_KEYBOARD(8)`
- 동영상: `UX_RESTRICTIONS_NO_VIDEO(16)`
- 콘텐츠 양: `UX_RESTRICTIONS_LIMIT_CONTENT(32)`
- 설정: `UX_RESTRICTIONS_NO_SETUP(64)`

문서는 Parking·Idling·Driving을 언급하지만, 게시된 지역 표의 행은 Parking·Driving입니다. Idling의 별도 수치 임계값은 제시하지 않습니다.

출처: [지역별 주행 규제 정책](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/driving-restiction-policy)

## 3.3 주행 규제 구현 예

`CarUxRestrictionsManager`에서 listener를 등록하고 `onUxRestrictionsChanged()`를 처리합니다.

원문 예:

```java
if (mCurrentCarUxRestrictions.isRequiresDistractionOptimization()
        && (mCurrentCarUxRestrictions.getActiveRestrictions()
            & CarUxRestrictions.UX_RESTRICTIONS_NO_VIDEO) != 0) {
    stopPlayingVideo();
}
```

UX 규제 Figma 사양서는 Playground에 공개되지 않았다고 안내합니다.

출처: [주행 규제 개발 가이드](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide)

## 3.4 동영상·게임·브라우저

이 심사 문서에서 말하는 “미디어 앱”은 **동영상·게임·브라우저 기능 앱**입니다. Music/Audio 전체를 지칭하는 것으로 확대하면 안 됩니다.

원문:

> “모든 미디어 앱은 정차 중에만 사용 가능합니다.”

> “운전이 시작되면 앱의 UI를 숨깁니다.”

> “운전 중에는 동영상, 게임, 브라우저 앱의 ‘일시 중지’를 해제할 수 없습니다.”

> “미디어 앱은 헤드업 알림을 게시해서는 안 됩니다.”

추가 요구:

- 제목·썸네일은 한눈에 인지 가능해야 함.
- 부적절한 제목·썸네일·미리보기 금지.
- 동영상은 MediaSession 통합.
- 여러 미디어 동시 사용 불가.
- 콘텐츠에 따라 재생·일시정지·중지 명령 지원.
- 브라우저의 비밀번호·결제 정보 접근 저장/허용 금지.
  - 프로필 잠금으로 비밀번호 접근을 차단할 수 있는 경우 예외 가능.
- 비밀번호·결제 데이터 동기화 전 인증 메시지와 차량 동기화 고지.

출처: [운전자 주의 분산 요소 최소화 설계](https://document.pleos.ai/docs/pleos-only/distribute/app-review-guide/review-driver-distraction-elements)

## 3.5 Maps/Navigation 전용 규칙

카테고리 선언 예:

```xml
<intent-filter>
    <action android:name="android.intent.action.MAIN" />
    <category android:name="android.intent.category.APP_MAPS" />
</intent-filter>
```

- 매니페스트와 마켓 카테고리 일치 필수.
- 카테고리 불일치 즉시 반려.
- 심사 중 기능 변경 시 재심사.
- **단일 경로·단일 내비게이션** 정책.
- Active Route만 음성/TBT 안내.
- Inactive Route 안내 금지.
- Background에서는 모든 안내 금지.
- OEM Navigation의 안전 운행 정보는 예외 가능.
- Phone Projection과도 배타 관계.
- `CarAppFocusManager.requestAppFocus`와 focus listener 활용.

전환은 사용자 명시 선택 또는 기존 내비 오류·종료 시 허용되며, 인지 가능한 안내가 필요합니다. 동의 없는 자동 전환은 금지입니다.

주행 중 금지 항목의 원문 표현:

- `복잡한 메뉴 탐색 (3 depth 초과)`
- 긴 리스트 스크롤.
- 영상·애니메이션·광고 노출.
- 전체 화면 팝업.

허용 예: 음성, 단일 터치 주요 기능, 즐겨찾기 목적지.

그 밖에:

- 핵심 주행 정보 상시 노출.
- 공식 API만 사용, 비공식 센서/API 금지.
- 위치 권한 필수, 마이크는 음성 입력 시에만.
- 불필요한 위치 저장 금지.
- 위치 암호화·HTTPS·개인정보처리방침.
- 장시간 주행 안정성 확보.

즉시 반려 예: 주행 중 광고, 영상·게임 요소, 복수 내비 동시 안내, 카테고리 위반, OEM/AAOS 정책 위반.

출처: [Maps/Navigation 앱 개발 가이드](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/navigation-app-development-guide)

## 3.6 Music/Audio 전용 규칙

음악·팟캐스트·오디오북·라디오가 대상입니다. 영상이 주기능이면 이 카테고리가 아닙니다.

선언 예:

```xml
<application
    ...
    android:appCategory="audio" />
```

```xml
<application
    ...>
    <meta-data
        android:name="androidx.car.app.launchable"
        android:value="true" />
</application>
```

필수 연동:

- **MediaBrowserService(MBS) 사용**.
- MediaSession으로 상태·제어 제공.
- 기본 재생 제어와 핸들 키 지원.
- `MediaSessionCompat`와 Callback.
- 최소 재생·일시정지·정지·Media ID 재생·검색 재생.
- 콘텐츠가 지원하면 이전·다음.
- 앱 연결·프로필 변경만으로 자동재생 금지.
- LOSS 후 MediaSession을 active로 유지하지 말고 중단/비활성화.

미디어센터 사용 시 핸들 키·Tune Knob·Media 버튼을 지원합니다. Mode 버튼은 미디어센터 사용 여부와 관계없이 미지원으로 안내합니다.

서비스 종료 처리 순서:

```text
stopMedia() → stopSelf() → super.onTaskRemoved()
```

3핑거 종료에서 `Callback.onStop()`이 호출될 수 있으므로 `ExoPlayer.stop()` 처리가 필요합니다.

Gleo 관련:

- 곡 검색 외 핵심 음성 기능 약 **3~5개** 추가를 선택 제공.
- 곡 검색은 `MediaLibraryService` 검색 필수.
- MediaSession만으로는 검색이 제한될 수 있음.
- 별도 Schema 없는 표준 Media3 음성 연동은 **향후 업데이트 준비 중**으로 안내돼 있습니다.

출처: [Music/Audio 앱 개발 가이드](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/music-audio-app-developement-guide)

## 3.7 CCP·로터리 컨트롤러

- **User-installed:** CCP 선택, 미지원만으로 배포 제한 없음.
  - 다만 필수 조작을 터치만으로 완결할 수 있어야 합니다.
- **Pre-installed:** 원칙적으로 CCP 필수.
  - 초기 릴리스부터 회전·클릭·방향 이동 지원.
  - 업데이트에서 누락·비활성화 금지.
  - 예외는 계약서에 명시해야 함.

미지원 선언:

```xml
<application
    ...>
    <meta-data
        android:name="com.hmg.rotary.ROTARY_SUPPORTED"
        android:value="false" />
</application>
```

Back 동작:

- 하위 화면: 이전 화면.
- 팝업: 닫기.
- **최상위: 종료가 아니라 Hide**.

```kotlin
moveTaskToBack(true)
```

최상위 CCP Back에 `finish()`·`finishAffinity()`를 사용하지 않습니다. Task를 숨긴 뒤 프로세스가 종료될 가능성에 대비해 상태를 저장해야 합니다.

출처: [CCP 개발 가이드](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/ccp-rotary-controller-development)

---

# 4. 개발 환경·SDK 설치·빌드·매니페스트

## 4.1 프로젝트·SDK 사용 신청

절차:

1. Pleos 계정 가입·로그인.
2. Workspace → My Project.
3. 프로젝트 생성.
4. 프로젝트명·개발사명·카테고리·설명 입력.
5. 필요한 SDK 사용 권한 확인·신청.

프로젝트 정보:

- **프로젝트 ID(Key):** 앱 심사 시 Console에 입력.
- **Client ID/Client Secret:** TTS·STT 등 서버 연결 SDK에 사용.
- Emulator **2.1.0 이후 CRN 입력 불필요**.

프로젝트 신청 문서의 상태:

- **사용 가능:** Vehicle State, NaviHelper. 신청 없이 사용 가능.
- **준비 중:** FusedLocation, TextToSpeech, SpeechToText, Vehicle Control.
- 신청 필요 → 검토 중 → 승인 시 사용 가능, 반려 시 반려됨.
- 정보제휴 계약 필요 항목은 웹 신청이 아니라 담당자와 별도 계약.

**중요:** API 문서·Maven artifact가 존재하는 것과 프로젝트에서 실제 사용 승인이 가능한 상태는 다릅니다.

출처: [프로젝트 생성 및 SDK 사용 신청](https://document.pleos.ai/docs/pleos-only/create-my-project)

## 4.2 개발 환경 요구사항

제품 앱 기준:

- Android Studio.
- Android SDK **API 34**.
- **minSdk API 28 이상**.
- Gradle **8.0 이상**.
- Java·Kotlin.
- Pleos Connect Emulator **2.1.0**.

원문:

> “minSDK 버전은 Android API 28 이상이어야 합니다. 이는 차량 사이버 보안 요건(사이닝 키 로테이션·리니지 지원)에 따른 요구사항입니다.”

Getting Started 절차:

- File → New → New Project.
- Car 또는 Automotive.
- Empty Activity.
- Kotlin.
- Minimum SDK API 28 이상.
- 먼저 app 모듈 빌드 확인.

출처: [Getting Started](https://document.pleos.ai/docs/pleos-only/getting-started) · [Emulator 설치 및 실행](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator)

## 4.3 Emulator 설치

SDK Manager → SDK Update Sites:

- Name: `Pleos Connect System Image`
- Mac:

```text
https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-arm64-sys-img.xml
```

- Windows/Linux:

```text
https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-sys-img.xml
```

설치:

- SDK Platforms → Android API Level **34**.
- Show Package Details 활성화.
- Pleos Connect system image 설치.
- Android Studio 재시작.
- 이전 Emulator가 있으면 기존 버전 삭제 후 설치.

AVD:

- Automotive → **Pleos Connect v2.1.0**.
- API **34**.
- RAM **4 GB**.
- Default boot **Cold**.
- 이전 Studio의 Graphics는 Hardware, Boot option은 Cold boot.

원문:

> “Boot options를 반드시 cold boot로 설정해야 합니다. quick boot로 설정할 경우에는 VHAL을 이용할 수 없습니다.”

출처: [설치 및 실행](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator) · [Emulator 설정](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/configure-pleos-connect-emulator)

## 4.4 GPU·마이크·제약

원문:

> “Pleos Connect Emulator를 실행하려면 그래픽 카드가 필수입니다.”

권장:

- `NVIDIA RTX 4060/5060 Laptop 8GB 이상`
- `AMD Radeon RX 7700S/RX 7600M XT 8GB급 이상 외장 GPU`

최소:

- `NVIDIA GeForce RTX 3060 Laptop GPU 6GB 이상`
- `AMD Radeon RX 6600M 8GB 또는 RX 6700S 8GB 이상`

이 페이지에 Mac용 별도 GPU 수치는 없습니다. 위 값을 Apple Silicon 미지원 판정으로 확대할 수는 없습니다.

그 밖에:

- 기본 언어 한국어.
- 차량 설정 → 일반 → 언어에서 English 전환.
- STT 테스트는 Extended Controls → Microphone에서 입력 수신 설정.
- 이 버전은 AVD Bluetooth 동글 연동 미지원.

출처: [Emulator 설정](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/configure-pleos-connect-emulator)

## 4.5 Maven과 SDK 의존성

Getting Started의 저장소 예:

```kotlin
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven {
            url = uri("https://nexus-playground.pleos.ai/repository/maven-releases/")
        }
    }
}
```

Getting Started는 다음 버전을 사용합니다.

```kotlin
dependencies {
    implementation("ai.pleos.playground:Vehicle:2.3.1")
}
```

반면 최신 세부 가이드·2026-10-19 릴리스 기준은 다음입니다.

```kotlin
dependencies {
    implementation("ai.pleos.playground:Vehicle:2.3.2")
    implementation("ai.pleos.playground:NaviHelper:3.0.5")
    implementation("ai.pleos.playground:TextToSpeech:3.3.1")
    implementation("ai.pleos.playground:SpeechToText:3.3.1")
    implementation("ai.pleos.playground:FusedLocation:1.1.3")
}
```

**필요한 SDK만 선택**해야 하며, 위 다섯 개를 모두 넣으라는 의미는 아닙니다.

출처: [Getting Started](https://document.pleos.ai/docs/pleos-only/getting-started) · [Vehicle](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/project-setup) · [NaviHelper](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/importing-sdk) · [TTS](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/TextToSpeech/importing-sdk) · [STT](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/importing-sdk) · [FusedLocation](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/project-setup)

## 4.6 첫 매니페스트·API 호출

공식 Getting Started 예:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="pleos.car.permission.CAR_DOORS" />

    <application
        ...>
        ...
    </application>
</manifest>
```

```kotlin
val vehicle = Vehicle(context)
vehicle.initialize()

val door = vehicle.getDoor()
door.getCurrentDoorPosition(
    area = DoorArea(DoorValue.ROW_1_LEFT),
    onComplete = { pos: Int? ->
        // Use the current door position.
    },
    onFailed = { e: Exception ->
        // Handle the Vehicle SDK error.
    }
)

// Do not call release() here.
// Call release() when the app no longer needs Vehicle SDK (for example, in onDestroy()).
```

原文:

> “onComplete와 onFailed는 비동기 콜백이며, vehicle.release()는 콜백 처리 완료 후 또는 SDK를 더 이상 사용하지 않는 앱 생명주기 시점(예: onDestroy)에서 호출하세요.”

이 예는 SDK 호출 흐름만 보여주며 전체 Activity 생명주기 구현은 포함하지 않습니다.

출처: [Getting Started](https://document.pleos.ai/docs/pleos-only/getting-started)

## 4.7 IME·윈도우 resize

- IME insets에 따른 resize는 AOSP 기본 동작.
- 입력 필드가 있는 window는 IME에 맞춰 이동하는 것이 사양.
- 입력 필드가 없는 window는 IME에 앵커링되지 않도록 수정.

System dialog 예:

```kotlin
val params = WindowManager.LayoutParams(...)
val typesToFit = WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars()
params.setFitInsetsTypes(typesToFit)
windowManager.addView(overlay, params)
```

App dialog 예:

```kotlin
val dialog = Dialog(this)
val window = dialog.window
window?.let { win ->
    val params = win.attributes
    val typesToFit = WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars()
    params.setFitInsetsTypes(typesToFit)
    window.attributes = params
}
dialog.setContentView(R.layout...)
dialog.show()
```

출처: [IME Window Resize](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/ime-window-resize-handling-guide)

---

# 5. 사용 가능한 SDK·API·차량 데이터

## 5.1 Vehicle SDK 공통 사용법

진입점:

```text
Vehicle(context)
→ initialize()
→ getDoor()/getBrake()/getXxx()
→ Capability/Get/Set/Callback
→ listener 해제
→ release()
```

원문:

> “Door, Brake 같은 도메인 객체는 직접 생성하지 않고, Vehicle SDK의 진입점인 Vehicle 인스턴스의 getDoor(), getBrake()와 같은 getXxx()로만 얻습니다.”

> “차량 통신은 IPC이므로 get·set·capability 결과는 즉시 반환되지 않고 onComplete·onFailed 콜백으로 비동기 전달됩니다.”

네 가지 패턴:

- **Capability:** `checkXxxCapabilities()`
  - `CapabilityConfig.accessType`: `NONE`, `READ`, `WRITE`, `READ_WRITE`.
  - 영역별 `AreaBounds.minValue/maxValue`.
- **Get:** 현재 값 조회.
- **Set:** 상태 변경 요청.
- **Callback:** `registerXxx()`·`unregisterXxx()`.

Capability 예:

```kotlin
val door = vehicle.getDoor()
door.checkDoorPositionCapabilities(
    onComplete = { config, areaMap ->
        when (config.accessType) {
            AccessType.READ, AccessType.READ_WRITE -> {
                val bounds = areaMap[DoorArea(DoorValue.ROW_1_LEFT)]
                // bounds?.minValue / bounds?.maxValue 확인 후 조회
            }
            else -> {
                // NONE 또는 WRITE only: UI 비활성화 또는 대체 흐름
            }
        }
    },
    onFailed = { e: Exception ->
        if (e is VehicleException) {
            // e.errorCode
        }
    }
)
```

**Set 완료 콜백은 실제 차량 값 변경 확인과 다릅니다.** GET 또는 Listener로 실제 상태를 확인해야 합니다. `initialize()` 호출이 반환됐다는 것만으로 서비스 연결·기능 지원까지 보장되지 않습니다.

출처: [Vehicle 소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/intro) · [도메인 획득](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/obtain-domain-object) · [Capability](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/check-capability) · [Get](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/get-property) · [Set](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/set-property) · [Callback](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/callback)

## 5.2 Vehicle 권한

원문:

> “매니페스트에는 pleos.car.permission.{상수명} 형식으로 선언합니다.”

> “세부 API마다 요구 퍼미션이 다를 수 있으므로, 호출 전 해당 함수의 @RequiresPermission을 확인하세요.”

대표 조회 권한:

- Door: `CAR_DOORS`
- Window·Wiper: `CAR_WINDOWS`
- HVAC: `CAR_CLIMATE`
- DrivingMode·Brake·Odometer: `CAR_DRIVE`
- EvBattery·Fuel: `CAR_ENERGY`
- CarInfo·Display: `CAR_INFO`
- Light·TurnSignal: `CAR_LIGHTS`
- SideMirror: `CAR_MIRRORS`
- Safety·Tire: `CAR_SAFETY`
- Seat: `CAR_SEATS`
- Toll: `CAR_TOLL`

쓰기에는 대응 `CONTROL_CAR_*`가 필요합니다. API별 예외가 있으므로 도메인 이름만으로 권한을 결정하면 안 됩니다.

공식 Sample README는 공개 Vehicle의 `CAR_*`·`CONTROL_CAR_*`를 **normal** 권한으로 설명합니다. FusedLocation의 dangerous 권한과 구분해야 합니다.

출처: [Vehicle permissions](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle-permission) · [공식 Vehicle Sample](https://github.com/Pleos-Playground/pleos-sample-vehicle-app)

## 5.3 Vehicle 19개 도메인

### 1) Brake

- 브레이크 페달 상태 조회·구독.
- `getCurrentBrakePedalStatus()`.
- `true`: 페달을 밟고 있음.
- `CAR_DRIVE`.
- 현재 인터페이스를 주차 브레이크 API까지 제공한다고 확대하면 안 됩니다.

출처: [Brake Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/brake/entry)

### 2) CarInfo

- `getCRNInfo()`.
- `getVINInfo()`.
- `CAR_INFO`.
- 소개 문구의 제조사·연식 예시와 별개로, 확인한 실제 인터페이스 함수는 위 두 개입니다.

출처: [CarInfo Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/car-info/entry)

### 3) Display

- 온도 표시 단위 조회·구독.
- `getCurrentTemperatureDisplayUnit()`.
- `CAR_INFO`.
- 현재 인터페이스에 설정 함수는 없습니다.

출처: [Display Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/display/entry)

### 4) Door

- 도어 위치·잠금·글러브박스 잠금.
- `setDoorPosition`, `setDoorLock`, `setGloveBoxLock`.
- `CAR_DOORS` / `CONTROL_CAR_DOORS`.

원문:

> “The maximum (fully open) value is vehicle-dependent and is not fixed. Call checkDoorPositionCapabilities first.”

완전 개방값을 1 또는 100으로 고정하면 안 됩니다. 각 영역의 `AreaBounds`를 확인해야 합니다.

출처: [Door Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/door/entry)

### 5) DrivingMode

- 드라이빙 모드.
- 크루즈컨트롤 상태.
- 크루즈 목표 속도, 단위 **m/s**.
- 조회·구독, `CAR_DRIVE`.

출처: [DrivingMode Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/driving-mode/entry)

### 6) EvBattery

- 누적·현재·순간·충전 이후 전비.
- SOC **%**.
- 충전 전류 제한 **A**.
- 충전 상태.
- 충전 전류 제한·충전 SOC 제한·충전 포트·충전 시작/중지 설정.
- `CAR_ENERGY` / `CONTROL_CAR_ENERGY`.

대표 함수:

```text
getCumulativeEvEfficiency
getCurrentEvEfficiency
getInstantaneousEvEfficiency
getSinceChargeEvEfficiency
getEvBatteryStateOfCharge
getEvChargeCurrentDrawLimit
getEvChargeSwitchState
setEvChargeCurrentDrawLimit
setEvChargePercentLimit
setEvChargePortOpen
setEvChargeSwitch
```

출처: [EvBattery Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/ev-battery/entry)

### 7) Fuel

- 누적·현재·순간·주유 이후 연비.
- 연료 잔량 **%**.
- `CAR_ENERGY`.
- 주유 이후 연비 함수명은 원문상 `getSinceChargeFuelEconomy()`입니다. 설명은 “since refuel”로 되어 있습니다.

출처: [Fuel Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/fuel/entry)

### 8) HVAC

조회·구독:

- AC, 공기청정기.
- 자동 내기순환·자동 공조.
- 성에 제거·듀얼.
- 풍향·풍량.
- MAX AC·MAX DEFROST.
- 전원·내기순환.
- 설정 온도·현재 온도.

현재 온도를 제외한 대응 설정 함수가 제공됩니다.

- 설정 온도 Capability 단위: **°C**.
- `CAR_CLIMATE` / `CONTROL_CAR_CLIMATE`.

출처: [HVAC Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/h-v-a-c/entry)

### 9) Light

- 앰비언트 자동 색상·밝기·색상·상태·스위치.
- 실내등·전방 안개등·상향등·하향등·독서등·후방 안개등·테일램프.
- 상태·스위치 조회, 대응 스위치 설정.
- `CAR_LIGHTS` / `CONTROL_CAR_LIGHTS`.

출처: [Light Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/light/entry)

### 10) Odometer

- 총주행거리 **km**.
- 누적·현재·순간·주유 이후 트립 거리 **m**.
- 누적·현재·주유 이후 트립 시간.
- `setRangeRemainingDistance()`의 거리 단위 **m**.
- `CAR_DRIVE` / `CONTROL_CAR_DRIVE`.

트립 시간 단위는 확인한 인터페이스 설명에서 명확하지 않아 초라고 단정하지 않았습니다.

출처: [Odometer Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/odometer/entry)

### 11) Safety

- 브레이크액·엔진오일·변속기오일 상태.
- 워셔액 부족·파워다운 경고.
- 에어백 전개·활성화 상태.
- 안전벨트 미착용 경고.
- Telltales.

일반 `CAR_SAFETY` 외에 일부 Telltales Capability·구독 API에 **`PRIVATE_CAR_SAFETY`**가 등장합니다. 이를 일반 앱용 공개 권한처럼 복사해서는 안 됩니다.

출처: [Safety Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/safety/entry)

### 12) Seat

- 등받이 각도.
- 안전벨트 높이.
- 좌판 깊이·앞뒤 위치.
- 헤드레스트 각도·앞뒤·높이.
- 좌석 높이·틸트.
- 요추 앞뒤·측면 지지.
- 안전벨트 착용·착좌 상태.
- 좌석 온도·통풍.
- 위치별 `moveSeat...`, 온도·통풍 설정.
- `CAR_SEATS` / `CONTROL_CAR_SEATS`.

실제 높이 관련 함수명에 `getCurrentSeatHeadrestHeightAftPosition()`이라는 표기가 있습니다.

출처: [Seat Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/seat/entry)

### 13) SideMirror

- `getHvacSideMirrorHeatState`.
- `setHvacSideMirrorHeat`.
- API별 `CAR_MIRRORS`, `CAR_CLIMATE`, `CONTROL_CAR_MIRRORS`가 등장하므로 개별 어노테이션 확인.

출처: [SideMirror Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/side-mirror/entry)

### 14) SteeringWheel

- `getCurrentSteeringWheelAngle`.
  - 설명상 **front-wheel steering angle**.
  - 단위 **degrees**.
  - `CAR_DRIVE`.
- 핸들 열선 상태 조회·설정.
  - `CAR_CLIMATE` / `CONTROL_CAR_CLIMATE`.

출처: [SteeringWheel Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/steering-wheel/entry)

### 15) Tire

- `getLowTirePressure(area: WheelArea, ...)`.
- `CAR_SAFETY`.

원문:

> “Gets the critically low tire pressure threshold in kilopascals (kPa).”

즉 **현재 공기압 측정값이 아니라 위험 저압 임계값**입니다.

출처: [Tire Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/tire/entry)

### 16) Toll

- ETCS 음성 안내 음량 조회·구독·설정.
- `CAR_TOLL` / `CONTROL_CAR_TOLL`.

출처: [Toll Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/toll/entry)

### 17) TurnSignal

- 방향지시등 상태 조회·구독.
- `CAR_LIGHTS`.

출처: [TurnSignal Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/turn-signal/entry)

### 18) Window

- 창문 위치·잠금.
- 블라인드 위치·이동.
- 스마트글라스 레벨·상태·구성.
- 창문 위치·잠금 설정.
- 스마트글라스 레벨·전체 상태·구역 상태 설정.
- `CAR_WINDOWS` / `CONTROL_CAR_WINDOWS`.

`setSmartGlassZoneState`는 지정 window area의 smart glass panel당 명령 하나를 제출하는 방식입니다.

출처: [Window Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/window/entry)

### 19) Wiper

- 와이퍼 모드·스위치 조회.
- `setWiperSwitch`.
- `CAR_WINDOWS` / `CONTROL_CAR_WINDOWS`.

출처: [Wiper Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/wiper/entry)

## 5.4 Vehicle 오류 처리

원문:

> “모든 onFailed가 VehicleException은 아닐 수 있습니다.”

> “ErrorCode가 콜백 인자로 직접 전달되지는 않습니다.”

`Exception`을 받고, `VehicleException`일 때 `errorCode`를 확인합니다.

- `ERROR_NOT_SUPPORTED_PROPERTY`: 기능 미지원.
- `ERROR_NOT_SUPPORTED_AREA`: 영역 미지원.
- `ERROR_NOT_SUPPORTED_VALUE_TYPE`: 값 타입 불일치.
- `ERROR_SECURITY_PERMISSION`: 권한.
- `ERROR_SERVICE_CONNECTION_FAILURE`: 서비스 연결.
- `ERROR_INTERNAL_SERVICE`: 내부 서비스 오류.
- `ERROR_DRIVING_RESTRICTED`: 주행 규제.
- `ERROR_EMPTY_RESULT`: 빈 결과.
- `ERROR_UNDEFINED`: 미정의.

`null/unavailable`을 무조건 권한 문제로 단정해서는 안 됩니다.

출처: [Vehicle Error Code](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle-error-code)

## 5.5 NaviHelper

### 기능·권한

기능:

- 목적지 설정·조회·취소.
- 경로 옵션 변경·재탐색.
- 경유지 추가·조회·제거.
- 목적지와 경유지를 한 요청으로 전달.
- 북마크·최근 목적지·현재 위치·목적지·경로 상태·TBT.
- 충전사업자 정보.
- Trip 정보·내비 화면 요청.

권한:

- `pleos.car.permission.NAVI_ROUTE`
  - `get*Info()`, `requestTrip()`.
- `pleos.car.permission.NAVI_ROUTE_SEARCH`
  - 경로 탐색·취소·재탐색·경유지·옵션 변경.
- `pleos.car.permission.NAVI_CUSTOM_MAP`
  - `requestNavigationScreen`.

출처: [NaviHelper 소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/intro) · [권한](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/declaring-permissions) · [Reference](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/navi-helper/ai.pleos.playground.navi.helper/navi-helper/entry)

### 초기화·비동기 결과

```kotlin
val naviHelper = NaviHelper(applicationContext)
naviHelper.initialize(
    onConnected = {
        // 리스너 등록 및 API 호출
    },
    onFailed = { throwable ->
        // 초기 연결 재시도 전부 실패
    }
)
```

원문:

> “requestRoute() 호출이 정상적으로 수행되더라도 경로 탐색 완료를 의미하지 않습니다. 최종 결과는 이벤트 콜백으로 확인합니다.”

> “정보 조회 API는 값을 직접 반환하지 않으며, 대응하는 이벤트 콜백에서 결과를 처리합니다.”

종료 시 동일 listener를 `removeListener()`한 다음 `release()`합니다.

주요 이벤트:

- `onRouteStarted`, `onRoutingCompleted`, `onRouteCancelled`.
- `onReRouteEnded`, `onRouteOptionChanged`.
- 목적지·경유지 변경/도착.
- 위치·북마크·최근 목적지·TBT·경로·Trip.
- `onNavigationStatus`, `onDrivingInfo`.
- 도로 제한속도·카메라·주의 지점.
- `onError`.

실제 이벤트 제공은 기본 내비 앱 구현과 현재 상태에 의존합니다.

출처: [초기화](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/initialization-and-release) · [이벤트](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/event-listeners) · [목적지](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/destinations)

### 경로 옵션·경유지

`RouteOption`:

```text
RECOMMENDED
SHORT_DISTANCE
SHORT_TIME
FREE
HIGHWAY
COMFORTABLE
SCHOOL_ZONE
```

원문:

> “경유지는 최대 두 개까지 지정할 수 있으며, WaypointIndex.FIRST와 WaypointIndex.SECOND로 구분합니다.”

전체 삭제는 `WaypointIndex.ALL`입니다.

공식 예:

```kotlin
naviHelper.requestRouteWithWaypoints(
    RouteWithWaypointsRequest(
        destination = RouteInfo(
            latitude = 37.48544722,
            longitude = 127.03636666,
            poiName = "42dot",
            poiId = "36khp37hh8gqcm5nqhe5",
            address = "서울시 강남구 남부순환로 2621",
            poiSubId = "0"
        ),
        waypoints = listOf(
            RequestWaypointInfo(
                latitude = 37.41275833,
                longitude = 127.09481944,
                poiName = "판교 현대백화점",
                waypointIndex = WaypointIndex.FIRST,
                poiId = "36khp2hdj2cfcm5nqhe3",
                address = "경기도 성남시 수정구 창업로 0번길 6",
                poiSubId = "0"
            )
        )
    )
)
```

출처: [Routes](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/routes) · [Waypoint](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/waypoint-settings) · [일괄 경로](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/route-with-waypoints)

### 오류·데이터 모델

오류 예:

- `CAUSE_LOW_BATTERY`
- `CAUSE_SEARCH_ROUTE_OVER_DISTANCE`
- `CAUSE_SEARCH_ROUTE_TOO_SHORT_DISTANCE`
- `CAUSE_SEARCH_ROUTE`

최대 거리·최소 거리의 정량 기준은 가이드에 없습니다.

데이터 모델에는 Bookmark, CameraAlert, CautionPoint, ChargerOperator, ChargingPlan, CurrentLocation, Destination, DrivingInfo, Route, TBT, Traffic, Trip, Waypoint 등이 있습니다. 모델 존재만으로 모든 데이터가 언제나 독립 조회 가능하다고 보장되지는 않습니다.

출처: [오류](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/error-handling) · [데이터 모델](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/navi-helper/ai.pleos.playground.navi.data/entry)

## 5.6 FusedLocation

Pleos의 차량 위치 SDK이며 **Google Fused Location과 별개**입니다.

API:

```text
isSupported()
initialize()
release()
getLastKnownLocation()
registerFusedLocationCallback()
unregisterFusedLocationCallback()
showLocationAccessBlockedPopup()
addProximityAlert()
removeProximityAlert()
```

권한:

```xml
<uses-permission android:name="pleos.car.permission.FUSED_LOCATION" />
```

보호 수준은 **dangerous**이며, 매니페스트와 런타임 승인이 필요합니다.

원문:

> “FusedLocation API를 사용하기 전에 isSupported()로 현재 실행 환경의 지원 여부를 확인해야 합니다.”

> “initialize()를 호출한 경우에는 SDK 사용이 끝날 때 반드시 release()를 호출해야 합니다.”

> “unregisterFusedLocationCallback()은 위치 업데이트 리스너를 해제하는 API이고 release()는 SDK 자체를 해제하는 API이므로 서로 대체할 수 없습니다.”

> “release()를 호출한 뒤에는 같은 인스턴스로 FusedLocation API를 호출하지 마세요。”

`showLocationAccessBlockedPopup()`은 안내 팝업이며:

> “이 API는 위치 접근을 허용하는 API가 아닙니다.”

그 밖에:

- Last known은 새 위치 계산이 아님.
- `null` 가능.
- `onChanged(LocationData?)`의 null을 유효 위치로 처리하지 않음.
- Android의 coarse/fine/background 위치 정책이나 Google SDK 설명을 Pleos의 보장으로 해석하면 안 됨.

예:

```kotlin
val listener = object : FusedLocationListener {
    override fun onChanged(location: LocationData?) {
        location ?: return
        // Use the location data.
    }

    override fun onError(exception: Exception) {
        // Handle the error.
    }
}
fusedLocation.registerFusedLocationCallback(listener)
fusedLocation.unregisterFusedLocationCallback(listener)
```

현재 모델:

```kotlin
data class LocationData(
    val latitude: Double,
    val longitude: Double,
    val altitude: Double,
    val heading: Float,
    val confidence: Float,
    val timestampMillis: Long
)
```

이 모델에는 **speed 필드가 없습니다**. `confidence`를 임의로 미터 정확도로 해석하면 안 됩니다.

출처: [소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/intro) · [권한](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/declaring-permissions) · [초기화·해제](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/initialization-and-release) · [위치 접근](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/location-data-access) · [오류](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/error-handling) · [LocationData](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/fused-location/ai.pleos.playground.location.fused.model/location-data/entry)

### Proximity Alert

명세:

```kotlin
data class ProximityAlertRequest(
    val latitude: Double,
    val longitude: Double,
    val radiusMeters: Float,
    val transitionTypes: Set<ProximityTransition>
)
```

정확한 제약 원문:

- 위도:
  > “Finite center latitude in degrees, from -90 to 90 inclusive.”
- 경도:
  > “Finite center longitude in degrees, from -180 to 180 inclusive.”
- 반경:
  > “Finite radius in meters, greater than zero.”
- 전이:
  > “Non-empty set of transitions that trigger the alert.”

즉:

- 위도 **−90~90**, 양 끝 포함, 유한값.
- 경도 **−180~180**, 양 끝 포함, 유한값.
- 반경 **m 단위, 0 초과, 유한값**.
- 전이 Set은 비어 있으면 안 됨.
- 전이 유형은 **ENTER·EXIT**. DWELL은 정의돼 있지 않음.

```kotlin
fun addProximityAlert(
    request: ProximityAlertRequest,
    listener: ProximityAlertListener
)

fun removeProximityAlert(alertId: String)
```

- 등록 성공: `onRegistered(alertId)`.
- 전이 감지: `onTransition(event)`.
- 등록/처리 불가: `onError(exception)`.
- 등록·해제 모두 dangerous 권한 필요.
- 권한 미승인은 `SecurityException`.
- 이미 해제됐거나 알 수 없는 ID는 **권한 확인 후 무시**.
- 해제 완료 콜백은 명세에 없음.

이벤트 모델:

```kotlin
data class ProximityAlertEvent(
    val alertId: String,
    val transition: ProximityTransition
)
```

명시되지 않은 항목:

- 최소 권장/최대 반경.
- 동시 등록 상한.
- 만료 시간·체류 시간·처리 타임아웃.
- callback 최대 지연.
- 프로세스 종료·재부팅 후 유지.
- background 전달 보장.
- 히스테리시스·경계 판정.

**Google Geofencing의 제한이나 Gleo의 7초를 여기에 적용하면 안 됩니다.**

출처: [등록](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/fused-location/ai.pleos.playground.location.fused/fused-location/add-proximity-alert) · [해제](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/fused-location/ai.pleos.playground.location.fused/fused-location/remove-proximity-alert) · [Request](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/fused-location/ai.pleos.playground.location.fused.model/proximity-alert-request/entry) · [Transition](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/fused-location/ai.pleos.playground.location.fused.model/proximity-transition/entry) · [Listener](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/FusedLocation/fused-location/ai.pleos.playground.location.fused.listener/proximity-alert-listener/entry)

## 5.7 TextToSpeech·SpeechToText

### 공통

버전: **3.3.1**.

모드:

- `HYBRID`: 기본, 서버 우선·네트워크 연결 실패 시 on-device 전환.
- `SERVER`: 서버만 사용.
- `ON_DEVICE`: 차량 로컬 엔진, 네트워크·앱 등록 불필요.

서버 사용:

1. 초기화 완료.
2. My Project Client ID/Secret으로 `registerApp()`.
3. `OnServerConnectionListener.onConnected()` 이후 서버 요청.

권한:

```xml
<uses-permission android:name="pleos.car.permission.TTS_SERVICE" />
<uses-permission android:name="pleos.car.permission.STT_SERVICE" />
```

지원 locale:

```text
ko-KR
en-US
fr-CA
es-US
es-MX
```

`setLocale()`는 다음 요청 기준으로 적용됩니다. 미설정 시 같은 앱의 이전 값, 없으면 시스템 locale을 사용합니다.

출처: [TTS 소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/TextToSpeech/intro) · [STT 소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/intro) · [TTS 등록](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/TextToSpeech/app-registration) · [STT 등록](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/app-registration) · [TTS 권한](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/TextToSpeech/declaring-permissions) · [STT 권한](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/declaring-permissions) · [TTS locale](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/TextToSpeech/set-locale) · [STT locale](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/set-locale)

### TTS

흐름:

```text
생성 → initialize → addEventListener
→ locale/서버 등록 → speak → stop
→ listener 제거 → release
```

예:

```kotlin
textToSpeech.speak("안녕하세요. 무엇을 도와드릴까요?")
textToSpeech.speak("안녕하세요. ", isFinal = false)
textToSpeech.speak("TextToSpeech SDK입니다.", isFinal = true)
textToSpeech.stop()
```

- `isFinal` 기본 **true**.
- 조각 발화는 마지막을 제외하고 false.
- 이벤트: `onReady`, `onStart`, `onUpdatedRms`, `onDone`, `onStop`, `onError`.

출처: [TTS 초기화](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/TextToSpeech/initialization-and-release) · [이벤트](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/TextToSpeech/event-listeners) · [시작·정지](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/TextToSpeech/start-and-stop)

### STT

원문:

> “SpeechToText는 사용자 발화를 "음악 틀어줘"와 같은 텍스트로 변환하여 반환하며, 음악 재생과 같은 실제 동작은 실행하지 않습니다.”

- `request()`: 차량 마이크 인식.
- `stop()`: 마이크 인식 종료.
- `onUpdated(stt, completed)`에서 `completed=true`는 해당 결과 완료.
- `onUpdatedEpdData(on, off)`는 **byte offset**, 시간값 아님.
- `onUpdatedRms(rms)`는 **dB 값 아님**.
- `sendAudio(ByteArray)`는 **ON_DEVICE만 지원**.

PCM 예시의 원문 수치:

> “이 문서의 3,200-byte 청크와 100ms 간격은 16 kHz, 16-bit, mono PCM을 실시간 속도로 전송하는 예시입니다.”

> “마지막 오디오 데이터를 보낸 후 반드시 completeAudioSend()를 호출하여 입력이 끝났음을 알리세요.”

```kotlin
private const val BYTES_PER_100_MS = 3_200
val pcmData = applicationContext.assets
    .open("test_audio.pcm")
    .use { it.readBytes() }

pcmData.asList()
    .chunked(BYTES_PER_100_MS)
    .forEach { chunk ->
        speechToText.sendAudio(chunk.toByteArray())
        Thread.sleep(100L)
    }
speechToText.completeAudioSend()
```

다른 오디오 형식은 해당 형식의 100ms에 맞게 청크 크기를 계산해야 합니다.

출처: [STT 초기화](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/initialization-and-release) · [결과 listener](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/result-listeners) · [시작·정지](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/start-and-stop) · [PCM 전송](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/sending-audio-data)

### 음성 오류

```text
AUDIO_ERROR
INVALID_REQUEST_ERROR
MIC_ERROR
NETWORK_ERROR
NOT_SUPPORTED_API
ON_DEVICE_ENGINE_ERROR
PERMISSION_DENIED
SERVER_INTERNAL_ERROR
TIMEOUT
UNAUTHENTICATED
UNAVAILABLE_LANGUAGE
UNKNOWN
```

새 오류가 추가될 수 있어 기본 분기를 권장합니다. **음성 SDK TIMEOUT의 초 단위 값은 명시되지 않았습니다.**

출처: [TTS Error](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/TextToSpeech/error-code) · [STT Error](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/error-code)

---

# 6. Gleo Interface

## 6.1 구조

```text
assets/schema.json
→ Gleo LLM function calling
→ Android Intent
→ 앱 기능 수행
→ Callback Broadcast
→ Gleo 음성·텍스트 응답
```

출처: [Gleo Core Concepts](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/core-concepts)

## 6.2 App Schema 규칙

- `packageName`: Android 패키지.
- `appDescription`: 앱 설명.
- `version`: 마켓 등록 버전.
- `actionCalls`: **최대 3개**.
- action `type`: `"function"` 고정.
- `component` 기본 `"activity"`.
  - activity: `context.startActivity()`.
  - service: **`context.sendBroadcast()`**.
- 함수명: 알파벳 대문자, 단어 `_` 구분, Schema 내 고유.
- 구체적인 대상이 포함된 **2~3단어** 권장.
- parameters `type`: `"object"` 고정.
- 개별 parameter type: `string`, `number`, `boolean`, `array`.
- 복수 type 배열 미지원.
- enum은 문자열만, null 미지원.
- required에 선택 parameter를 포함하면 안 됨.
- 모든 필수 parameter가 항상 채워진다는 보장은 없음.

원문:

> “모든 description은 영어로 작성해야 합니다.”

> “Gleo AI의 동작을 조작하려 하거나 다른 앱이나 function 사용을 억제하는 문구를 포함하지 마세요.”

> “Description 내에 구체적인 예시를 제공하지 마세요.”

> “한 문장(최대 두 문장)으로 작성하는 것이 권장됩니다.”

공식 예제의 `ADD_REMINDER` 부분 발췌:

```json
{
  "type": "function",
  "function": {
    "name": "ADD_REMINDER",
    "description": "Add a reminder that will notify the user at the given date and time.",
    "parameters": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "description": "Title of the reminder."
        },
        "dateTime": {
          "type": "string",
          "description": "Date and time to trigger the reminder notification, in ISO 8601 date and time format."
        }
      },
      "required": ["title", "dateTime"]
    },
    "component": "activity"
  }
}
```

예제에는 `invokeWord`도 있으나 필드 명세 본문에 별도 설명이 없으므로 필수 필드라고 단정하지 않았습니다.

출처: [App Schema Writing Guide](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/app-capability)

## 6.3 Callback Schema와 7초 제한

필수:

- `functionName`: App Schema 함수명과 일치.
- `status`: `success`, `asking`, `fail`.
- `message`: 완전하고 짧은 영어 문장.

선택:

- `mode`: 기본 `voice`, 또는 `beep`, `silent`.
- `data`: **JSON 객체 배열을 직렬화한 문자열**.

상태:

- success: 정상 처리. 결과 없음도 가능.
- asking: 추가 필수 정보나 사용자 확인 필요.
- fail: 비즈니스 실패 또는 시스템 오류.

원문:

> “참고로, Gleo는 timeout을 위해 7초 후 Action을 취소합니다.”

예:

```json
{
  "functionName": "ADD_REMINDER",
  "status": "success",
  "message": "The reminder was successfully added.",
  "data": "[ { \"title\": \"미팅\", \"dateTime\": \"2025-02-20T06:00:00Z\" } ]"
}
```

앱 자체 TTS나 음악 재생 시 `mode: "silent"`로 Gleo TTS를 비활성화할 수 있습니다.

출처: [Callback Schema](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/action_callback)

## 6.4 수신·응답 코드

수신 예제 발췌:

```kotlin
val rawJson = intent.getStringExtra("ACTION_PARAM") ?: "{}"
val json = JSONObject(rawJson)
val title = json.optString("title", "No Title")
val dateTime = json.optString("dateTime", "No DateTime")
```

응답 예:

```kotlin
fun sendGleoBroadcast(
    functionName: String,
    status: String,
    message: String,
    data: String? = null
) {
    runCatching {
        val jsonObject = JSONObject().apply {
            put("functionName", functionName)
            put("status", status)
            put("message", message)
            data?.let { put("data", it) }
        }

        Intent("ai.pleos.playground.intent.action.APP_ACTION_RESPONSE").apply {
            putExtra("packageName", packageName)
            putExtra("response", jsonObject.toString())
        }.also {
            sendBroadcast(it)
            Log.d("ThirdPartyApp", "respondAction success jsonObject: $jsonObject")
        }
    }.onFailure {
        Log.e("ThirdPartyApp", "respondAction onFailure >> $it")
    }
}
```

문서 불일치:

- 설명은 parameter의 각 key-value를 개별 `putExtra`한다고 적습니다.
- 실제 Sending/Receiving 예제는 단일 `"ACTION_PARAM"` JSON 문자열을 씁니다.
- 발신 예제의 JSON 문자열에는 추가 따옴표 이스케이프도 있어, 그대로 복사한 코드의 동작을 보장해서는 안 됩니다.

출처: [Code Details with Examples](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/examples)

## 6.5 배치·검토·매니페스트

원문:

> “파일 이름은 반드시 schema.json이어야 합니다.”

> “파일은 앱의 assets/ 디렉토리에 위치시켜야 합니다. (경로 : assets/schema.json)”

> “승인 후에는 통합이 자동으로 활성화됩니다.”

각 function의 action filter 예:

```xml
<activity android:name=".YourActivity">
    <intent-filter>
        <action android:name="ADD_REMINDER" />
        <category android:name="android.intent.category.DEFAULT" />
    </intent-filter>
</activity>
```

Gleo 부팅 시 Schema를 스캔·DB 저장하며, 부팅 스캔은 한 번 수행하는 것으로 설명합니다. 설치·삭제에 따른 DB 갱신 설명도 있으나, 문장의 주어가 다소 모호해 모든 이벤트의 구현 세부까지 단정하지 않았습니다.

라디오 Use Case:

- `SWITCH_BAND`: FM/AM, service.
- `SEARCH_STATION`: 검색어, activity.
- `PLAY_FREQUENCY`: number, service.
- 다중 검색 결과는 asking+후보 data.
- 검색 DB와 검색 로직은 앱이 구현하는 구조입니다.

출처: [Delivering Schema](https://document.pleos.ai/docs/pleos-only/app-integration-guide/guide/deliver-schema) · [Radio Use Case](https://document.pleos.ai/docs/pleos-only/app-integration-guide/use-cases/radio-app)

---

# 7. 오디오 포커스·Suspend·음성 안내

## 7.1 오디오 포커스

- 재생 전에 AudioAttributes와 AudioFocusRequest로 요청.
- 포커스 변화 반드시 처리.
- 다중 holder 최종 우선순위: **`R > E > C`**.
- Concurrent를 의도하면 일반적으로 `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`.
- LOSS는 중단, TRANSIENT는 일시정지, CAN_DUCK은 감쇄.
- duck 해제 시 원복.
- Gleo로 LOSS_TRANSIENT가 오면 즉시 재생 중단, 필요 시 abandon.
- Gleo도 Emergency/Call 등의 Reject 정책에 우선하지 않습니다.

### Interaction Matrix 전체 내용

원본은 **v1.0 (2026-01-28)**, 12×12입니다.

- 행: 현재 Focus Holder.
- 열: 새 요청 Context.
- E: Exclusive.
- R: Reject.
- 아래에서 명시하지 않은 나머지 열은 C입니다.

각 행:

- **MUSIC**
  - E: MUSIC, VOICE_COMMAND, CALL_RING, CALL, EMERGENCY.
  - 나머지 C.
- **NAVIGATION**
  - E: VOICE_COMMAND, EMERGENCY.
  - 나머지 C.
- **VOICE_COMMAND**
  - E: VOICE_COMMAND, CALL_RING, CALL, EMERGENCY, ANNOUNCEMENT.
  - R: MUSIC, NAVIGATION, ALARM, NOTIFICATION, SYSTEM_SOUND, SAFETY.
  - C: VEHICLE_STATUS.
- **CALL_RING**
  - E: EMERGENCY.
  - R: MUSIC, ALARM, NOTIFICATION, ANNOUNCEMENT.
  - 나머지 C.
- **CALL**
  - E: EMERGENCY.
  - R: MUSIC, VOICE_COMMAND, ANNOUNCEMENT.
  - 나머지 C.
- **ALARM**
  - E: CALL_RING, CALL, EMERGENCY.
  - R: SAFETY.
  - 나머지 C.
- **NOTIFICATION**
  - E: VOICE_COMMAND, EMERGENCY.
  - 나머지 C.
- **SYSTEM_SOUND**
  - E: EMERGENCY.
  - 나머지 C.
- **EMERGENCY**
  - C: EMERGENCY.
  - 나머지 R.
- **SAFETY**
  - E: VOICE_COMMAND, ALARM, EMERGENCY.
  - 나머지 C.
- **VEHICLE_STATUS**
  - E: EMERGENCY.
  - 나머지 C.
- **ANNOUNCEMENT**
  - E: VOICE_COMMAND, CALL_RING, CALL, EMERGENCY, ANNOUNCEMENT.
  - 나머지 C.

통화 중 내비 차단 옵션에 따라 기본 Call→Navigation의 C가 R로 바뀔 수 있습니다.

필수 검증 예:

- Music+Navigation → C.
- Call+Music → R.
- Music+Call → E.
- Emergency+Music/Notification → R.
- 다중 holder에서 Voice Command 판정.

**문서 차이:** Music/Audio 샘플은 CAN_DUCK에서도 `pausePlayback()`을 호출하지만, 일반 포커스 가이드는 duck 대신 pause하면 Concurrent가 깨질 수 있다고 설명합니다. 두 문서를 임의로 통일하지 않았습니다.

출처: [오디오 포커스 가이드](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/audio-focus-development-guide/audio-focus-development) · [Matrix 원본](https://document.pleos.ai/assets/images/connect-audiofocus-interaction-matrix-ec92c7e71b5963697419f6cca4b75b61.png)

## 7.2 Suspend

원문:

> “Suspend 모드 진입 시 모든 일반 오디오 세션은 사용자에게 출력되지 않아야 하며 각 앱은 보유 중인 오디오 포커스를 반드시 반납해야 합니다.”

> “이 과정에서 새로운 오디오 재생 또는 오디오 포커스 요청은 허용되지 않습니다.”

진입:

1. 재생 중단.
2. 포커스 abandon.
3. 상태 저장.
4. 플레이어·네트워크·타이머 등 정리.

Resume:

- 포커스 자동 복원 금지.
- 시스템·사용자 조건을 재확인하고 필요 시 재요청.
- 자동재생 여부는 OEM·사용자 정책.
- Suspend 동안 사용자 오디오 지속이나 Resume용 포커스 선점 금지.
- 통화·긴급통신·안전 경고 등은 최소 범위 예외 가능.

원문 예제 발췌:

```kotlin
fun onSuspendEntering() {
    // 1) 새 작업 시작 금지
    // 2) 진행 중 작업 중단
    pausePlayback()

    // 3) 상태 저장
    savePlaybackState()

    // 4) 오디오 포커스 반납
    abandonAudioFocus()

    // 5) 필요 시 네트워크/타이머/센서 리소스 정리
    releaseTransientResources()
}

fun onResumeFromSuspend() {
    restorePlaybackState()

    val shouldAutoResume = false // OEM/앱 정책에 따라 결정
    if (shouldAutoResume) {
        startPlayback()
    }
}
```

출처: [Suspend Audio Focus](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/audio-focus-development-guide/suspend-mode-audio-focus)

## 7.3 음성 안내 선행 묵음

적용: TTS, 녹음 안내, 내비·알림·상태 안내 등 모든 음성 출력.

원문:

> “모든 음성 안내 재생 시작 전 선행 묵음 150 ms ~ 200 ms 적용을 권장합니다.”

- 최소 권장: **150 ms**.
- 기본 권장 구간: **150 ms ~ 200 ms**.
- **150 ms 미만:** 첫 음절 손실 가능.
- **200 ms 초과:** 체감 지연 때문에 필요 시 예외적으로 사용.

원문:

> “음성 안내는 묵음 없이 즉시 재생하지 않습니다.”

권장 순서:

1. PCM/WAV 앞단 padding.
2. TTS 후처리.
3. 플레이어 지연.

연속 발화 조각마다 반복 삽입하지 않으며, 스트림 단절·새 세션에서는 다시 적용합니다. 묵음은 출력 경로 초기화나 포커스 확보를 대체하지 않습니다.

출처: [Voice Guidance Preroll Silence](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/voice-guidance-preroll-silence-guide)

---

# 8. 테스트·Virtual Console·샘플

## 8.1 Virtual Console 연결

최소 Emulator **2.1.0**.

```sh
adb forward tcp:8088 tcp:8088
```

PC 브라우저:

```text
http://127.0.0.1:8088/
```

기어 **P**에서 Highway/Forest 테마 변경, Highway에서는 First/Third person 변경이 가능합니다.

접속 실패 시 Emulator·`adb devices`·forward·8088 점유·URL을 순서대로 확인합니다.

출처: [Virtual Console 셋업](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/use-vehicle-emulator)

## 8.2 Console 카드와 시험 입력 범위

**아래는 시험 UI의 범위이지 모든 실차 API의 공통 보장 범위가 아닙니다.**

### Vehicle·Motion·ADAS

- Notification 식별자 **1** 표시/숨김.
- Gear: P/R/N/D.
- Brake Pedal: **0~100%**.
- Odometer: **0~1,000,000km**, **1km** 단위.
- Steering Angle: **−540~540도**, **1도** 단위.
- Steering Wheel Heat: Off/Low/Medium/High.
- Cruise State:
  - Not ready / Ready / Longitudinal / Lateral / Full autonomous.
- Cruise Target Speed:
  - **5.556~27.778m/s**
  - **0.277775m/s** 단위.

### Convenience

- ETCS 전원, 카드 삽입/제거, 요금소 진입/진출.
- 앞뒤 좌우 도어 열림/닫힘·잠금.
- 프렁크·트렁크.
- 실내등·독서등.
- Ambient Brightness: **0~100%, 1%**.
- Ambient Color: Cyan/Blue/Purple/White.
- Exterior Lights: Off/Auto/Tail lamp/Low beam.
- 상향등·비상등·브레이크등.
- 프렁크·트렁크 도어등.
- 방향지시등 Off, 좌우 Blink/Flash.
- Window Position: **0~100%, 1%**.
- Window Lock: 뒷좌석 전체/좌우.
- Seat Occupancy: Empty/Occupied.
- 앞뒤 Wiper: Off/Auto/Low/High.
- Glove Box 열림/닫힘.

### Safety

- 주차브레이크·안전벨트·ABS·TPMS 등 경고등 Off/On/Blink.

### Energy

- Remaining Range: **0~1,000,000m**, **1,000m** 단위.
- Battery Energy: **0~200kWh**, **0.1kWh** 단위.
- SOC: **0~100%, 1%**.
- Battery Capacity: **0~200kWh**, **0.1kWh**.
- Charge Current Limit: **10~48A**, **0.5A**.
- Charge Percent Limit: **50~100%, 5%**.
- Charge Switch: Off/On.
- Charge Port: Closed/Open.

### Climate

- HVAC Power·AC·Auto·Dual: Off/On.
- Recirculation: Fresh/Recirculate.
- Fan Speed: **0~8단계**.
- Fan Direction: Face/Floor/Defrost.
- 앞뒤 Defroster: Off/On.
- Target Temperature: **16~30°C**, **0.5°C**.
- Seat Temperature:
  - **통풍 3단계, Off, 열선 3단계**.
- Air Cleaner: Off/On.

현재 이 카드 목록에는 GPS 좌표 변경 카드가 없습니다.

출처: [Virtual Console 사용 가이드](https://document.pleos.ai/docs/pleos-only/app-test-guide/virtual-console-guide)

## 8.3 폼팩터 테스트

준비:

- Android Studio·Platform-Tools.
- **Go 1.22 이상**.
- 앱이 설치된 Emulator.
- 포트 **8095, 8096**.

원문:

> “가상 디스플레이는 Android Emulator를 별도 창으로 실행할 때 표시됩니다. Android Studio의 Running Devices 도구 창에 내장하거나 Headless 모드로 실행하지 마세요.”

```sh
adb devices
adb emu avd name
go run . --avd "Pleos Connect v2.0"
```

여기서 `"Pleos Connect v2.0"`는 **예시 AVD 이름**입니다. 권장 Emulator 버전을 2.0으로 되돌리라는 의미가 아닙니다.

- Bridge 정상 로그: `http://127.0.0.1:8096`.
- 예시 gRPC target: `127.0.0.1:8554`.
- Bridge 터미널 유지.
- FormFactorConsole에서 preset·orientation 선택.
- dp·DPI·px 확인 후 가상 화면 생성.
- 잘림·겹침·정렬·텍스트/아이콘 크기·터치·전환 검증.
- 디스플레이 제거 시 앱 강제종료 가능, 데이터 먼저 저장.

도해의 실제 시험 예:

- 12.9″ Portrait:
  - `840 x 1184 dp`
  - `160 DPI`
  - `840 x 1184 px`
- 14.6″ Landscape:
  - `1360 x 948 dp`
  - `200 DPI`
  - `1700 x 1185 px`

도해 preset의 WF는 **18.7″**, 디자인 레이아웃 표의 WF는 **18.5″**로 서로 다릅니다. 12.9″ 시험 도해의 크기도 앞의 디자인 표와 일치하지 않습니다.

종료:

```sh
adb forward --remove tcp:8095
```

출처: [폼팩터 테스트](https://document.pleos.ai/docs/pleos-only/app-test-guide/form-factor-test-guide) · [12.9 Portrait 도해](https://document.pleos.ai/assets/images/form_factor_12.9_port-c5b2a80a1d1d629281ef412f15eb056c.png) · [14.6 Landscape 도해](https://document.pleos.ai/assets/images/form_factor_14.6_land-a3a03fbf6e6f4fa8e0de5ec17c70444b.png)

## 8.4 Vehicle Sample

기준:

- Sample **1.0.0-sdk35**.
- Vehicle SDK **2.3.2**.
- Vehicle Service **2.3.22**.
- Android **14** Pleos AVD.
- JDK **17**.
- Gradle wrapper **8.10.2**.
- AGP **8.8.2**.
- Kotlin **2.0.0**.
- compileSdk/targetSdk **35**.
- Sample minSdk **23**.

**제품 앱의 minSdk 28 이상 요구는 별도입니다.**

```sh
./gradlew assembleDebug
./gradlew installDebug
```

APK 위치:

```text
app/build/outputs/apk/debug/
```

학습 흐름:

```text
checkDoorPositionCapabilities
→ getCurrentDoorPosition
→ registerDoorPosition
→ setDoorPosition
→ unregisterDoorPosition
```

핵심 주의:

- 일반 폰·기본 Android 이미지가 아니라 Vehicle Service 포함 Pleos AVD 필요.
- 등록 시의 동일 listener와 area로 해제.
- 화면 이동·area 변경만으로 자동 해제되는 것은 아님.
- SET 완료 후 실제 상태를 GET/Listener로 확인.
- Sample 전체 권한·전체 탐색기를 제품 앱에 복사하지 않음.
- 실제 AVD의 Window Position 응답 `0..10` 등은 공통 % 규격이 아님.

README는 **19 domains, 442 non-deprecated public methods**를 설명합니다. `PublicApiPolicyTest`는 과거 2.2.10/441개에 고정된 불일치로 unit suite 실패가 남아 있다고 명시합니다.

출처: [Sample 가이드](https://document.pleos.ai/docs/pleos-only/tutorial/vehicle-sdk-sample-app) · [Vehicle Sample README](https://github.com/Pleos-Playground/pleos-sample-vehicle-app)

## 8.5 Navi·FusedLocation Sample

### NaviHelper

- 기본 내비 앱과 NaviService 설치·설정 필요.
- 응답을 샘플이 만들어내는 것이 아님.
- 목적지·순서 있는 경유지를 한 요청으로 전달.
- 저장소 token·`credentials.gradle` 불필요.

```sh
./gradlew assembleDebug
./gradlew assembleRelease
```

출처: [NaviHelper Sample](https://github.com/Pleos-Playground/pleos-sample-navi-app)

### FusedLocation

- `isSupported()` 확인.
- 권한 승인 후 initialize.
- Last known·연속 업데이트·Proximity ENTER/EXIT 시험.

```sh
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n \
  ai.pleos.playground.location.fused.sample/.MainActivity
```

Mock 위치 허용 예:

```sh
adb shell appops set --user current \
  ai.pleos.playground.location.fused.sample \
  android:mock_location allow
```

Emulator 좌표 예:

```sh
adb emu geo fix 127.0276 37.4979
```

원문:

> “geo fix expects longitude first and latitude second and is only available on emulators.”

즉 **경도 먼저, 위도 나중**, Emulator 전용입니다.

출처: [FusedLocation Sample](https://github.com/Pleos-Playground/pleos-sample-fusedlocation-app)

## 8.6 ADB·플랫폼 FAQ

설치 예:

```sh
brew install android-platform-tools
```

```sh
choco install adb
winget install Google.AndroidSDKPlatformTools
```

```sh
sudo apt update
sudo apt install android-tools-adb android-tools-fastboot
adb version
adb devices
```

앱 조작 예:

```sh
adb install -d -r [apk파일주소]
adb shell pm list packages | grep [패키지명 중 일부내용]
adb shell monkey -p [패키지이름] -c android.intent.category.LAUNCHER 1
adb shell am start -n [패키지이름]/[Activity 경로]
adb uninstall [패키지이름]
adb shell pm clear [패키지이름]
adb shell am force-stop [패키지이름]
```

주행 규제 테스트:

```sh
adb shell cmd hmg_car_service --service drivingstate driving_regulation on
adb shell cmd hmg_car_service --service drivingstate driving_regulation off
```

CCS 관련 아래 명령은 **Devbox·Emulator 미지원**입니다.

```sh
adb shell settings put secure hmg_is_ccs_account_linked 1
adb shell settings put global hmg_provisioning_status 4
```

플랫폼 식별:

- `Build.DEVICE` / `ro.product.device`:
  - `CONNECT_S`, `CONNECT_L`, `CONNECT_W`.
- **실차에서만 유효**, Emulator 구분용 아님.
- `product.sw.target_region`:
  - `KOR`, `EUR`, `USA`, `CAN`.
- 클러스터 속도 일치는 `CarPropertyManager`의 `PERF_VEHICLE_SPEED`.
- GPS 계산 속도는 차량 신호 기반 클러스터와 다를 수 있음.
- 내비 탑재 확인 방법은 공개하지 않고 담당자 문의로 안내.
- Emulator 코덱 지원 결과를 실차 지원으로 일반화하면 안 됨.

출처: [ADB FAQ](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/adb-command-reference-guide) · [플랫폼 FAQ](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/vehicle-app-faq)

---

# 9. 앱 심사·배포 요구사항

## 9.1 제출 전 준비

- 정확한 개발자 정보와 연락 가능한 연락처.
- 설치·실행·삭제·핵심 기능 정상 동작.
- crash·freeze·과부하·이미지 깨짐·해상도 늘어짐 제거.
- 보안 취약점·악성 코드 검사.
- 앱 정보·메타데이터 최신화.
- 심사 중 서버 등 운영 구성 요소 활성화.
- 모든 기능을 확인할 수 있는 계정 제공.
- 출시 국가 법률·규제와 증빙.
- IARC 등급과 증적.
- 설명이 필요한 기능은 심사 노트·설명서.

원문:

> “모든 기능 및 콘텐츠에 대한 접근이 활성화된 계정을 제공 바랍니다.”

로그인이 필요한 경우 관리자 계정이나 게스트만 주는 것이 아니라 **실제 일반 사용자 기준 계정**을 제공해야 합니다.

가이드 준수 자체가 심사 통과를 보장하지 않습니다. 추가 안전 위험이 있다고 판단되면 거부될 수 있습니다.

출처: [앱 심사 제출](https://document.pleos.ai/docs/pleos-only/distribute/app-submission-guide) · [App Review Guidelines](https://document.pleos.ai/docs/pleos-only/distribute/app-review-guide)

## 9.2 기능·성능·시간 제한

원문:

> “입력 후 차량 시스템의 응답 시간이 0.25초를 넘지 않게 하세요.”

여기서 응답은 **터치 후 터치 효과 애니메이션까지의 시간**입니다.

> “앱은 10초 이내에 앱이 실행되어야 합니다.”

> “앱은 10초 이내에 콘텐츠를 로드해야 합니다.”

> “앱 내 특정 버튼은 2초 이내에 반응해야 합니다.”

> “사용자의 동작 이후 2초 이내에 버튼 동작 또는 콘텐츠를 로드하지 못하는 경우, UI를 통해 앱이 동작 중임을 알려야 합니다.”

추가:

- 설치/삭제 오류 금지.
- 실행 시 강제종료·하드웨어 재시작 금지.
- 기능 오동작·먹통·터치 미인식 금지.
- 사운드 끊김·그래픽 깨짐 금지.
- 실제 서비스와 동일한 앱 제출.
- 더미 데이터·임시 파일·임시 콘텐츠 제거.
- background 복귀 시 마지막 상태 복원.
  - 수 시간 이상 미사용한 경우 기본 상태 시작 가능.
- 시스템 과점유·하드웨어/소프트웨어 손상 금지.
- 핵심 기능과 무관한 시스템 설정 변경이나 재시작 요구 금지.

출처: [앱 기능 및 성능 안정성](https://document.pleos.ai/docs/pleos-only/distribute/app-review-guide/review-functionality-performance-stability)

## 9.3 Vehicle 권한 심사

원문:

> “Vehicle SDK API를 사용하려면 해당 API에 필요한 퍼미션을 앱에 선언해야 합니다.”

> “Vehicle SDK 퍼미션은 Pleos App Market과 사전 협의 및 승인된 경우에만 선언할 수 있습니다.”

> “승인되지 않은 퍼미션을 선언한 앱은 심사를 통과할 수 없습니다.”

따라서 Emulator에서 동작한다고 배포 권한 승인이 완료된 것은 아닙니다.

출처: [SDK·API 사용 심사](https://document.pleos.ai/docs/pleos-only/distribute/app-review-guide/review-functionality-performance-stability)

## 9.4 디스플레이 심사

원문:

> “앱이 레터박스 처리 없이 최대한 디스플레이 영역을 채워야 합니다.”

> “앱이 호환성 모드로 실행되어서는 안 됩니다.”

> “사용 중 앱의 해상도가 전환되어도 상태 손실 및 화면 이상이 없어야 합니다.”

> “어떠한 화면 상태 또는 화면 전환간에도 모두 동일한 기능과 작업을 노출하여 기능 패리티를 보존해야 합니다.”

- 미세 비율 차이 보정을 위한 한 방향 레터박스는 허용 가능.
- 콘텐츠·작업 상태 유지.
- 이미지 늘어짐·블러·앨리어싱 방지.
- 버튼 시각 위치와 터치 영역 일치.
- 방향 전환 때문에 기능·버튼이 사라지거나 다른 기능으로 바뀌면 안 됨.
- System bar·키보드·cutout·insets 등 안전 영역 준수.

출처: [디스플레이 호환성](https://document.pleos.ai/docs/pleos-only/distribute/app-review-guide/review-functionality-performance-stability)

## 9.5 제출 항목과 파일 규격

### 필수 기본 정보

- 앱 관리명.
- 버전명.
- 출시 국가·지역.
- 패키지 파일.
- 대상 플랫폼: Connect 또는 InfoLINK.
- 카테고리.
- 연령 등급.
- 개인정보 처리 항목.
- 위치정보 활용 여부.
- 앱 접근 권한.
- SDK 추가 권한 정보·해당 프로젝트 ID.
- 광고성 정보 전송 여부.

### 언어별 정보

- 앱 이름.
- 개인정보처리방침 URL.
- 조건부 위치정보 서비스 이용약관·기타 처리방침 URL.
- 간단한 설명.
- 자세한 설명.
- 아이콘.
- IVI 스크린샷.
- 출시 노트.
- 고객 지원: 웹사이트·이메일·전화번호 중 **1개 이상**.

서비스 국가·지역별 언어로 작성해야 합니다.

### 정확한 수치

- 앱 제목:
  > “앱 제목은 30자(영문 기준)를 초과해서는 안 됩니다.”
- 태그: **최대 20개**.
- APK:
  - 제출 표: **“APK 형식, 최대 600 MB”**.
  - 심사 상세: **“600MB보다 작아야 합니다.”**
  - 정확히 600MB 경계는 두 표현이 다르므로 보수적으로 600MB 미만 준비가 안전합니다.
- 앱 아이콘:
  - PNG/JPEG.
  - **최대 1 MB**.
  - **512 x 512 px**.
- 앱 이미지:
  - **최소 2장**, **최대 8장**.
  - PNG/JPEG.
  - **1장당 최대 8 MB**.
- 심사 노트 첨부:
  - **최대 60 MB**.

### 스크린샷 규격 불일치

심사 상세 문서 원문:

```text
2560 xX 1380 px
1700 xX 1212 px
840 xX 1212 px
```

제출 가이드 표:

```text
2560 x 1380 px
1700 x 1212 px
840 x 121 px
```

마지막 높이가 **1212 / 121**로 다릅니다. 상세 문서의 `xX`도 원문 표기입니다. 임의로 수정해 단일 공식 규격이라고 하지 않고 **Console의 현재 검증값 또는 담당자 확인이 필요한 문서 불일치**로 남깁니다.

출처: [앱 심사 제출](https://document.pleos.ai/docs/pleos-only/distribute/app-submission-guide) · [마켓 등록정보](https://document.pleos.ai/docs/pleos-only/distribute/app-review-guide/review-app-registration-info)

## 9.6 태그·메타데이터·증빙

외국어 공식 앱명을 한국어로 노출하는 경우:

> “원문(영문) 앱명은 반드시 태그로 추가해야 합니다.”

> “영문 태그는 공식 앱명과 동일하게 표기해야 하며, 임의 축약 또는 변형은 허용되지 않습니다.”

한국어 태그는 선택 추가 가능합니다. 일반 제출 표에서는 태그가 선택이지만, **외국어 공식명 조건을 충족하면 영문 태그는 필수**입니다.

메타데이터 금지:

- 부적절한 표현·폭력·선정성·불법 묘사.
- 확인하기 어려운 순위·매출·실적.
- 텍스트 이모티콘·반복 특수문자.
- 다른 앱과 유사·중복되거나 오해를 유발하는 제목/아이콘.
- 실제 앱과 다른 아이콘·스크린샷.

필요 시 증빙:

- 지적재산권 이용 권리.
- 정부/기관 허가.
- 웹 앱의 도메인 등록 확인.
- 공인 의료기관 앱·배포 권한.
- 대한민국 성인용 게임의 GRAC 등급.

출처: [태그 가이드](https://document.pleos.ai/docs/pleos-only/app-registration-guide/app-tagging-guide) · [등록정보](https://document.pleos.ai/docs/pleos-only/distribute/app-review-guide/review-app-registration-info)

## 9.7 콘텐츠 안전성

금지 범주:

- 음주운전·과속·신호 위반 조장·미화.
- 법규상 허용되지 않는 성적 콘텐츠·성적 서비스.
- 과도한 폭력·욕설·폭언.
- 자해·자살·위험 행동 조장.
- 범죄·테러·약물·무기·인신매매 조장.
- 실제 금전 도박·불법 도박 경로 제공.
- 인종·종교·성별 차별 조장.
- 재난·사고·전쟁 등 민감 사건을 악용한 유해 콘텐츠.
- 승인되지 않은 식약품·의료기구·처방약 거래.
- 아동 학대·착취·성적 콘텐츠·위험 유도.
- 지적재산권 침해.
- 암호화폐 채굴.

추가 의무:

- 미디어·UGC 플랫폼은 필터링과 신고 채널.
- **AI 생성 콘텐츠도** 위험·부적절·개인정보 위협 콘텐츠 생성/공유 방지 및 신고 기능.
- 인증 전 화면·미리보기·썸네일·상품 사진에는 전체 이용가 콘텐츠만 노출.
- 국가별 미디어 심의.
- 루트 박스 등 무작위 유료 항목은 구매 전 확률 공개.
- 공익·ESDA 목적은 일부 예외 허용 가능하나 자동 허용 아님.

출처: [콘텐츠 안전성](https://document.pleos.ai/docs/pleos-only/distribute/app-review-guide/review-content-safety)

## 9.8 개인정보 동의·철회

필수 고지:

- 수집 항목.
- 처리 목적.
- 보유 기간.
- 동의 거부 권리.
- 공유 제3자와 사용 방식.

원문:

> “제시된 동의 버튼을 누르는 행동 외의 행동을 동의로 간주해서는 안 됩니다.”

> “사용자가 권한을 허가한 항목의 데이터에만 접근할 수 있습니다.”

> “사용자가 개인정보 제공을 취소한 경우 즉시 앱 내에서 활용 중인 경로를 끊어야하며, 저장된 사용자의 데이터를 삭제해야 합니다.”

아동 개인정보 수집 전 법정대리인 고지·명시 동의가 필요합니다. 국가별 개인정보보호법·GDPR 등을 적용하며, 위치정보 서비스의 등록/신고 증빙을 요구할 수 있습니다.

출처: [사용자 개인정보 및 보안](https://document.pleos.ai/docs/pleos-only/distribute/app-review-guide/review-user-privacy-security)

## 9.9 앱 보안 필수 기준

### 민감 데이터

- PII·금융 정보·차량 민감 데이터·토큰·비밀 API 키·암호화 키 보호.
- 내부/외부 저장소·캐시·SQLite·SharedPreferences 모두 암호화 원칙 적용.
- 임시 파일·사본에도 평문을 남기지 않음.
- 출시 전 민감 로그 비활성화 또는 마스킹.
- 민감 캐시는 가급적 저장하지 않고, 필요 시 암호화.
- URL 경로·query에 토큰·세션·비밀번호 포함 금지.
- Authorization header 등 적절한 방식 사용.

원문:

> “기기에 저장하는 민감정보는 저장 위치와 관계없이 암호화하여 보호해야 합니다.”

현재 non-GAS AAOS에서는 Google 자동 백업이 동작하지 않지만, 다른 Android 환경을 고려해 불필요한 백업 비활성화와 민감 데이터 제외를 권장합니다.

### 암호화·키

- 검증된 표준 알고리즘.
- MD5·SHA-1 대신 SHA-256 등 권장.
- AES-GCM 권장, ECB 지양.
- RSA는 SHA-256 OAEP 등 적합한 padding 고려.
- GCM에서 동일 키·IV/nonce 재사용 방지.
- 암호학적 난수 사용.
- Keystore 등 안전한 키 관리.

원문:

> “키를 소스코드, 리소스 또는 설정 파일에 하드코딩하거나, 보호 대상 데이터와 함께 평문으로 저장하는 방식은 사용하지 않아야 합니다.”

### 통신

> “TLS를 사용하는 통신에는 최소 TLS 1.2 이상을 사용해야 하며, TLS 1.3 사용을 권장합니다.”

- SSL·TLS 1.0·1.1 연결 방지.
- HTTPS 등 암호화 프로토콜.
- 신뢰할 수 있는 서버만 연결.
- 원격 명령의 출처·유효성·무결성 검증.
- 명령 범위 최소화.

### 컴포넌트·권한

- 필요한 권한만.
- 외부 호출이 필요 없는 Activity·Service·Receiver·Provider 비노출.
- 민감 데이터 전달 시 수신 대상 명확화.
- 공개 컴포넌트도 호출자 인증과 접근 권한을 모두 확인.
- WebView 로컬 파일 접근 최소화.
- 외부 URI·파일 경로 검증·정규화 권장.

### 빌드·배포

- 공식 승인 API만 사용.
- 차량 API는 앱 기능과 직접 관련된 범위만.
- 비밀 정보 하드코딩 금지.
- 취약한 SDK·라이브러리 업데이트.
- 정식 배포 서명 인증서 사용.
- 디버그 빌드·앱 디버깅·WebView 원격 디버깅 비활성화.
- native library는 RELRO·Stack Canary·NX 등 보호 권장.

### WebView·브라우저 추가 요구

- 콘텐츠·이동 사이트·JavaScript bridge 범위 최소화.
- 보안 업데이트가 지원되는 신뢰 가능한 브라우저 엔진.
- HTTPS 지원 사이트는 HTTPS 연결.
- 비암호화 사이트에는 위험 안내.
- 인증서 신뢰 체인·유효기간·호스트명 검증.
- 인증서 오류 무시·무조건 신뢰 금지.
- SOP·CORS 우회 금지.
- **CSP Level 2 이상** 지원.
- 프로세스 격리·샌드박스 유지.
- 최종 배포 앱의 개발자 모드·임의 프록시 변경·확장 설치 비활성화.
- 파일 다운로드 기능 제한.

출처: [앱 보안 가이드](https://document.pleos.ai/docs/pleos-only/app-registration-guide/app-security-guide)

## 9.10 업데이트·버전 관리

원문:

> “Pleos App Market은 앱 자동 업데이트를 지원하지 않습니다.”

개발사 구현:

1. 앱 실행 시 버전 확인.
2. 최신 버전이 아니면 안내.
3. Yes이면 마켓 상세 이동.
4. No이면 개발사 정책에 따라 유지/종료.

안내 문구:

> “최신 버전이 존재합니다. 업데이트를 위해 페이지를 이동할까요? (Yes, No)”

상세 경로 원문:

```text
market://detail?package={페키지명}
```

마켓은 로그인 확인과 실제 업데이트를 처리합니다. 버전 확인 SDK는 현재 제공 기능이 아니라 차후 고려로 표기됩니다.

버전 정책 원문:

> “앱 배포 또는 심사 요청 시에는 반드시 앱 버전을 변경해야 합니다.”

> “기능 수정, 버그 수정, 설정 변경 등 앱에 영향을 주는 모든 변경 사항은 버전 업데이트를 통해 관리해야 합니다.”

버전 미변경 시 심사가 진행되지 않거나 반려될 수 있습니다. 출시 후에도 모니터링·재심사 대상이며, 심각한 오류·장기 방치·다수 신고 앱은 마켓에서 제외될 수 있습니다.

출처: [업데이트 가이드](https://document.pleos.ai/docs/pleos-only/app-registration-guide/app-update-guide) · [버전 관리 정책](https://document.pleos.ai/docs/pleos-only/app-registration-guide/app-version-management-policy) · [출시 후 관리](https://document.pleos.ai/docs/pleos-only/distribute/app-submission-guide)

---

# 10. 컬러 가이드 전체 수치

## 10.1 사용 원칙

- Scale Token: 특별한 semantic 맥락이 없을 때 사용.
- Grayscale: 투명도 없는 기본 흑백.
- Alpha: 투명도와 배경 조합.
- Static: Light/Dark에 영향받지 않는 raw 값, 주로 Overlay 위 요소.

원문:

> “그 어떤 경우에도 Scale Token을 사용할 수 있습니다.”

아래 값은 **Light → Dark** 순서입니다. 동일 이름·접두사 불일치·밑줄 누락을 원문대로 보존했습니다.

출처: [Colors](https://document.pleos.ai/docs/connect/guide/docs-design/foundations/colors)

## 10.2 Basic

### Grayscale

- `basic_00`: `#FFFFFF` → `#131417`
- `basic_50`: `#F7F8FA` → `#1D1E21`
- `basic_100`: `#EDEEF2` → `#313236`
- `basic_200`: `#E0E1E6` → `#44464E`
- `basic_300`: `#C7C9CE` → `#686A72`
- `basic_400`: `#A4A8AE` → `#A4A8AE`
- `basic_500`: `#686A72` → `#C7C9CE`
- `basic_600`: `#44464E` → `#E0E1E6`
- `basic_700`: `#313236` → `#EDEEF2`
- `basic_800`: `#1D1E21` → `#F7F8FA`
- `basic_900`: `#131417` → `#FFFFFF`

출처: [Grayscale 원본](https://document.pleos.ai/assets/images/grayscale-f6be0c4273c5777035ffd84ea28013c9.png)

### Alpha

`basic_alpha_light_*`:

- Light raw `#FFFFFF`, Dark raw `#131417`.
- suffix와 opacity:
  - `_50`: **5%**
  - `_100`: **10%**
  - `_200`: **20%**
  - `_300`: **30%**
  - `_400`: **40%**
  - `_500`: **50%**

`basic_alpha_dark_*`:

- Light raw `#131417`, Dark raw `#FFFFFF`.
- suffix별 opacity는 위와 동일.

출처: [White Alpha](https://document.pleos.ai/assets/images/white-alpha-1a1359524cb98282c87149651de538d8.png) · [Gray Alpha](https://document.pleos.ai/assets/images/gray-alpha-0ce361ac45bdc95d66fc57411cf28ae6.png)

### Static

- `basic_static_light_100`: `#FFFFFF`
- `basic_static_light_200`: `#FFFFFF, 84%`
- `basic_static_light_300`: `#FFFFFF, 64%`
- `basic_static_light_400`: `#FFFFFF, 32%`
- `basic_static_dark_100`: `#131417`
- `basic_static_dark_200`: `#131417, 84%`
- `basic_static_dark_300`: `#131417, 64%`
- `basic_static_dark_400`: `#131417, 32%`

출처: [Static Light](https://document.pleos.ai/assets/images/light-0b540b02ca3f98e2cd94205da112ef67.png) · [Static Dark](https://document.pleos.ai/assets/images/dark-f44c562ac0ca05f9ccbda030142cf5e0.png)

## 10.3 System Color: 20개 표, 118행

**주의:** System 표는 `alpha_*`, `static_*`, Basic 표는 `basic_alpha_*`, `basic_static_*`를 사용합니다. 아래 참조 이름을 임의로 통일하지 않았습니다.

### Background

- `background_primary`: `basic_50` → `basic_50`
- `background_secondary`: `basic_00` → `basic_00`
- `background_popup`: `basic_00` → `basic_100`

출처: [Background](https://document.pleos.ai/assets/images/system-color-background-7bee5722e2912af73a71dd8267a463f0.png)

### Button

- `button_basic_enabled`: `alpha_dark_50` → `alpha_dark_50`
- `button_basic_pressed`: `alpha_dark_100` → `alpha_dark_100`
- `button_basic_disabled`: `alpha_light_200` → `alpha_light_200`
- `button_switch_enabled`: `basic_00` → `alpha_dark_200`
- `button_switch_pressed`: `alpha_light_500` → `alpha_dark_200`
- `button_switch_disabled`: `alpha_light_300` → `alpha_dark_300`
- `button_filled_enabled`: `basic_600` → `basic_600`
- `button_filled_pressed`: `basic_700` → `basic_500`
- `button_filled_disabled`: `alpha_dark_50` → `alpha_dark_50`

Switch 세 행의 과거 이름은 `button-basic-active-enabled/pressed/disabled`로 취소선 표시돼 있습니다.

출처: [Button](https://document.pleos.ai/assets/images/system-color-button-7fe4b0136b1e45f7264ce44b7297c896.png)

### Controller

- `controller_slider_normal`: `alpha_dark_200` → `alpha_dark_100`
- `controller_slider_pressed`: `alpha_dark_300` → `alpha_dark_200`
- `controller_slider_knob`: `basic_00` → `alpha_dark_300`
- `controller_tab_background`: `alpha_dark_50` → `alpha_dark_50`
- `controller_stepper_background`: `basic_00` → `alpha_light_100`

출처: [Controller](https://document.pleos.ai/assets/images/system-color-controller-35efcfe0a72a4e0023b8c9240dc8e35c.png)

### Climate

- `button_enabled`: `basic_200` → `basic_50`
- `button_selected`: `basic_00` → `basic_200`
- `button_border_enabled`: `alpha_dark_200` → `alpha_dark_100`
- `button_border_disabled`: `alpha_dark_50` → `alpha_dark_50`
- `toggle_selected`: `alpha_dark_100` → `alpha_light_300`
- `toggle_pressed`: `alpha_dark_200` → `alpha_light_400`
- `slider_background`: `basic_00` → `basic_100`
- `airvent_button_opened`: `basic_00` → `basic_600`
- `airvent_button_closed`: `alpha_light_400` → `alpha_dark_200`
- `airvent_symbol_opened`: `static_dark_200` → `static_dark_200`
- `airvent_symbol_closed`: `static_dark_400` → `static_dark_300`
- `airvent_opened`: `static_light_300` → `static_light_400`
- `airvent_closed`: `alpha_light_200` → `alpha_dark100`

마지막 `alpha_dark100`의 밑줄 누락은 원문 그대로입니다.

출처: [Climate](https://document.pleos.ai/assets/images/system-color-climate-3cfaf745bdffaed6b7ec6eb5c1316450.png)

### Dropdown

- `dropdown_normal`: `basic_00` → `basic_alpha_dark100`
- `dropdown_pressed`: `basic_100` → `basic_alpha_dark300`

출처: [Dropdown](https://document.pleos.ai/assets/images/system-color-dropdown-620bef747dd4576c638f685729b6a118.png)

### Dim

- `dim_dark_primary`: `alpha_dark_50` → `alpha_dark_50`
- `dim_dark_secondary`: `alpha_dark_100` → `alpha_dark_100`
- `dim_dark_tertiary`: `alpha_dark_200` → `alpha_dark_200`
- `dim_light_primary`: `alpha_light_500` → `alpha_light_500`
- `dim_light_secondary`: `alpha_light_400` → `alpha_light_400`
- `dim_light_tertiary`: `alpha_light_300` → `alpha_light_300`

출처: [Dim](https://document.pleos.ai/assets/images/system-color-dim-a3ad1a1be06b6c8ceac154f03d3979b9.png)

### Driving

- `gearshift_background`: `basic_900` → `basic_100`
- `charging_normal`: `#00DB25` → `#00DB25`
- `charging_deep`: `#00B975` → `#0082FC`
- `gradient_end`: `basic_00` → `basic_00`
- `gradient_start`: `FFFFFF, 0%` → `131417, 0%`

`charging_deep`의 Dark 파랑 값과 `gradient_start`의 `#` 없는 표기는 원문 그대로입니다.

출처: [Driving](https://document.pleos.ai/assets/images/system-color-driving-aadbdd18cf6fe678339d3a733572d685.png)

### Fields

- `field_background`: `basic_00` → `basic_00`
- `field_focused`: `basic_700` → `basic_700`

출처: [Fields](https://document.pleos.ai/assets/images/system-color-fields-31d4597576ec64442fe48e232078b8b8.png)

### Gleo AI

- `gleo_surface_primary`: `basic_00` → `basic_200`
- `gleo_surface_secondary`: `alpha_dark_50` → `alpha_light_200`
- `gleo_bubble_primary`: `#9BA8E2` → `#545F93`
- `gleo_bubble_secondary`: `#8896D3` → `#3E4976`
- `gleo_bubble_tertiary`: `basic_00` → `basic_100`
- `gleo_bubble_speaker`: `#3F4B81` → `#B6C1F3`

과거 `ambient_ai_*` 이름은 취소선 처리돼 있습니다.

출처: [Gleo AI](https://document.pleos.ai/assets/images/system-color-gleo-ai-47aaf3b0e321a56c557c6a98088a165c.png)

### Icon

원본의 앞 4행:

- `icon_dark_primary`: `static_dark_100` → `static_light_100`
- `icon_dark_secondary`: `static_dark_200` → `static_light_200`
- `icon_dark_tertiary`: `static_dark_300` → `static_light_300`
- `icon_dark_quaternary`: `static_dark_400` → `static_light_400`

원본의 뒤 4행은 **동일 이름 중복**:

- `icon_dark_primary`: `static_light_100` → `static_dark_100`
- `icon_dark_secondary`: `static_light_200` → `static_dark_200`
- `icon_dark_tertiary`: `static_light_300` → `static_dark_300`
- `icon_dark_quaternary`: `static_light_400` → `static_dark_400`

출처: [Icon](https://document.pleos.ai/assets/images/system-color-icon-e9b6e7d15a6a5927758f457e39c68eda.png)

### Informative

- `informative_active`: `#02C265` → `#00E074`
- `informative_positive`: `#0064FF` → `#0082FF`
- `informative_negative`: `#FE3D16` → `#FF4C28`
- `informative_autonomous_driving`: `#5A46FA` → `#6A57FF`

출처: [Informative](https://document.pleos.ai/assets/images/system-color-informative-ef19e6a5596f00f102603ca3413577e3.png)

### Keyboard Normal

- `keyboard_normal_primary_normal`: `basic_00` → `basic_300`
- `keyboard_normal_primary_pressed`: `basic_100` → `basic_200`
- `keyboard_normal_secondary_normal`: `basic_300` → `basic_200`
- `keyboard_normal_secondary_pressed`: `basic_400` → `basic_200`
- `keyboard_normal_active_normal`: `basic_600` → `basic_300`
- `keyboard_normal_active_pressed`: `basic_700` → `basic_200`
- `keyboard_normal_accents_normal`: `basic_600` → `basic_500`
- `keyboard_normal_accents_pressed`: `basic_700` → `basic_400`
- `keyboard_normal_background`: `basic_200` → `basic_100`

출처: [Keyboard Normal](https://document.pleos.ai/assets/images/system-color-keyboard1-24ccff8da02ecbeef3797527d39a50e8.png)

### Keyboard Static

- `keyboard_static_primary_normal`: `basic_500` → `basic_300`
- `keyboard_static_primary_pressed`: `basic_600` → `basic_200`
- `keyboard_static_secondary_normal`: `basic_600` → `basic_200`
- `keyboard_static_secondary_pressed`: `basic_500` → `basic_200`
- `keyboard_static_active_normal`: `basic_500` → `basic_300`
- `keyboard_static_active_pressed`: `basic_700` → `basic_200`
- `keyboard_static_accents_normal`: `basic_300` → `basic_500`
- `keyboard_static_accents_pressed`: `basic_400` → `basic_400`
- `keyboard_static_background`: `basic_900` → `basic_100`
- `keyboard_static_icon_light`: `basic_00` → `basic_400`
- `keyboard_static_icon_dark`: `basic_900` → `basic_400`
- `keyboard_static_icon_disabled`: `alpha_light_100` → `alpha_dark_100`
- `keyboard_static_text`: `basic_700` → `basic_400`

출처: [Keyboard Static](https://document.pleos.ai/assets/images/system-color-keyboard2-cf104d403970ba502279fee50a4165a5.png)

### Media

- `radio_primary`: `#C911E7FF` → `#C911E7FF`
- `music_primary`: `#4781FFFF` → `#4781FFFF`
- `radio_gradient_start`: `#00FFFFFF` → `#001D1E21`
- `radio_gradient_end`: `#FFFFFFFF` → `#FF1D1E21`

8자리 HEX를 임의로 ARGB/RGBA로 재해석하지 않았습니다.

출처: [Media](https://document.pleos.ai/assets/images/system-color-media-30d93aa4acfffa1ed3a5400e41308ea8.png)

### Overlay

- `overlay_default`: `alpha_dark_200` → `alpha_light_500`

출처: [Overlay](https://document.pleos.ai/assets/images/system-color-overlay-493e63cdf04dd8383fd8cf80a0356ab4.png)

### Phone

- `phone_call_normal`: `#32B957` → `#3BD665`
- `phone_call_pressed`: `#279E47` → `#2DB752`
- `phone_end_normal`: `#FE3D16` → `#FF4C28`
- `phone_end_pressed`: `#E73612` → `#DF4323`

출처: [Phone](https://document.pleos.ai/assets/images/system-color-phone-6b626a71744074d5178034b411925c7c.png)

### Regulation

- `regulation_blue`: `#0064FF` → `#0082FF`
- `regulation_green`: `#00BA13` → `#55F165`
- `regulation_yellow`: `#FFC224` → `#FFC224`
- `regulation_orange`: `#FF8A00` → `#FF8A00`
- `regulation_red`: `#F62E24` → `#FF4339`
- `regulation_bluetooth`: `#0082FC` → `#0082FC`

출처: [Regulation](https://document.pleos.ai/assets/images/system-color-regulation-0d00f934044ffc500b2dfabaa1e51fc7.png)

### Surface

- `surface_basic`: `basic_00` → `basic_50`
- `surface_low`: `basic_50` → `basic_00`
- `surface_high`: `basic_100` → `basic_100`
- `surface_accent`: `basic_200` → `basic_200`

출처: [Surface](https://document.pleos.ai/assets/images/system-color-surface-d06b9b9d696cedf82963437c12832af3.png)

### Switch

- `switch_on`: `informative_active` → `informative_active`
- `switch_off`: `alpha_dark_300` → `alpha_dark_100`
- `switch_disabled`: `alpha_dark_100` → `alpha_dark_100`
- `switch_knob_on`: `basic_00` → `basic_900`
- `switch_knob_off`: `basic_00` → `basic_400`
- `switch_knob_disabled`: `basic_00` → `alpha_dark_200`

출처: [Switch](https://document.pleos.ai/assets/images/system-color-switch-33bed2234a2b0da3b2467160e60d09c6.png)

### Text

원본의 앞 4행:

- `text_dark_primary`: `static_dark_100` → `static_light_100`
- `text_dark_secondary`: `static_dark_200` → `static_light_200`
- `text_dark_tertiary`: `static_dark_300` → `static_light_300`
- `text_dark_quaternary`: `static_dark_400` → `static_light_400`

뒤 4행은 **동일 이름 중복**:

- `text_dark_primary`: `static_light_100` → `static_dark_100`
- `text_dark_secondary`: `static_light_200` → `static_dark_200`
- `text_dark_tertiary`: `static_light_300` → `static_dark_300`
- `text_dark_quaternary`: `static_light_400` → `static_dark_400`

출처: [Text](https://document.pleos.ai/assets/images/system-color-text-e7366a153c7953a16d9d7939a9ce2b25.png)

---

# 11. 릴리스와 반드시 구분할 문서 차이

## 11.1 2026-10-19 릴리스

- Emulator **2.1.0**.
- Vehicle **2.3.2**.
- NaviHelper **3.0.5**.
- TextToSpeech **3.3.1**.
- SpeechToText **3.3.1**.
- FusedLocation **1.1.3**.

Emulator에서 종료된 기능:

- **LLM SDK 제공 종료**.
- **CRN 제공 종료**.
- **Bluetooth 동글 연동 종료**.

Gleo 연동은 Gleo Interface를 사용하도록 안내합니다.

출처: [Emulator 릴리스](https://document.pleos.ai/docs/pleos-only/release-note/emulator-release-note) · [SDK 릴리스](https://document.pleos.ai/docs/pleos-only/release-note/sdk-release-note)

## 11.2 주요 마이그레이션

### Vehicle

- CruiseControl의 `OFF`, `READY`, `ACTIVE` 제거.
- 새 상태:
  - `OTHER`, `ENABLED`, `ACTIVATED`, `USER_OVERRIDE`, `SUSPENDED`, `FORCED_DEACTIVATION_WARNING`.
- Fan speed Capability:
  - `Map<SeatArea, List<Int>>`
  - → `Map<SeatArea, AreaBounds<Int>>`.
- FanDirectionType: 기존 3개에서 **8개**로 확장.
  - ordinal 저장 시 `FACE 0→1`, `FLOOR 1→2`, `DEFROST 2→4` 대응.
- Area 객체에 내용 기반 equals/hashCode.
- `getCRNInfo` → `getVINInfo` 전환 권장.
- `checkWheelAreaCapabilities` → `checkLowTirePressureCapabilities` 권장.
- `getHvacTemperatureValueSuggestion` 삭제.
- `VehicleSpeedListener`·`onSpeedUpdated` 삭제.

### NaviHelper

- `RouteDriving` → `NavigationStatus`.
- 모델 좌표 인자 순서:
  - `longitude, latitude`
  - → `latitude, longitude`.
- `totalDistance/totalTime`
  - → `remainDistance/remainTime`.
- `onRouteEnded` → `onRoutingCompleted` 권장.
- 구간단속 카메라 enum 세분화.

### TTS·STT

- 오류 콜백 `String` → `ErrorType`.
- 초기화 결과 listener·version 속성 추가.
- STT `InferenceSource`: `ON_DEVICE`, `SERVER`.

### FusedLocation

- `onChanged(LocationData)` → `onChanged(LocationData?)`.
- `onError(Exception)` 필수 구현.
- Last known·지원 확인·차단 안내·Proximity API 추가.

출처: [SDK 릴리스 노트](https://document.pleos.ai/docs/pleos-only/release-note/sdk-release-note)

## 11.3 최종적으로 남는 불일치·미명시 항목

개발 시 특히 다음을 혼동하면 안 됩니다.

1. **SDK 버전**
   - Getting Started: Vehicle **2.3.1**.
   - 세부 가이드·릴리스: **2.3.2**.
2. **Vehicle Service**
   - SDK 소개: **2.3.21** 기준.
   - 최신 Sample: **2.3.22** 기준.
3. **minSdk**
   - Sample: **23**.
   - 제품 앱 필수: **28 이상**.
4. **디자인 해상도 표**
   - 표 머리글이 **dp**.
   - 마켓 스크린샷은 **px**.
   - 둘을 그대로 같은 값으로 취급하면 안 됨.
5. **WF 크기**
   - 디자인 표 **18.5″**.
   - 테스트 preset **18.7″**.
6. **12.9″ 시험 예**
   - 디자인 표와 폼팩터 도해가 다른 크기를 표시.
7. **마켓 스크린샷**
   - 제출 표 `840 x 121 px`.
   - 심사 상세 `840 xX 1212 px`.
8. **최소 터치 크기**
   - 공통 최소 dp 수치 미확인.
   - `48 x 48dp`는 아이콘 그리드.
9. **단위 미기재**
   - Typography 계층 Size/Line height.
   - Toast의 24·792·712.
   - Shadow의 X·Y·Blur·Spread.
10. **오디오 CAN_DUCK**
    - 일반 가이드는 duck.
    - Music 샘플은 pause.
11. **Gleo Intent**
    - 설명은 개별 extra.
    - 예제는 `"ACTION_PARAM"` JSON.
12. **API 공개와 사용 승인**
    - Fused/TTS/STT/Vehicle Control의 문서·artifact 존재와 프로젝트 신청 상태가 다름.
13. **Proximity 운영 제한**
    - 반경 양수·위경도 범위 외 시간·개수·background 보장 미명시.
14. **업데이트**
    - UI 소개는 OTA 고려를 언급하지만, 실제 App Market 정책은 **자동 업데이트 미지원**.

현재 Playground 주소는 2026-10-29 **v2.7.0**에서 `developers.pleos.ai`로 변경됐다고 안내합니다.

출처: [Playground 릴리스](https://document.pleos.ai/docs/pleos-only/release-note/playground-release-note) 및 각 항목의 앞선 원문 링크.
