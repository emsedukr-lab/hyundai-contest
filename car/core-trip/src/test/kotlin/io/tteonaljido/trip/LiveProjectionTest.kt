package io.tteonaljido.trip

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class LiveProjectionTest {
    private val schemaDir = File(System.getProperty("schemaDir"))
    private val sample = (TransferParser.parse(File(schemaDir, "fixtures/valid/sample.json").readText()) as ParseResult.Ok).transfer.trip
    private fun m(hhmm: String) = TripValidator.minutes(hhmm)
    private fun withVisit(t: Trip, id: String, f: (Visit) -> Visit) = t.copy(visits = t.visits.map { if (it.visitId == id) f(it) else it })
    private fun withDay(t: Trip, n: Int, f: (Day) -> Day) = t.copy(days = t.days.map { if (it.dayIndex == n) f(it) else it })
    /** 경포호 as an optional stop (the sample marks it so; set explicitly so the tests don't depend on that). */
    private val lakeOptional = withVisit(sample, "v4") { it.copy(importance = Importance.OPTIONAL) }
    private val here = NaviBinding("", "", "", 374_127_212, 1_270_946_810, "", "수정구 시흥동")

    /*
     * ---------- punctuality against the 13:00 reservation (day 2, navigation says 134 min to 경포호) ----------
     * No parking time is counted (M42): 경포호 90 min + 10 min drive, so the reservation's slack is 13:00 − (now + 234).
     */

    @Test fun onTimeWithRoomToSpare() {
        val p = LiveProjection.project(lakeOptional, CarOverlay(), 2, m("08:00"), naviRemaining = 134)
        assertEquals("v4", p.nextVisitId)
        assertEquals(m("10:14"), p.arriveNext)
        assertEquals(Basis.NAVI_LIVE, p.basis)
        assertEquals(39, p.vsPlan) // the plan arrives 09:35
        assertEquals("v5", p.fixed!!.visitId)
        assertEquals(m("11:54"), p.fixed!!.ready) // arrival at the reservation, no parking time
        assertEquals(66, p.fixed!!.slack)
        assertEquals(Punctuality.ON_TIME, p.status)
        assertNull(p.skip)
    }

    @Test fun tightWithinTenMinutes() {
        val p = LiveProjection.project(lakeOptional, CarOverlay(), 2, m("09:00"), naviRemaining = 134)
        assertEquals(6, p.fixed!!.slack)
        assertEquals(Punctuality.TIGHT, p.status)
    }

    @Test fun lateSuggestsSkippingTheOptionalStop() {
        val p = LiveProjection.project(lakeOptional, CarOverlay(), 2, m("09:20"), naviRemaining = 134)
        assertEquals(-14, p.fixed!!.slack)
        assertEquals(Punctuality.LATE, p.status)
        assertEquals(SkipSuggestion("v4", 90), p.skip) // its planned stay only (no parking time, M42)
    }

    @Test fun mustAndNormalStopsAreNeverSuggested() {
        val lakeNormal = withVisit(sample, "v4") { it.copy(importance = Importance.NORMAL) }
        val p = LiveProjection.project(lakeNormal, CarOverlay(), 2, m("09:20"), naviRemaining = 134)
        assertEquals(Punctuality.LATE, p.status)
        assertNull(p.skip)
    }

    @Test fun skippedStopIsBridgedWithAnUpperBound() {
        val p = LiveProjection.project(lakeOptional, CarOverlay(skipped = setOf("v4")), 2, m("09:00"))
        assertEquals("v5", p.nextVisitId)
        assertEquals(m("09:15"), p.arriveNext) // 5 + 10 through the skipped stop
        assertTrue(p.approximate)
        assertEquals(Punctuality.ON_TIME, p.status)
    }

    @Test fun visitedStopIsTheNewStartingPoint() {
        val p = LiveProjection.project(sample, CarOverlay(visited = setOf("v4")), 2, m("11:15"))
        assertEquals("v5", p.nextVisitId)
        assertEquals(m("11:25"), p.arriveNext)
        assertFalse(p.approximate)
        assertEquals(95, p.fixed!!.slack)
        assertEquals(Basis.PLAN, p.basis)
    }

    @Test fun unknownLegLeavesTheDayUnknown() {
        val noNavi = LiveProjection.project(sample, CarOverlay(), 1, m("08:00"))
        assertEquals(Basis.NONE, noNavi.basis)
        assertNull(noNavi.arriveNext)
        assertEquals(Punctuality.NO_DEADLINE, noNavi.status)
        val withEndBy = withDay(sample, 1) { it.copy(endBy = "18:00") }
        assertEquals(Punctuality.UNKNOWN, LiveProjection.project(withEndBy, CarOverlay(), 1, m("08:00")).status)
        val live = LiveProjection.project(withEndBy, CarOverlay(), 1, m("08:00"), naviRemaining = 160)
        assertEquals(m("10:40"), live.arriveNext)
        assertEquals(Punctuality.ON_TIME, live.status) // day ends well before 18:00
    }

    @Test fun returnByTimeAfterTheLastStop() {
        val t = withDay(sample, 2) { it.copy(endBy = "18:10") }
        val all = CarOverlay(visited = setOf("v4", "v5", "v6", "v7"))
        val p = LiveProjection.project(t, all, 2, m("18:00"))
        assertNull(p.nextVisitId)
        assertEquals(m("18:15"), p.endExpected)
        assertEquals(Punctuality.LATE, p.status)
    }

    /** M42: measured visit records are groundwork only — no parking buffer and no stay tendency reach the projection. */
    @Test fun visitRecordsDoNotChangeTheProjection() {
        fun rec(pid: String, parkMin: Int, actualStay: Int) = VisitRecord("t", 2, pid, PlaceCategory.FOOD, isWeekend = false, tArrive = 0, tParked = parkMin * 60_000L, tDepart = (parkMin + actualStay) * 60_000L)
        // Three FOOD visits parked ~8 min and stayed 1.5× their plan (donghwa 60, mandong 30, umji 60).
        val recs = listOf(rec("donghwa", 8, 90), rec("mandong", 8, 45), rec("umji", 8, 90))
        val plain = LiveProjection.project(sample, CarOverlay(visited = setOf("v4")), 2, m("11:15"))
        val measured = LiveProjection.project(sample, CarOverlay(visited = setOf("v4"), visitRecords = recs), 2, m("11:15"))
        assertEquals(95, plain.fixed!!.slack)
        assertEquals(plain, measured)
        // Late case too: same slack, and the skip saves only the planned stay.
        val late = LiveProjection.project(lakeOptional, CarOverlay(), 2, m("09:20"), naviRemaining = 134)
        val lateMeasured = LiveProjection.project(lakeOptional, CarOverlay(visitRecords = recs), 2, m("09:20"), naviRemaining = 134)
        assertEquals(late, lateMeasured)
        assertEquals(SkipSuggestion("v4", 90), lateMeasured.skip)
    }

    @Test fun noVisitRecordsLeavesTheProjectionUnchanged() {
        // No records → the plain projection (records are never applied, M42).
        val p = LiveProjection.project(lakeOptional, CarOverlay(), 2, m("08:00"), naviRemaining = 134)
        assertEquals(m("10:14"), p.arriveNext)
        assertEquals(66, p.fixed!!.slack)
    }

    /* ---------- leg sources ---------- */

    @Test fun naviTimeWinsOverThePlanLegAndFillsGaps() {
        // M63: where the navigation has timed a leg, that is the leg's time; the phone's value stands for the rest.
        val o = CarOverlay(legEstimates = mapOf("skybay>lake" to LegEstimate(30, 3_000, 0), "@home>cheolttuk" to LegEstimate(170, 230_000, 0)))
        assertEquals(LegValue(30, LegFrom.NAVI, 3_000), TripValidator.leg(sample, o, 2, 0))
        assertEquals(LegValue(10, LegFrom.USER), TripValidator.leg(sample, o, 2, 1))
        assertEquals(LegValue(170, LegFrom.NAVI, 230_000), TripValidator.leg(sample, o, 1, 0))
        val codes = TripValidator.validate(sample, o).issues.filter { it.dayIndex == 1 }.map { it.code }
        assertFalse("LEG_UNKNOWN" in codes)
        assertTrue("LEG_NAVI" in codes)
        assertEquals(m("10:50"), TripValidator.timeline(sample, 1, o).first().arrive)
    }

    @Test fun startHereReplacesThePlanFirstLeg() {
        val planned = withDay(sample, 1) { d -> d.copy(legs = listOf(Leg(30, Leg.LegSource.USER_ESTIMATE)) + d.legs.drop(1)) }
        val moved = CarOverlay(originOverride = here)
        assertNull(TripValidator.leg(planned, moved, 1, 0)) // the 30 min was from home
        val estimated = moved.copy(legEstimates = mapOf("@origin>cheolttuk" to LegEstimate(165, 225_000, 0)))
        assertEquals(LegValue(165, LegFrom.NAVI, 225_000), TripValidator.leg(planned, estimated, 1, 0))
        assertEquals(LegValue(30, LegFrom.USER), TripValidator.leg(planned, CarOverlay(), 1, 0))
    }

    @Test fun legKeysFollowTheDayEnds() {
        assertEquals("@home>cheolttuk", LegKeys.of(sample, CarOverlay(), 1, 0))
        assertEquals("bohemian>skybay", LegKeys.of(sample, CarOverlay(), 1, 3))
        assertEquals("skybay>lake", LegKeys.of(sample, CarOverlay(), 2, 0))
        assertEquals("badabuchae>@home", LegKeys.of(sample, CarOverlay(), 4, 1))
        assertEquals("@origin>cheolttuk", LegKeys.of(sample, CarOverlay(originOverride = here), 1, 0))
    }

    @Test fun laterDaysStartFromTheLodgingOfTheNightBefore() {
        // M59: "여기서 출발" re-sets the first day only. An override left on day 2 (an older version allowed it) no longer applies.
        val day2 = CarOverlay(originOverrides = mapOf(2 to here), legEstimates = mapOf("@origin>lake" to LegEstimate(40, 30_000, 0)))
        assertFalse(DayStart.canDepartHere(sample, 2))
        assertNull(day2.originFor(sample, 2))
        assertEquals("skybay>lake", LegKeys.of(sample, day2, 2, 0))
        assertEquals(LegValue(5, LegFrom.USER), TripValidator.leg(sample, day2, 2, 0)) // the plan's lodging → first stop leg stands
        assertTrue(DayStart.canDepartHere(sample, 1))
    }

    @Test fun aDayAfterANightWithNoLodgingCanStartFromHere() {
        val noLodging = withDay(sample, 1) { it.copy(lodgingPlaceRef = null) }
        val day2 = CarOverlay(originOverrides = mapOf(2 to here))
        assertTrue(DayStart.canDepartHere(noLodging, 2))
        assertNull(LegKeys.of(noLodging, CarOverlay(), 2, 0))                     // nowhere to start from by the plan
        assertEquals("@origin>lake", LegKeys.of(noLodging, day2, 2, 0))
        val estimated = day2.copy(legEstimates = mapOf("@origin>lake" to LegEstimate(40, 30_000, 0)))
        assertEquals(LegValue(40, LegFrom.NAVI, 30_000), TripValidator.leg(noLodging, estimated, 2, 0))
    }

    @Test fun aTripWithNoStartPlaceStartsFromTheCurrentLocation() {
        val current = sample.copy(origin = Endpoint.Current)
        assertNull(LegKeys.of(current, CarOverlay(), 1, 0))                       // no fixed point until the car pins it
        assertNull(TripValidator.leg(current, CarOverlay(), 1, 0))
        val codes = TripValidator.validate(current, CarOverlay()).issues.map { it.code }
        assertFalse("ORIGIN_HOME_UNKNOWN" in codes)                               // nothing to confirm about a home it does not start from
        assertTrue("RETURN_HOME_UNKNOWN" in codes)                                // it still returns home
        val pinned = CarOverlay(originOverrides = mapOf(1 to here), legEstimates = mapOf("@origin>cheolttuk" to LegEstimate(165, 225_000, 0)))
        assertEquals("@origin>cheolttuk", LegKeys.of(current, pinned, 1, 0))
        assertEquals(165 to LegFrom.NAVI, TripValidator.leg(current, pinned, 1, 0)!!.let { it.minutes to it.from })
    }

    @Test fun aFirstLegThePlanCouldNotTimeIsTheCarsToMeasure() {
        // M60: the phone cannot time a first leg from "where the car is" or from a home it has no address for.
        val current = sample.copy(origin = Endpoint.Current)
        assertTrue(DayStart.untimed(current, CarOverlay()))
        assertTrue(DayStart.untimed(sample, CarOverlay()))                                  // from home, no time in the plan
        assertTrue(DayStart.untimed(sample, CarOverlay(home = here)))                       // knowing where home is does not time the leg
        val timed = withDay(sample, 1) { d -> d.copy(legs = listOf(Leg(150, Leg.LegSource.USER_ESTIMATE)) + d.legs.drop(1)) }
        assertFalse(DayStart.untimed(timed, CarOverlay()))                                  // the phone timed it from home: nothing to do
        val timedFromPhone = timed.copy(origin = Endpoint.Current)                          // M61: timed from where the phone was
        assertTrue(DayStart.untimed(timedFromPhone, CarOverlay()))                          // in the car, "here" is the car: measured again
        assertEquals(LegValue(150, LegFrom.USER), TripValidator.leg(timedFromPhone, CarOverlay(), 1, 0)) // until then the phone's time stands
        assertFalse(DayStart.untimed(current, CarOverlay(visited = setOf("v1"))))           // the first day is under way
    }

    @Test fun theCarKnowsWhenItStandsAtThePlansOwnStart() {
        assertNull(DayStart.planStart(sample, CarOverlay()))                                // home, and nobody said where
        assertNull(DayStart.planStart(sample.copy(origin = Endpoint.Current), CarOverlay(home = here)))
        assertEquals(here.latE7 to here.lonE7, DayStart.planStart(sample, CarOverlay(home = here)))
        assertTrue(DayStart.atPlanStart(sample, CarOverlay(home = here), here.latE7 + 500, here.lonE7))      // ~5 m off
        assertFalse(DayStart.atPlanStart(sample, CarOverlay(home = here), here.latE7 + 50_000, here.lonE7))  // ~550 m off
        assertFalse(DayStart.atPlanStart(sample, CarOverlay(), here.latE7, here.lonE7))
        val fromHotel = sample.copy(origin = Endpoint.AtPlace("skybay"))
        assertEquals(378_040_000 to 1_289_080_000, DayStart.planStart(fromHotel, CarOverlay()))
    }

    @Test fun aStartPinnedToTheCarIsMeasuredAgainWhenTheCarMovedOrTheEstimateIsOld() {
        val current = sample.copy(origin = Endpoint.Current)
        val now = 1_000_000_000L
        assertTrue(DayStart.needsMeasure(current, CarOverlay(), here.latE7, here.lonE7, now))            // never pinned
        val pinned = CarOverlay(originOverrides = mapOf(1 to here), originPinnedAuto = true)
        assertTrue(DayStart.needsMeasure(current, pinned, here.latE7, here.lonE7, now))                  // pinned, no estimate yet
        val measured = pinned.copy(legEstimates = mapOf("@origin>cheolttuk" to LegEstimate(152, 202_500, now)))
        assertFalse(DayStart.needsMeasure(current, measured, here.latE7, here.lonE7, now + 60_000))
        assertTrue(DayStart.needsMeasure(current, measured, here.latE7 + 50_000, here.lonE7, now + 60_000)) // ~550 m away
        assertTrue(DayStart.needsMeasure(current, measured, here.latE7, here.lonE7, now + DayStart.FRESH_MS + 1))
        // once measured the first leg is the navigation's, and the day's times can be worked out
        assertEquals(LegValue(152, LegFrom.NAVI, 202_500), TripValidator.leg(current, measured, 1, 0))
        assertFalse(TripValidator.validate(current, measured).issues.any { it.code == "LEG_UNKNOWN" && it.dayIndex == 1 })
        // at home the leg is the plan's own ("집 > 첫 장소"), no pin needed
        val atHome = CarOverlay(home = here, legEstimates = mapOf("@home>cheolttuk" to LegEstimate(150, 200_000, now)))
        assertTrue(DayStart.estimateFresh(sample, atHome, now + 60_000))
        assertEquals(LegValue(150, LegFrom.NAVI, 200_000), TripValidator.leg(sample, atHome, 1, 0))
    }

    /* ---------- next destination, arrival, update ---------- */

    @Test fun nextDestinationSkipsSkippedStops() {
        val step = NextDestination.of(sample, CarOverlay(skipped = setOf("v4")), 2)
        assertEquals("v5", (step.target as Target.Stop).visitId)
    }

    @Test fun arrivalMatchesByConfirmedNameOrDistance() {
        val g = GuidingTarget(2, "v4", "lake", 377_955_000, 1_288_975_000, "경포호", 0)
        assertTrue(ArrivalRule.matches(g, "경포호", null, null))
        assertTrue(ArrivalRule.matches(g, "", 377_955_900, 1_288_975_000)) // ~10 m
        assertFalse(ArrivalRule.matches(g, "경포해변", 377_700_000, 1_288_975_000)) // ~2.8 km
        assertFalse(ArrivalRule.matches(g, null, null, null))
    }

    @Test fun updateDropsCarStateOfRemovedStops() {
        val o = CarOverlay(
            visited = setOf("v4"), visitedAt = mapOf("v4" to VisitStamp(1, VisitHow.MANUAL)), skipped = setOf("v6"),
            legEstimates = mapOf("@home>cheolttuk" to LegEstimate(170, 1, 0), "mandong>umji" to LegEstimate(9, 1, 0)),
            guiding = GuidingTarget(2, "v6", "mandong", 0, 0, "만동제과", 0),
        )
        val fewer = sample.copy(places = sample.places.filter { it.placeRef != "mandong" }, visits = sample.visits.filter { it.visitId != "v6" })
        val r = ImportDecision.reconcile(o, fewer)
        assertEquals(setOf("v4"), r.visited)
        assertEquals(setOf("v4"), r.visitedAt.keys)
        assertTrue(r.skipped.isEmpty())
        assertEquals(setOf("@home>cheolttuk"), r.legEstimates.keys)
        assertNull(r.guiding)
    }

    /* ---------- storage compatibility ---------- */

    @Test fun tripsSavedBeforeTheNewFieldsStillLoad() {
        val json = Json { ignoreUnknownKeys = false; encodeDefaults = true } // same settings as the car's TripRepository
        val now = LocalTrip("id", sample, CarOverlay(visited = setOf("v1")), ImportMeta(sample.tripId, 1, "h", 0))
        val full = json.parseToJsonElement(json.encodeToString(LocalTrip.serializer(), now)).jsonObject
        val oldOverlay = JsonObject(full.getValue("overlay").jsonObject.filterKeys { it in setOf("home", "originOverride", "poiBindings", "visited") })
        val old = JsonObject(full + ("overlay" to oldOverlay))
        val loaded = json.decodeFromString(LocalTrip.serializer(), old.toString())
        assertEquals(now, loaded)
        assertTrue(loaded.overlay.legEstimates.isEmpty() && loaded.overlay.guiding == null && loaded.overlay.skipped.isEmpty())
    }
}

