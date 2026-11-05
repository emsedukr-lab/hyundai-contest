# M9 사전 확인: NaviHelper 3.0.5 미사용 기능 (2026-11-06)

시험 환경은 Pleos Connect Emulator 2.1.0(`-gpu host` cold boot, 위치 성남 수정구 시흥동)과 debug 빌드 `NaviProbe`다.
- NaviProbe는 `car/app/.../navi/NaviProbe.kt`에 있고 release에는 없다.
- 다음 명령으로 질의하고, logcat 태그 `TteonaljidoProbe`로 결과를 본다.

```sh
adb shell am start --user 10 -n io.tteonaljido.car/.MainActivity --es probe "trip:37.7955,128.8975"   # route:, location, state, destination, chargers, cancel
```

| # | 질문 | 관찰 | 결정 |
|---|---|---|---|
| S1 | `remainTime`·`remainDistance` 단위 | 경포호 안내 중 `remainTime=9900`, `remainDistance=198000`. 내비 화면은 "2시간 45분 · 198km · 도착 11:11"(`01-route-units.png`) | **초·미터**. 화면과 일치 |
| S2 | 정차 중에도 push 콜백이 오나 | 안내 시작 때 `onRouteStarted`·`onNavigationStatus(ROUTE_DRIVE)`·`onRouteStateInfo(ROUTE_GUIDING)`·`onDrivingInfo`가 왔다. 취소 때 `onRouteCancelled`·`FREE_DRIVE`가 왔다. 정차 중 주기적 `onDrivingInfo`는 없었다 | push를 쓰고, 안내 중·화면 표시 중에는 30초 간격 `getDestinationInfo`로 보완 |
| S3 | `requestTrip`의 부작용·출발점·값 | 경로 없음/경포호 안내 중 모두 화면·목적지가 바뀌지 않았다. 응답은 0.3초 안에 왔다. 경포호 `distance=198247`, `eta=9788`, `socAtDest=64`, `energy=27671.8`. 안내 중 다른 장소(강릉 시내)를 물어도 목적지는 경포호 그대로였다 | **현재 위치에서 출발하는 조회 전용**. eta는 소요 시간(초), SOC는 %, 에너지는 Wh로 보인다. 임의 A→B 구간은 못 구한다 → '여기서' 다음 구간만 채움 |
| S4 | 도착 이벤트를 에뮬레이터에서 낼 수 있나 | `adb emu geo fix`로 경포호까지 옮겨도 Android 위치만 바뀌었다. 내비 위치(`getCurrentLocationInfo`)는 성남 그대로였고 콜백은 없었다 | 내비는 자체 측위를 쓴다 → **에뮬레이터 전용 '도착 신호(시연)'** |
| S5 | 날짜 수동 변경 | 확인 생략(결정과 무관) | 앱 안 '시연 시각'(에뮬레이터 전용, 화면에 표시) |
| S6 | `NearbyChargingStations` 화면 | 내비가 '충전소 · 경로 주변' 목록을 연다(`02-nearby-chargers.png`) | '근처 충전소' 버튼 사용 |
| S7 | 우리 앱이 뒤에 있을 때 콜백 | 내비가 앞에 있는 동안에도 `onDrivingInfo`·`onNavigationStatus`가 우리 리스너로 왔다 | 앱 범위 추적기가 받는다. 복귀 시 재조회 유지 |

## 참고 값

- `onRouteStarted`와 `RouteStateInfo.remainDestinationChargingInt`의 `charge=49745`는 퍼센트가 아니다. SOC 64% × 약 77kWh와 비슷해 **도착 시 남은 에너지(Wh)**로 보인다. 화면에는 퍼센트만 쓰므로 퍼센트가 필요하면 같은 목적지로 `requestTrip`을 호출한다.
- `TripInfo.summary.routePoints`에는 목적지 한 점만 들어 있다.
- 시험 뒤 `cancel`로 경로를 지우고 Android 위치를 성남으로 되돌렸다.

## 구현 확인 화면 (debug 빌드, 로컬 서버, 시연 시각 11/21 09:00)

| 파일 | 내용 |
|---|---|
| `03-late-skip-suggestion.png` | 경포호 안내 중 내비 남은 시간 → "도착 예정 11:47 · 13:00 예약에 47분 늦을 수 있어요" + 선택 일정 건너뛰기 제안 |
| `04-skipped.png` | 건너뛴 뒤: 다음 목적지가 동화가든으로 바뀜, 건너뛴 구간은 앞뒤 구간 합으로 '대략' 표시, 내비가 다른 곳 안내 중 |
| `05-demo-arrival.png` | 도착 신호(시연) → 경포호 '방문함 09:01' + 되돌리기 |
| `06-start-here-navi-estimate.png` | 1일차 '여기서 출발' → 첫 구간 "이동 162분 (내비 예상)", 하루 시각이 계산됨 |
| `07-battery-at-arrival.png` | 같은 예상에서 "도착 시 배터리 63% (내비 예상)" |
| `08-driving-view.png` | 주행 중(시연 스위치): 다음 목적지·상태 한 줄만, 버튼·스크롤 없음 |
| `09-past-trip.png` | 시연 시각 11/25: 지난 여행 배너 + 삭제 |
