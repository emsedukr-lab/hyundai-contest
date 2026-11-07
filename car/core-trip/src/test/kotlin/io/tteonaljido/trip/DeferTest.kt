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
        val p = LiveProjection.project(lakeOptional, CarOverlay(), 2, m("09:00"), naviRemaining = 134)
        assertEquals(Punctuality.LATE, p.status)
        assertEquals(SkipSuggestion("v4", 100), p.skip)   // prep 10 + stay 90
        assertEquals(DeferSuggestion("v4", 100), p.defer) // same candidate, offered as "do it later"
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

    @Test fun emptyDeferredLeavesTheProjectionUnchanged() {
        val base = LiveProjection.project(lakeOptional, CarOverlay(), 2, m("08:00"), naviRemaining = 134)
        val same = LiveProjection.project(lakeOptional, CarOverlay(deferred = emptySet()), 2, m("08:00"), naviRemaining = 134)
        assertEquals(base.arriveNext, same.arriveNext)
        assertEquals(base.fixed!!.slack, same.fixed!!.slack)
        assertEquals(base.approximate, same.approximate)
    }
}