class DeadlineAndReconcileTest {
    private val schemaDir = File(System.getProperty("schemaDir"))
    private val sample = (TransferParser.parse(File(schemaDir, "fixtures/valid/sample.json").readText()) as ParseResult.Ok).transfer.trip
    private fun m(hhmm: String) = TripValidator.minutes(hhmm)
    private fun withDay(t: Trip, n: Int, f: (Day) -> Day) = t.copy(days = t.days.map { if (it.dayIndex == n) f(it) else it })

    @Test fun returnByCanBindEvenWhenTheFixedStopIsFine() {
        val t = withDay(sample, 2) { it.copy(endBy = "15:00") } // the day ends 16:10, the 13:00 reservation is fine
        val p = LiveProjection.project(t, CarOverlay(), 2, m("09:30"))
        assertEquals(DeadlineKind.END_BY, p.deadlineKind)
        assertEquals(Punctuality.LATE, p.status)
        assertEquals(-70, p.deadlineSlack)
        // Skipping 경포호 (before the 13:00 reservation) would not help the return time: the reservation re-anchors the
        // day. The stops after it are not optional, so nothing is suggested.
        assertNull(p.skip)
    }

    /** Late for the return time with a fixed stop in between: only an optional stop after the fixed one saves time. */
    @Test fun lateForTheReturnTimeSuggestsAStopAfterTheReservation() {
        val v6Optional = sample.copy(visits = sample.visits.map { if (it.visitId == "v6") it.copy(importance = Importance.OPTIONAL, stayMinutes = 50) else if (it.visitId == "v4") it.copy(importance = Importance.OPTIONAL) else it })
        val t = withDay(v6Optional, 2) { it.copy(endBy = "15:50") } // v4 (optional) → v5 fixed 13:00 → v6 (optional, stay 50) → v7; the day ends 16:30
        val p = LiveProjection.project(t, CarOverlay(), 2, m("08:00"))
        assertEquals(DeadlineKind.END_BY, p.deadlineKind)
        assertEquals(-40, p.deadlineSlack)
        assertEquals(195, p.fixed!!.slack)
        assertEquals(SkipSuggestion("v6", 50), p.skip)
        assertEquals(DeferSuggestion("v6", 50), p.defer)
        // Skipping v4 instead saves nothing: the car would just wait longer for 13:00.
        assertEquals(-40, LiveProjection.project(t, CarOverlay(skipped = setOf("v4")), 2, m("08:00")).deadlineSlack)
        // Skipping v6 frees its 50-min stay; the bridged leg through it (15 + 10) is the plan's upper bound.
        assertEquals(10, LiveProjection.project(t, CarOverlay(skipped = setOf("v6")), 2, m("08:00")).deadlineSlack)
    }

