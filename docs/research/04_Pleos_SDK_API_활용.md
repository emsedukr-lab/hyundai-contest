# 04 Pleos SDK·API 활용 (M57, 2026-11-12)

Pleos 문서 세 곳을 다시 읽고, 값 하나만 쓰던 곳을 **두세 값을 함께 쓰는 기능**으로 넓힌 기록입니다. 무엇을 써서 무엇을 만들었는지, 에뮬레이터에서 무엇을 확인했는지, 무엇을 쓰지 않았는지와 그 이유를 적습니다.

- Vehicle SDK 2.3.2: <https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/intro>
- NaviHelper SDK 3.0.5: <https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/intro>
- Fleet API: <https://document.pleos.ai/api-reference/fleet-api/intro>

## 1. 조사 방법

- 문서 사이트맵에서 Vehicle 1,178쪽·NaviHelper 497쪽·Fleet API 22쪽을 받아 읽었습니다(2026-11-12).
- Vehicle·NaviHelper의 API Reference 개별 쪽은 본문이 비어 있어(제목만 있음), **함수 시그니처와 `@RequiresPermission`은 SDK AAR의 바이트코드에서 직접** 확인했습니다(`Vehicle-2.3.2`, `NaviHelper-3.0.5`, `navi-data-3.0.4`).
- 값의 단위·의미는 문서에 없는 것이 많아 **Pleos Connect Emulator 2.1.0**(Vehicle Service 2.3.22)에서 debug 빌드의 `NaviProbe`와 `PleosVehicleReader` 로그로 실측했습니다. 실측하지 못한 값은 쓰지 않았습니다.

## 2. 무엇으로 무엇을 만들었나

| 만든 것 | 함께 쓴 값 | 결과 |
|---|---|---|
| **출발 전 점검** (`DepartureCheck`) | Odometer 주행가능거리 × 오늘 남은 일정 거리(계획) · Seat 착좌 × 안전벨트 · Door 문/트렁크 위치 · EvBattery 충전 포트 · Safety 출력 제한 경고·워셔액·엔진오일·브레이크액 | 주차 중 오늘 날짜에만 카드 하나: '출발 준비됐어요' 또는 '확인 n가지'(예: "탑승 4명 중 1명이 안전벨트를 매지 않았어요", "주행가능 170km · 오늘 남은 일정에는 모자랄 수 있어요") |
| **일정 끝 배터리 예상** (`EnergyOutlook` → `EnergyPolicy`) | EvBattery SOC + Odometer 주행가능거리 + NaviHelper `requestTrip`의 도착 시 배터리·도로 거리 + 계획의 남은 거리 + DrivingMode | "오늘 일정을 마치면 배터리 약 17% 예상". 지금 잔량은 넉넉해도 하루 끝이 20% 이하면 미리 급속 충전을 권하고, SPORT 모드면 ECO를 안내. 내연기관차는 연료 %가 넉넉해도 주행가능거리가 남은 일정에 모자라면 주유 권장 |
| **쉬어 가기 권고** (`RestAdvisor`·`DriveSessions`·`RestAreas`) | 주행 상태(CarUxRestrictions) + Gear P + Odometer 누적 주행거리 → 연속 운전 시간·거리 · NaviHelper 다음 장소까지 남은 시간 · NaviHelper 턴 목록의 휴게소 · 시간 지킴이의 여유 분 | 2시간 넘게 쉬지 않고 운전하면 "2시간 10분째 운전 중이에요 · 휴게소 31.9km 앞 · 15분 쉬어도 일정에 맞아요". 도착이 20분 안이면 "도착해서 쉬세요". 주차하면 [휴게소 찾기](내비 검색) |
| **'오늘 경로 전송' 따라가기** (`TodayRoute`) | NaviHelper `requestRouteWithWaypoints` + `getWaypointInfo`(반영 확인) + `onWayPointArrived`(경유지 도착) + `onDrivingInfo.waypoints`·`getWaypointInfo`(경유지별 남은 시간·거리) | 경로를 한 번에 보낸 뒤에도 장소마다 도착이 자동 표시되고, 시간 지킴이가 최종 목적지가 아니라 **다음 장소** 기준으로 "도착 예정 11:17 · 13:00 예약까지 3분 · 빠듯해요"를 계산. 내비에 경유지가 덜 들어가면 "3곳 중 2곳만 올라갔어요"라고 알림 |
| **가는 길 정보** | NaviHelper `getRouteStateInfo().trafficStatus`(정체 길이·사고 건수) + `onRouteStarted.tollFare` | "가는 길 정체 2.6km", "통행료 9,170원 (내비 예상)"(경유지 없는 경로에서만) |
| **빠듯하면 빠른 길** | 시간 지킴이 판정(빠듯·늦음) → NaviHelper `RouteInfo.routeOption = SHORT_TIME` | 다음 고정 일정이 빠듯할 때 [다음 목적지 안내]는 최단 시간 경로로 요청하고 그렇게 했다고 알림 |
| **Fleet 출고 전 준비 점검** (서버, 꺼져 있음) | Fleet 웹훅의 SOC·주행가능거리(DTE)·타이어 공기압 경고·경고등 12종·충전 플러그·문·트렁크 × 여행 거리 | 렌터카·카셰어링 운영사가 받은 차량 상태로 `READY`/`CAUTION`/`STOP`과 항목 목록을 돌려줌(차량의 출발 전 점검과 같은 항목 이름) |

