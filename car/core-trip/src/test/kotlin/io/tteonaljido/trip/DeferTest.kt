package io.tteonaljido.trip

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * "뒤로 미루기" (defer): an optional stop is moved to the tail of the day's remaining order instead of being dropped.
 * It is car-only overlay state (the plan is never edited), mirroring `skipped`. These tests guard that:
 *  - a deferred stop still happens (unlike a skipped one), just later and with an unknown time at the tail;
 *  - deferring the stop before a fixed reservation frees exactly as much slack as skipping it would;
 *  - an empty `deferred` set leaves the projection byte-identical to before the feature.
 */
class DeferTest {
    private val schemaDir = File(System.getProperty("schemaDir"))
    private val sample = (TransferParser.parse(File(schemaDir, "fixtures/valid/sample.json").readText()) as ParseResult.Ok).transfer.trip
    private fun m(hhmm: String) = TripValidator.minutes(hhmm)
    private fun withVisit(t: Trip, id: String, f: (Visit) -> Visit) = t.copy(visits = t.visits.map { if (it.visitId == id) f(it) else it })
    /** 경포호 (v4) as an optional stop before the 13:00 reservation (v5), same setup LiveProjectionTest uses. */
    private val lakeOptional = withVisit(sample, "v4") { it.copy(importance = Importance.OPTIONAL) }

    @Test fun deferMovesTheOptionalStopToTheTail() {
        val p = LiveProjection.project(lakeOptional, CarOverlay(deferred = setOf("v4")), 2, m("09:00"))
        assertEquals("v5", p.nextVisitId)            // the reservation is now first
        assertEquals(m("09:15"), p.arriveNext)       // start→v5 bridged across the moved stop (5 + 10), same as a skip
        assertTrue(p.approximate)
        assertEquals("v4", p.stops.last().visitId)   // the moved stop is at the tail…
        assertNull(p.stops.last().arrive)            // …with no time (no plan leg jumps backward to it)
    }

    @Test fun lateOffersBothSkipAndDeferForTheSameStop() {
        val p = LiveProjection.project(lakeOptional, CarOverlay(), 2, m("09:20"), naviRemaining = 134)
        assertEquals(Punctuality.LATE, p.status)
        assertEquals(SkipSuggestion("v4", 90), p.skip)   // its planned stay only (no parking time, M42)
        assertEquals(DeferSuggestion("v4", 90), p.defer) // same candidate, offered as "do it later"
    }

    @Test fun deferringFreesTheSameSlackAsSkipping() {
        val sk = LiveProjection.project(lakeOptional, CarOverlay(skipped = setOf("v4")), 2, m("09:00"))
        val df = LiveProjection.project(lakeOptional, CarOverlay(deferred = setOf("v4")), 2, m("09:00"))
        assertEquals("v5", sk.fixed!!.visitId)
        assertEquals(sk.fixed!!.slack, df.fixed!!.slack) // the reservation becomes reachable either way
    }

    @Test fun deferredStopStillAppearsUnlikeASkippedOne() {
        val sk = LiveProjection.project(lakeOptional, CarOverlay(skipped = setOf("v4")), 2, m("09:00"))
        val df = LiveProjection.project(lakeOptional, CarOverlay(deferred = setOf("v4")), 2, m("09:00"))
        assertFalse(sk.stops.any { it.visitId == "v4" }) // skipped → gone from the day
        assertTrue(df.stops.any { it.visitId == "v4" })  // deferred → still on the day, later
    }

    @Test fun nextDestinationSendsDeferredStopsToTheTail() {
        val step = NextDestination.of(sample, CarOverlay(deferred = setOf("v4")), 2)
        assertEquals("v5", (step.target as Target.Stop).visitId)
    }

    @Test fun upcomingOrdersRemainingStopsWithDeferredAtTheTail() {
        // Day 2 is v4,v5,v6,v7 in order; the bundle-send (guideToday) reads this list.
        assertEquals(listOf("v4", "v5", "v6", "v7"), NextDestination.upcoming(sample, CarOverlay(), 2))
        assertEquals(listOf("v5", "v6", "v7", "v4"), NextDestination.upcoming(sample, CarOverlay(deferred = setOf("v4")), 2))
        assertEquals(listOf("v6", "v7"), NextDestination.upcoming(sample, CarOverlay(visited = setOf("v4"), skipped = setOf("v5")), 2))
    }