    private fun at(local: String) = java.time.LocalDateTime.parse(local).atZone(java.time.ZoneId.of("Asia/Seoul")).toInstant().toEpochMilli()

    /** Just past midnight the day goes on (still heading to that night's lodging), and its clock runs past 24:00. */
    @Test fun justPastMidnightTheDayGoesOnAndItsClockRunsPast24h() {
        val t = withDay(sample, 2) { it.copy(endBy = "22:00") }
        val now = NextDestination.momentOf(t, at("2026-11-22T00:30"))!!
        assertEquals(TripMoment(2, m("00:30") + 1440), now)
        val p = LiveProjection.project(t, CarOverlay(visited = setOf("v4", "v5", "v6", "v7")), now.dayIndex, now.minute)
        assertEquals(Punctuality.LATE, p.status)
        assertEquals(-165, p.deadlineSlack) // 00:30 + 15 min to the lodging = 00:45, 2 h 45 min past 22:00
        assertEquals("00:45(+1)", TripValidator.hhmm(p.arriveNext!!))
    }

    @Test fun theGraceEndsAt4AndAnEarlyStartOnDay1IsDay1() {
        assertEquals(TripMoment(3, m("04:00")), NextDestination.momentOf(sample, at("2026-11-22T04:00")))
        assertEquals(TripMoment(4, m("03:59") + 1440), NextDestination.momentOf(sample, at("2026-11-24T03:59")))
        assertNull(NextDestination.momentOf(sample, at("2026-11-24T04:00")))
        assertEquals(TripMoment(1, m("03:00")), NextDestination.momentOf(sample, at("2026-11-20T03:00"))) // leaving before 04:00 on day 1
        assertNull(NextDestination.momentOf(sample, at("2026-11-19T23:00")))
    }

