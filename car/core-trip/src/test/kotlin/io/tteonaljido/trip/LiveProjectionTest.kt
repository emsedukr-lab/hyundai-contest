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

    /* ---------- punctuality against the 13:00 reservation (day 2, navigation says 134 min to 경포호) ---------- */

    @Test fun onTimeWithRoomToSpare() {
        val p = LiveProjection.project(lakeOptional, CarOverlay(), 2, m("08:00"), naviRemaining = 134)
        assertEquals("v4", p.nextVisitId)
        assertEquals(m("10:14"), p.arriveNext)
        assertEquals(Basis.NAVI_LIVE, p.basis)
        assertEquals(39, p.vsPlan) // the plan arrives 09:35
        assertEquals("v5", p.fixed!!.visitId)
        assertEquals(46, p.fixed!!.slack)
        assertEquals(Punctuality.ON_TIME, p.status)
        assertNull(p.skip)
    }

    @Test fun tightWithinTenMinutes() {
        val p = LiveProjection.project(lakeOptional, CarOverlay(), 2, m("08:40"), naviRemaining = 134)
        assertEquals(6, p.fixed!!.slack)
        assertEquals(Punctuality.TIGHT, p.status)
    }

    @Test fun lateSuggestsSkippingTheOptionalStop() {
        val p = LiveProjection.project(lakeOptional, CarOverlay(), 2, m("09:00"), naviRemaining = 134)
        assertEquals(-14, p.fixed!!.slack)
        assertEquals(Punctuality.LATE, p.status)
        assertEquals(SkipSuggestion("v4", 100), p.skip) // prep 10 + stay 90
    }

    @Test fun mustAndNormalStopsAreNeverSuggested() {
        val lakeNormal = withVisit(sample, "v4") { it.copy(importance = Importance.NORMAL) }
        val p = LiveProjection.project(lakeNormal, CarOverlay(), 2, m("09:00"), naviRemaining = 134)
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
        assertEquals(85, p.fixed!!.slack)
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

    /* ---------- leg sources ---------- */

    @Test fun planLegWinsOverNaviEstimateAndNaviFillsGaps() {
        val o = CarOverlay(legEstimates = mapOf("skybay>lake" to LegEstimate(30, 3_000, 0), "@home>cheolttuk" to LegEstimate(170, 230_000, 0)))
        assertEquals(LegValue(5, LegFrom.USER), TripValidator.leg(sample, o, 2, 0))
        assertEquals(LegValue(170, LegFrom.NAVI), TripValidator.leg(sample, o, 1, 0))
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
        assertEquals(LegValue(165, LegFrom.NAVI), TripValidator.leg(planned, estimated, 1, 0))
        assertEquals(LegValue(30, LegFrom.USER), TripValidator.leg(planned, CarOverlay(), 1, 0))
    }

    @Test fun legKeysFollowTheDayEnds() {
        assertEquals("@home>cheolttuk", LegKeys.of(sample, CarOverlay(), 1, 0))
        assertEquals("bohemian>skybay", LegKeys.of(sample, CarOverlay(), 1, 3))
        assertEquals("skybay>lake", LegKeys.of(sample, CarOverlay(), 2, 0))
        assertEquals("badabuchae>@home", LegKeys.of(sample, CarOverlay(), 4, 1))
        assertEquals("@origin>cheolttuk", LegKeys.of(sample, CarOverlay(originOverride = here), 1, 0))
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
        val t = withDay(sample, 2) { it.copy(endBy = "15:00") } // the day ends ~16:30, the 13:00 reservation is fine
        val p = LiveProjection.project(t, CarOverlay(), 2, m("09:30"))
        assertEquals(DeadlineKind.END_BY, p.deadlineKind)
        assertEquals(Punctuality.LATE, p.status)
        assertEquals(-90, p.deadlineSlack)
        assertEquals("v4", p.skip?.visitId) // 경포호 is the optional stop before the reservation
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