화면: `docs/evidence/m57/01`~`06`.

## 3. API별 사용 목록

### NaviHelper 3.0.5

| 권한 | 전부터 쓰던 것 | M57에서 더한 것 |
|---|---|---|
| `NAVI_ROUTE` | `getDestinationInfo`, `getCurrentLocationInfo`, `getBookmarkInfo`, `requestTrip`, `onRouteStarted`, `onDrivingInfo`, `onNavigationStatus`, `onDestinationArrived`, `onRoutingCompleted`, `onRouteCancelled`, `onDestinationChanged`, `onError` | `getRouteStateInfo`(정체·사고), `getTBTInfo`(휴게소), `getWaypointInfo`(경유지 반영·남은 시간), `onWayPointArrived`, `onWayPointInfo`, `onRouteStateInfo`, `onTBTInfo`, `onDrivingInfo.waypoints`, `RouteStartInfo.tollFare` |
| `NAVI_ROUTE_SEARCH` | `requestRoute`, `requestRouteWithWaypoints` | `RouteInfo.routeOption`(`SHORT_TIME`) |
| `NAVI_CUSTOM_MAP` | `requestNavigationScreen`: `SearchPlace`, `AddHomeFavorite`, `NearbyChargingStations` | `SearchPlace("휴게소")` |

### Vehicle SDK 2.3.2 — 모두 조회, `CONTROL_CAR_*` 없음

| 권한 | API | 쓰는 곳 |
|---|---|---|
| `CAR_ENERGY` (기존) | `EvBattery.getEvBatteryStateOfCharge`, `Fuel.getFuelPercent`, capability 2종 | 충전·주유 권장, 배터리 예상 |
| `CAR_ENERGY` | `EvBattery.isEvChargePortOpen` (**신규**) | 출발 전 점검 |
| `CAR_DRIVE` (기존) | `Odometer.getRangeRemainingDistance` | 충전·주유 권장, 출발 전 점검 |
| `CAR_DRIVE` | `Odometer.getCurrentDistanceDriven`, `Gear.getCurrentGearSelectionState`, `DrivingMode.getCurrentDrivingModeState` (**신규**) | 연속 운전 거리, 주차 판정, ECO 안내 |
| `CAR_SAFETY` (**신규 권한**) | `Safety.hasPowerDownWarningIndicator`, `hasLowWasherFluidWarning`, `getEngineOilLevelState`, `getBrakeFluidLevelState` | 출발 전 점검 |
| `CAR_DOORS` (**신규 권한**) | `Door.checkDoorPositionCapabilities`, `getCurrentDoorPosition` | 출발 전 점검(문·트렁크) |
| `CAR_SEATS` (**신규 권한**) | `Seat.checkSeatOccupancyCapabilities`, `getCurrentSeatOccupancy`, `getCurrentSeatBeltBuckledState` | 출발 전 점검(탑승·벨트) |