    @Test fun theMoreUrgentOfFixedAndReturnByBinds() {
        val late = withDay(sample, 4) { it.copy(departTime = "09:55", endBy = "23:00") } // 10:00 fixed is tight, return-by is generous
        val p = LiveProjection.project(late, CarOverlay(), 4, m("09:55"))
        assertEquals(DeadlineKind.FIXED, p.deadlineKind)
        assertEquals(Punctuality.LATE, p.status)
    }

    @Test fun reconcileDropsEstimatesAndGuidingForAMovedPlace() {
        val o = CarOverlay(
            poiBindings = mapOf(
                "lake" to NaviBinding("", "", "", 377_955_000, 1_288_975_000, "경포호", ""),
                "donghwa" to NaviBinding("", "", "", 377_910_000, 1_289_145_000, "동화가든", ""),
            ),
            legEstimates = mapOf("skybay>lake" to LegEstimate(5, 1, 0), "lake>donghwa" to LegEstimate(10, 1, 0), "donghwa>mandong" to LegEstimate(15, 1, 0)),
            guiding = GuidingTarget(2, "v4", "lake", 377_955_000, 1_288_975_000, "경포호", 0),
        )
        val moved = sample.copy(places = sample.places.map { if (it.placeRef == "lake") it.copy(latE7 = 378_200_000) else it }) // 경포호 moved ~2.7 km
        val r = ImportDecision.reconcile(o, moved)
        assertFalse("lake" in r.poiBindings)
        assertTrue("donghwa" in r.poiBindings)
        assertEquals(setOf("donghwa>mandong"), r.legEstimates.keys) // both legs touching 경포호 dropped
        assertNull(r.guiding)
    }
}
