package io.tteonaljido.car.guide

import io.tteonaljido.trip.CarOverlay
import io.tteonaljido.trip.GuidingTarget
import io.tteonaljido.trip.VisitHow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The automatic-arrival write path (GuidanceTracker.onArrival) ends in [CarOverlay.arrived]: a plain JVM test of the
 * rule that "arriving at a stop marks it visited, arriving at the night's lodging or the final destination only ends
 * guiding." The matching and locking around it are exercised by the car E2E; this pins the state change itself.
 */
class ArrivedTest {
    private fun guiding(visitId: String?) = GuidingTarget(1, visitId, visitId?.let { "p-$it" }, 0, 0, "목적지", 0)

    @Test fun arrivingAtAStopMarksItVisitedAndClearsGuiding() {
        val before = CarOverlay(guiding = guiding("v2"))
        val after = before.arrived(guiding("v2"), 1_700_000_000_000L, VisitHow.NAVI_ARRIVED)
        assertTrue("v2" in after.visited)
        assertEquals(VisitHow.NAVI_ARRIVED, after.visitedAt["v2"]?.how)
        assertEquals(1_700_000_000_000L, after.visitedAt["v2"]?.at)
        assertNull("guiding is cleared once the arrival is recorded", after.guiding)
    }

    @Test fun arrivingAtLodgingOrFinalOnlyEndsGuiding() {
        val before = CarOverlay(visited = setOf("v1"), guiding = guiding(null))
        val after = before.arrived(guiding(null), 1_700_000_000_000L, VisitHow.NAVI_ARRIVED)
        assertEquals(setOf("v1"), after.visited) // no new visit added
        assertTrue(after.visitedAt.isEmpty())
        assertNull(after.guiding)
    }

    @Test fun theDemoSignalIsRecordedAsItsOwnKind() {
        val after = CarOverlay(guiding = guiding("v5")).arrived(guiding("v5"), 42L, VisitHow.DEMO_SIGNAL)
        assertEquals(VisitHow.DEMO_SIGNAL, after.visitedAt["v5"]?.how)
        assertFalse(after.visited.isEmpty())
    }
}