- 모든 조회는 `PleosVehicleReader` 한 곳에서 합니다. 지원 여부는 `checkXxxCapabilities`로 한 번 묻고 기억하며, 미지원·권한 없음·무응답은 모두 "모름"으로 두고 통과로도 문제로도 세지 않습니다.
- 읽은 값은 메모리의 최신값만 쓰고 저장하지 않습니다(주차 중 20초, 주행 중 60초 간격, 화면이 보일 때만).

### Fleet API

- 문서가 정한 웹훅(주기 데이터·차량 이벤트)의 payload를 받는 `POST /api/v1/fleet/webhook`과, 받은 상태로 준비 여부를 돌려주는 `GET /api/v1/fleet/vehicles/{vehicleId}/readiness?km=…`을 서버에 넣었습니다(`packages/shared/src/fleet.ts`, `packages/worker/src/fleet.ts`).
- 응답 본문은 문서의 'Webhook callback response' 형식(200 `status: completed`, 400 `errors[]`의 `ERR_MISSING_FIELD`/`ERR_INVALID_VALUE`, 503 `retry_after`)을 따릅니다.
- **운영에서는 꺼져 있습니다**(`FLEET_WEBHOOK_TOKEN`이 없으면 두 경로 모두 404). Fleet API는 Pleos Fleet 사용 계약과 승인 뒤에야 엔드포인트가 제공되어 실제 호출을 해 볼 수 없었고, 문서의 예시 payload 4개로만 시험했습니다(`npx tsx tools/fleet-webhook-sample.mts`).
- 보관하는 것은 문서에 있는 차량 상태 40개 항목의 최신값뿐이고 **VIN·위도·경도는 저장하지 않습니다**. 마지막 수신 24시간 뒤 지웁니다.

## 4. 에뮬레이터에서 확인한 것

| 항목 | 관찰 | 반영 |
|---|---|---|
| Vehicle 조회 | Vehicle Service 2.3.22가 실제 값을 돌려줌: 문 0곳 열림, 트렁크 닫힘, 충전 포트 닫힘, 탑승 4명·벨트 미착용 4명, 기어 P, 누적 주행거리 0.0, EV 100%·500km. 워셔액·오일·브레이크액·주행 모드는 capability가 미지원 | 출발 전 점검 카드에 그대로 표시(`m57/01`). 미지원 항목은 빠짐 |
| `Safety.getTelltalesInfo` | SDK 어노테이션은 `CAR_SAFETY`인데, 권한이 허용돼 있어도 **"getTelltalesInfo need Permission"**으로 거절 | 경고등은 쓰지 않음(§5) |
| `RouteStartInfo.tollFare` | 9,170 / 6,860 → 원. 경유지가 있으면 같은 콜백의 시간·거리처럼 첫 구간 값으로 보임 | 경유지 없는 경로에서만 표시 |
| `DrivingInfo.waypoints[]`, `WaypointInfo` | `8220s/198000m, 8460s/201000m` → 현재 위치에서 각 경유지까지 남은 초·미터. 둘이 같은 값 | 다음 장소의 도착 예정·남은 거리 |
| 경유지 값의 차이 = 구간 값 (2026-11-13) | 경유지 3·5·9곳이 순서 그대로 실리고(SDK 이름은 FIRST·SECOND뿐), 이웃한 누적값의 차이로 '집 대역 → 숙소 209분·223km'(카카오 201분·220km), 시내 구간 3·7·13·7·9분을 얻음. 요청마다 실제 안내가 시작되고(9~11초) 한 번에 하나, 값은 분·km 단위 | 기록만(`docs/evidence/navi-waypoints`). 앱은 아직 경유지 2곳 + 목적지만 보냄 |
| `TrafficCongestionSummary` | `totalCongestionDist=6800.0`(273km 경로) → 미터. `totalCongestionTime=240`은 구간 시간의 합도 평균 속도 환산값도 아니라 의미를 확정하지 못함 | 길이만 표시, 시간은 쓰지 않음 |
| `TBTInfo.distance` | 51개 합 266,590 ≈ 경로 273,000m → 직전 턴부터의 구간 거리. `TURN_ENTER_SERVICEAREA`·`TURN_RESTAREA`가 목록에 있음 | 휴게소까지 = 누적 합. 목록 합이 남은 거리와 15% 넘게 다르면 거리를 표시하지 않음 |
| 정차 중 푸시 | `onDrivingInfo`는 정차 중·앱 재시작 직후 오지 않음 | 30초마다, 그리고 이미 안내 중인 경로를 처음 볼 때 `getWaypointInfo`·`getRouteStateInfo`·`getTBTInfo`로 다시 물음 |
| Virtual Console | 상태 읽기는 되지만 `bridge_ready:false`·`emulator_active:false`라 값 주입 불가 | 문 열림·충전 포트·주행 모드 등은 debug 전용 예시 값으로 화면만 확인(`m57/02`), 실차 확인 필요 |

