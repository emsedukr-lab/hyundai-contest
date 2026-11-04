import type { Leg, Place, Trip, Visit } from './tripTransfer';

/**
 * Demo trip: 강릉 3박 4일 (2026-11-20 ~ 23). Coordinates are approximate sample values for the demo only;
 * the car re-confirms every place through the Hyundai navigation before guiding.
 */
export const SAMPLE_TRIP_ID = '6f1c2d4e-8a3b-4c5d-9e7f-0a1b2c3d4e5f';

const place = (placeRef: string, name: string, address: string, lat: number, lon: number, category: Place['category']): Place => ({
  placeRef,
  name,
  address,
  latE7: Math.round(lat * 1e7),
  lonE7: Math.round(lon * 1e7),
  category,
  source: { provider: 'MANUAL', externalId: null },
  naviPoi: null,
  hours: { status: 'UNKNOWN' },
});

const visit = (visitId: string, placeRef: string, stayMinutes: number, extra: Partial<Visit> = {}): Visit => ({
  visitId,
  placeRef,
  stayMinutes,
  prepMinutes: 10,
  importance: 'NORMAL',
  desiredTime: null,
  fixed: null,
  dateFlexible: true,
  timeFlexible: true,
  unassignedReason: null,
  ...extra,
});

const legs = (...m: (number | null)[]): (Leg | null)[] => m.map((minutes) => (minutes === null ? null : { minutes, source: 'USER_ESTIMATE' }));

export function sampleTrip(updatedAt = '2026-11-05T09:00:00+09:00'): Trip {
  return {
    tripId: SAMPLE_TRIP_ID,
    revision: 1,
    updatedAt,
    name: '강릉 3박 4일',
    timezone: 'Asia/Seoul',
    startDate: '2026-11-20',
    endDate: '2026-11-23',
    firstDay: { basis: 'DEPART_ORIGIN', departTime: '08:00' },
    origin: { kind: 'HOME' },
    finalDestination: { kind: 'HOME' },
    home: null,
    places: [
      place('cheolttuk', '철뚝소머리집', '강릉시 주문진읍 철둑길 42', 37.892, 128.826, 'FOOD'),
      place('youngjin', '강릉영진횟집', '강릉시 연곡면 해안로 1429', 37.873, 128.842, 'FOOD'),
      place('bohemian', '보헤미안박이추커피', '강릉시 사천면 해안로 1107', 37.8452, 128.8738, 'CAFE'),
      place('skybay', '스카이베이호텔 경포', '강릉시 해안로 476', 37.804, 128.908, 'LODGING'),
      place('lake', '경포호', '강릉시 저동 경포호 일원', 37.7955, 128.8975, 'SIGHT'),
      place('donghwa', '강릉짬뽕순두부 동화가든 본점', '강릉시 초당순두부길77번길 15', 37.791, 128.9145, 'FOOD'),
      place('mandong', '만동제과 강릉점', '강릉시 금성로 6', 37.7547, 128.8986, 'FOOD'),
      place('umji', '엄지네포장마차 본점', '강릉시 경강로2255번길 21', 37.768, 128.91, 'FOOD'),
      place('shilla', '신라모노그램 강릉', '강릉시 해안로 186', 37.7963, 128.9196, 'LODGING'),
      place('gyodong', '원조강릉교동반점 본점', '강릉시 강릉대로 205', 37.759, 128.897, 'FOOD'),
      place('terarosa', '테라로사 커피공장 강릉본점', '강릉시 구정면 현천길 7', 37.715, 128.893, 'CAFE'),
      place('topsten', '호텔탑스텐', '강릉시 옥계면 헌화로 455-34', 37.648, 129.057, 'LODGING'),
      place('badabuchae', '정동심곡바다부채길', '강릉시 강동면 심곡리 114-3 심곡매표소', 37.6658, 129.048, 'SIGHT'),
      place('anmok', '안목해변 커피거리', '강릉시 창해로14번길 일원', 37.772, 128.947, 'CAFE'),
    ],
    visits: [
      visit('v1', 'cheolttuk', 60, { desiredTime: '10:30' }),
      visit('v2', 'youngjin', 75),
      visit('v3', 'bohemian', 60),
      visit('v4', 'lake', 90),
      visit('v5', 'donghwa', 60, { importance: 'MUST', fixed: { time: '13:00', kind: 'RESERVATION' }, dateFlexible: false, timeFlexible: false }),
      visit('v6', 'mandong', 30),
      visit('v7', 'umji', 60),
      visit('v8', 'gyodong', 60),
      visit('v9', 'terarosa', 90),
      visit('v10', 'badabuchae', 180, { prepMinutes: 20, importance: 'MUST', fixed: { time: '10:00', kind: 'USER' }, dateFlexible: false, timeFlexible: false }),
      visit('v11', 'anmok', 60, { importance: 'OPTIONAL', unassignedReason: 'NO_TIME' }),
    ],
    days: [
      { dayIndex: 1, date: '2026-11-20', departTime: null, endBy: null, visitOrder: ['v1', 'v2', 'v3'], legs: legs(null, 15, 10, 20), lodgingPlaceRef: 'skybay' },
      { dayIndex: 2, date: '2026-11-21', departTime: '09:30', endBy: null, visitOrder: ['v4', 'v5', 'v6', 'v7'], legs: legs(5, 10, 15, 10, 15), lodgingPlaceRef: 'shilla' },
      { dayIndex: 3, date: '2026-11-22', departTime: '10:30', endBy: null, visitOrder: ['v8', 'v9'], legs: legs(20, 20, 35), lodgingPlaceRef: 'topsten' },
      { dayIndex: 4, date: '2026-11-23', departTime: '09:30', endBy: null, visitOrder: ['v10'], legs: legs(10, null), lodgingPlaceRef: null },
    ],
  };
}
