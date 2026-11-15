# Product

## Platform

android

## Users

Travellers in Korea taking a 1–4 day trip by their own car or a rental car: families, couples and friends, often with restaurant or activity reservations that make the days tight. They plan on a phone at home (or on the way), then drive with the Hyundai navigation. The car app's user is the same person, in the driver's seat or beside it, mostly parked when operating it.

## Product Purpose

떠날지도 (The Naljido) turns a list of places someone wants to visit into a day-by-day route for the whole trip, then hands that trip to the car once, so the car's own navigation measures the real times and distances and guides stop by stop. Success means the traveller spends less time arranging days and orders, less time driving between stops, arrives on time for reservations, and never re-types destinations in the car.

## Positioning

The car's navigation, not a phone map service, is the authority for time, distance and order: the car app measures every leg with the Hyundai navigation (waypoint routes) and suggests a faster order from those measurements. The trip moves to the car once, through a one-time QR with end-to-end encryption, with no account, mirroring or continuous sync.

## Operating Context

- Phone: a mobile web app opened from a QR or link, no install or sign-up; trips are stored only on the phone. Flow: new trip in 4 steps (trip info → add places → reservations and must-visit pins → route recommendation), then a day-by-day editor (timeline, lodging, travel times from Kakao directions as estimates), then "경로 보고 차로 보내기" to pair with the car.
- Car: a Pleos Connect (Android Automotive) app on the centre display. Parked: import by QR and a 6-digit code check, review and approve, measure legs with the navigation, reorder a day, start guidance. Driving: one line with the next destination and the schedule status; no operation.
- Sample trip: '강릉 3박 4일' (`/?sample=1`), used in demos and the contest submission.

## Capabilities and Constraints

- The car never edits the received plan; what it learns (measured legs, its own order) lives in an overlay and can be reset. Re-validation only marks conflicts.
- Car safety rules from Pleos: text 20sp or larger, touch targets 64dp or larger, sentences of three lines or fewer, nothing operable while driving, day and night themes, Korean and English.
- Read-only vehicle permissions; the home address leaves the phone only with consent; the phone's location is used only for the first leg and is never stored or sent to the car.
- Travel times on the phone are estimates (Kakao); the car's navigation values replace them.

## Brand Commitments

- Name 떠날지도. Copy is polite 해요체, no exclamation marks or emoji.
- Visual language (decided 2026-11-14): Toss design system's visual language with Pleos safety rules, recorded in `design/TOSS.md`; layout, flows and copy were kept when it was adopted.

## Evidence on Hand

- Real measurements from the Pleos emulator's navigation (`docs/evidence/2026-11-13_navi-measure-order`, `2026-11-14_route-optimizer`, `2026-11-14_toss-design`), screenshots of both apps, a 15-check live pairing run, 548 automated tests.
- No real-user research, usage metrics, testimonials or customers exist; business figures in the submission are targets, not results.

## Product Principles

1. The navigation measures; the phone estimates. Never present an estimate as a measurement.
2. One handover, nothing lingering: no account, no sync, delete before returning a rental car.
3. The plan belongs to the person: the car suggests and marks, people approve.
4. In the car, a glance is all there is: one line while driving, actions only when parked.
5. Reservations are the fixed points the day is planned around.

## Accessibility & Inclusion

Pleos in-car rules (20sp, 64dp, 4.5:1 contrast, day/night). Phone: 4.5:1 text contrast, 44px touch targets, Korean word-unit line breaking (`keep-all`).