    @Test fun deferToAnotherDayLeavesTheOriginDayAndJoinsTheTargetDay() {
        val o = CarOverlay(deferredTo = mapOf("v4" to 3))
        // Origin day (2): v4 is gone, the reservation v5 leads.
        val d2 = LiveProjection.project(sample, o, 2, m("09:00"))
        assertEquals("v5", d2.nextVisitId)
        assertFalse(d2.stops.any { it.visitId == "v4" })
        assertFalse("v4" in NextDestination.upcoming(sample, o, 2))
        // Target day (3): v4 shows at the tail, with unknown time (no plan leg reaches it).
        val d3 = LiveProjection.project(sample, o, 3, m("09:00"))
        assertEquals("v4", d3.stops.last().visitId)
        assertNull(d3.stops.last().arrive)
        assertTrue(d3.approximate)
        assertEquals("v4", NextDestination.upcoming(sample, o, 3).last())
    }

    @Test fun undoneDayMoveRestoresTheOriginDay() {
        val moved = CarOverlay(deferredTo = mapOf("v4" to 3))
        val restored = moved.copy(deferredTo = emptyMap())
        assertEquals("v4", NextDestination.upcoming(sample, restored, 2).first()) // back on day 2 in its place
        assertFalse("v4" in NextDestination.upcoming(sample, restored, 3))
    }

    @Test fun reconcileKeepsExistingDeferAndRecordsButDropsRemovedOnes() {
        val o = CarOverlay(
            deferred = setOf("v4"), // still exists in the new plan → kept
            deferredTo = mapOf("v6" to 3), // v6 removed below → dropped
            visitRecords = listOf(VisitRecord("t", 2, "mandong", PlaceCategory.FOOD, isWeekend = false, tArrive = 0, tParked = 5 * 60_000L, tDepart = 40 * 60_000L)),
        )
        val fewer = sample.copy(places = sample.places.filter { it.placeRef != "mandong" }, visits = sample.visits.filter { it.visitId != "v6" })
        val r = ImportDecision.reconcile(o, fewer)
        assertTrue("v4" in r.deferred)
        assertTrue(r.deferredTo.isEmpty())   // the moved stop's target is dropped with the stop
        assertTrue(r.visitRecords.isEmpty()) // the removed place's measurement is dropped
    }

    @Test fun reconcileDropsAMoveToADayTheNewPlanNoLongerHas() {
        val o = CarOverlay(deferredTo = mapOf("v4" to 4, "v6" to 3))
        val shorter = sample.copy(endDate = "2026-11-22", days = sample.days.take(3))
        val r = ImportDecision.reconcile(o, shorter)
        assertEquals(mapOf("v6" to 3), r.deferredTo) // day 3 still exists; day 4 is gone
        assertEquals("v4", NextDestination.upcoming(shorter, r, 2).first()) // back in its place on its own day
    }

    /** "여기서 출발" keeps its estimate only as the plan leg it actually measured (here → the next stop in guidance order). */
    @Test fun aFromHereEstimateIsKeptOnlyUnderTheLegItMeasured() {
        val lake = sample.places.first { it.placeRef == "lake" }
        val skybay = sample.places.first { it.placeRef == "skybay" }
        fun key(at: Place, o: CarOverlay) = LegKeys.startingAt(sample, o, 2, at.latE7!!, at.lonE7!!)
        // At 경포호 with v4 done, the estimate is to v5: exactly the plan leg 경포호→동화가든.
        assertEquals("lake>donghwa", key(lake, CarOverlay(visited = setOf("v4"))))
        // v5 put off until later (or to another day): the estimate is to v6, and no plan leg runs 경포호→만동제과.
        assertNull(key(lake, CarOverlay(visited = setOf("v4"), deferred = setOf("v5"))))
        assertNull(key(lake, CarOverlay(visited = setOf("v4"), deferredTo = mapOf("v5" to 3))))
        // Same at the day's start: the first stop put off means the estimate is to v5, not the leg to 경포호.
        assertEquals("skybay>lake", key(skybay, CarOverlay()))
        assertNull(key(skybay, CarOverlay(deferred = setOf("v4"))))
    }

    @Test fun lowEvSocSurfacesAChargeAdvisoryInTheProjection() {
        val p = LiveProjection.project(sample, CarOverlay(), 2, m("09:00"), naviRemaining = 134, vehicleKind = VehicleKind.EV, energyPercent = 15)
        assertEquals(EnergyAction.FAST_CHARGE, p.energy?.action)
    }

    @Test fun defaultVehicleKindLeavesEnergyNull() {
        val p = LiveProjection.project(sample, CarOverlay(), 2, m("09:00"), naviRemaining = 134)
        assertNull(p.energy)
    }

    @Test fun emptyDeferredLeavesTheProjectionUnchanged() {
        val base = LiveProjection.project(lakeOptional, CarOverlay(), 2, m("08:00"), naviRemaining = 134)
        val same = LiveProjection.project(lakeOptional, CarOverlay(deferred = emptySet()), 2, m("08:00"), naviRemaining = 134)
        assertEquals(base.arriveNext, same.arriveNext)
        assertEquals(base.fixed!!.slack, same.fixed!!.slack)
        assertEquals(base.approximate, same.approximate)
    }
}