## 5. 쓰지 않은 것과 이유

| API | 이유 |
|---|---|
| `Safety.getTelltalesInfo`·`registerTelltales`·`checkTelltalesCapabilities`, `Tire.getTirePressure` | 비공개 권한(`PRIVATE_CAR_SAFETY`)이 있어야 동작. 문서는 "퍼미션은 사전 협의·승인된 범위 내에서만" 쓰라고 하므로 선언도 호출도 하지 않음. 그래서 차량 앱에는 타이어 공기압·경고등 항목이 없음(Fleet 웹훅에는 있어 서버 쪽 점검에만 있음) |
| `Tire.getLowTirePressure` | 현재 공기압이 아니라 위험 저압 **임계값**(kPa)이라 상태 판단에 쓸 수 없음 |
| `CONTROL_CAR_*` (문·창문·공조·좌석 제어) | 여행 일정 앱이 차를 움직일 이유가 없고, 조회만으로 충분 |
| Wiper·Light·HVAC·Window·Toll·SteeringWheel·SideMirror | 일정과 결합해 근거 있는 결과를 낼 방법을 찾지 못함(예: 와이퍼=비 → 야외 일정 미루기는 장소 종류에 실내·야외 구분이 없어 추측이 됨) |
| `Odometer.getTripCurrentDrivingTime` 등 트립 시간 | 단위가 문서에 없고 실측도 못 함 → 연속 운전 시간은 주행 상태 전환으로 직접 잼 |
| NaviHelper `onCameraAlert`·`onCautionPointInfo`·`onCurrentRoadSpeedLimit` | 내비가 직접 안내하는 정보라 중복 |
| NaviHelper `cancelRoute`·`addWaypoint`·`removeWaypoint`·`requestReRoute`·`changeRouteOption` | 안내 중인 경로를 앱이 바꾸는 동작. 지금은 사용자가 주차 중에 누른 요청만 내비로 보냄 |
| `RouteStateInfo.remainDestinationChargingInt` 등 | 퍼센트가 아니라 Wh로 보임(`docs/evidence/m9`). 퍼센트는 `requestTrip`의 값을 씀 |
| Fleet REST API(차량·단말 등록·조회) | 계약 뒤에만 엔드포인트가 나오고, 응답 스키마가 문서 본문에 없음 |
| Fleet 웹훅의 위도·경도·VIN | 준비 점검에 필요 없는 위치·식별 정보 |

## 6. 남은 확인 (실차·계약 필요)

- 실차에서 문 열림·충전 포트·워셔액·오일·브레이크액·주행 모드 값과 `onWayPointArrived` 이벤트.
- 실차에서 주행 중 턴 목록이 현재 위치 기준으로 갱신되는지(아니면 휴게소 거리는 자동으로 숨겨짐).
- 새 권한 `CAR_SAFETY`·`CAR_DOORS`·`CAR_SEATS`는 앱 심사에서 승인 대상입니다(모두 조회 전용).
- Fleet: Pleos Fleet 계약·승인 → 토큰 설정 → 실제 웹훅 수신. 요청 제한(IP당 120회/분)은 차량 수에 맞춰 조정해야 합니다.
