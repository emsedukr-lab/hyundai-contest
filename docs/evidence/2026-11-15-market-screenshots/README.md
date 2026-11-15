# 떠날지도 마켓 스크린샷 · 2026-11-15

차량 앱 0.9.1과 모바일 Android 앱 0.3.2의 실제 릴리즈 화면을 각각 20장씩 캡처했습니다. UI 합성·화면 늘리기·문구 덧씌우기를 하지 않은 PNG 원본입니다. 에뮬레이터의 실제 화면 크기를 맞춰 캡처했습니다.

| 구분 | 폴더 | 장수 | 해상도 |
|---|---|---:|---|
| 차량용 · Pleos Connect | `car/` | 20 | 2560 × 1380 px |
| 모바일용 · Android | `mobile/` | 20 | 1080 × 1920 px |

`index.html`을 열면 전체 이미지를 한 번에 보고 원본을 클릭해 열 수 있습니다. `preview-car.png`, `preview-mobile.png`는 검토용 모음 이미지이며 등록용 개별 원본은 각 폴더에 있습니다. `manifest.json`과 `SHA256SUMS.txt`에 화면 설명·버전·크기·체크섬을 기록했습니다.

## 공통 예시 여행

- 원본: https://naver.me/xLNVH41z
- 여행명: 강릉 3박 4일
- 기간: **2026-12-10(목) ~ 2026-12-13(일)**
- 저장목록 14곳을 가져와, 숙소 3곳을 제외한 11곳을 방문 일정에 배정했습니다. 장소 이름은 네이버의 원래 상호명이며 사용자 별명을 우선하지 않습니다.
- 1박 (12/10): **연곡해변솔향기캠핑장**
- 2박 (12/11): **강릉오죽한옥마을**
- 3박 (12/12): **강릉 바다내음 캠핑장**
- 출발지는 출발 당일 현재 위치, 첫날 출발은 09:00, 마지막 도착지는 집입니다. 집 주소·개인 GPS·예약번호는 넣지 않았습니다. 예약을 실제로 한 것처럼 임의로 설정하지 않았고, 확인하지 않은 영업시간은 미확인 상태입니다.
- 휴대폰의 장소 간 이동시간은 서비스의 카카오 길찾기로 계산했습니다. 차량에서는 현대차 내비 기준으로 다시 계산하며, 출발지·집 등 좌표가 없는 구간은 차량에서 처리합니다.
- `example-trip-backup.json`은 설정 → 여행 파일 불러오기로 재사용할 수 있는 예시 백업입니다. 촬영용 여행은 휴대폰 기본 프로필에도 저장했고, 같은 여행을 실제 암호화 전송 흐름으로 차량에 갱신해 넣었습니다. 촬영용 모바일 프로필에는 이 예시만 넣어 기존 데이터나 날짜 겹침이 화면에 섞이지 않게 했습니다.
- QR·인증번호 화면은 실제 연결 과정의 캡처입니다. 연결은 소비 또는 취소되었으므로 이미지 속 QR은 재사용할 수 없습니다.

## 우선 검토할 화면

- 차량용: 05~08(일차별 일정과 숙소), 13(야간), 01(QR 연결), 03(받은 여행 확인), 12(여행 관리)
- 모바일용: 01(여행 홈), 02(전체 일정), 04·06(일차별 일정), 08(장소 상세), 10(여행 만들기), 12(네이버 저장목록), 20(전송 전 확인)

## 파일 목록

### 차량용

| 번호 | 화면 | 파일 |
|---|---|---|
| 01 | 휴대폰 일정 불러오기 · 일회용 QR | [car/01_qr-connect.png](car/01_qr-connect.png) |
| 02 | 휴대폰과 동일한 인증번호 확인 | [car/02_pair-code.png](car/02_pair-code.png) |
| 03 | 네이버 목록 예시 여행 갱신 확인 | [car/03_review-import.png](car/03_review-import.png) |
| 04 | 12월 10~13일 예시 여행 갱신 완료 | [car/04_import-complete.png](car/04_import-complete.png) |
| 05 | 주간 · 12월 10일 일정과 다음 목적지 | [car/05_day1-overview.png](car/05_day1-overview.png) |
| 06 | 주간 · 12월 11일 일정과 다음 목적지 | [car/06_day2-overview.png](car/06_day2-overview.png) |
| 07 | 주간 · 12월 12일 일정과 다음 목적지 | [car/07_day3-overview.png](car/07_day3-overview.png) |
| 08 | 주간 · 12월 13일 일정과 다음 목적지 | [car/08_day4-overview.png](car/08_day4-overview.png) |
| 09 | 내비 기준 이동시간 측정 전 확인 | [car/09_navigation-measure.png](car/09_navigation-measure.png) |
| 10 | 장소 건너뛰기와 되돌리기 | [car/10_skip-and-undo.png](car/10_skip-and-undo.png) |
| 11 | 주간 · 차량 앱 설정 | [car/11_settings.png](car/11_settings.png) |
| 12 | 주간 · 예시 여행 관리 메뉴 | [car/12_trip-management.png](car/12_trip-management.png) |
| 13 | 야간 · 12월 10일 일정과 다음 목적지 | [car/13_day1-night.png](car/13_day1-night.png) |
| 14 | 야간 · 12월 11일 일정과 다음 목적지 | [car/14_day2-night.png](car/14_day2-night.png) |
| 15 | 야간 · 12월 12일 일정과 다음 목적지 | [car/15_day3-night.png](car/15_day3-night.png) |
| 16 | 야간 · 12월 13일 일정과 다음 목적지 | [car/16_day4-night.png](car/16_day4-night.png) |
| 17 | 야간 · 내비 이동시간 측정 확인 | [car/17_navigation-measure-night.png](car/17_navigation-measure-night.png) |
| 18 | 야간 · 차량 앱 설정 | [car/18_settings-night.png](car/18_settings-night.png) |
| 19 | 야간 · 예시 여행 관리 메뉴 | [car/19_trip-management-night.png](car/19_trip-management-night.png) |
| 20 | 야간 · 휴대폰 일정 QR 불러오기 | [car/20_qr-connect-night.png](car/20_qr-connect-night.png) |

### 모바일용

| 번호 | 화면 | 파일 |
|---|---|---|
| 01 | 네이버 목록으로 만든 12월 10~13일 강릉 여행 | [mobile/01_home.png](mobile/01_home.png) |
| 02 | 12월 10~13일 전체 일정 | [mobile/02_timeline-all.png](mobile/02_timeline-all.png) |
| 03 | 12월 10일 · 1일차 일정 | [mobile/03_day1-timeline.png](mobile/03_day1-timeline.png) |
| 04 | 12월 11일 · 2일차 일정 | [mobile/04_day2-timeline.png](mobile/04_day2-timeline.png) |
| 05 | 12월 12일 · 3일차 일정 | [mobile/05_day3-timeline.png](mobile/05_day3-timeline.png) |
| 06 | 12월 13일 · 4일차 일정 | [mobile/06_day4-timeline.png](mobile/06_day4-timeline.png) |
| 07 | 예시 여행의 기간·출발지와 숙소 설정 | [mobile/07_trip-info.png](mobile/07_trip-info.png) |
| 08 | 장소의 체류 시간과 일정 변경 허용 설정 | [mobile/08_place-detail.png](mobile/08_place-detail.png) |
| 09 | 중요도·메모·영업시간 설정 | [mobile/09_place-info.png](mobile/09_place-info.png) |
| 10 | 12월 10~13일 · 3박 4일 새 여행 | [mobile/10_new-trip.png](mobile/10_new-trip.png) |
| 11 | 12월 여행 기간 선택 | [mobile/11_travel-dates.png](mobile/11_travel-dates.png) |
| 12 | 네이버 저장목록 14곳 전체·개별 선택 | [mobile/12_naver-saved-list.png](mobile/12_naver-saved-list.png) |
| 13 | 자주 쓰는 장소와 식사 시간 설정 | [mobile/13_settings.png](mobile/13_settings.png) |
| 14 | 새 여행에 적용할 출발·도착 기본값 | [mobile/14_trip-defaults.png](mobile/14_trip-defaults.png) |
| 15 | 첫날 출발 시간 선택 | [mobile/15_departure-time.png](mobile/15_departure-time.png) |
| 16 | 여행 추천에 사용할 점심 시간대 | [mobile/16_meal-times.png](mobile/16_meal-times.png) |
| 17 | 차량 연결 방법과 최근 전송한 일정 | [mobile/17_car-connection.png](mobile/17_car-connection.png) |
| 18 | 차량과 휴대폰의 인증번호 확인 | [mobile/18_pair-code.png](mobile/18_pair-code.png) |
| 19 | 12월 10~13일 강릉 여행 선택 | [mobile/19_select-trip.png](mobile/19_select-trip.png) |
| 20 | 12월 10~13일 일정 전송 확인 | [mobile/20_send-consent.png](mobile/20_send-consent.png) |

## 범위

마켓 콘솔에 실제 업로드하거나 게시하지는 않았습니다. 최종 등록 시 해당 마켓에서 허용하는 장수·검증 규격에 맞춰 이 후보 세트에서 선택하세요. 앱 소스 및 기존 APK 파일은 이번 캡처 작업으로 변경하지 않았습니다.
