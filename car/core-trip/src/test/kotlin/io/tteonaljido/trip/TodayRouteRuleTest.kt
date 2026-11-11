package io.tteonaljido.trip

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** '오늘 경로 전송' followed stop by stop (M57): waypoint arrivals mark stops, waypoint times feed the next-stop estimate. */
class TodayRouteRuleTest {
    private fun stop(id: String?, name: String, lat: Int, lon: Int = 1_289_000_000) = GuidingTarget(2, id, id?.let { "p-$it" }, lat, lon, name, 1L)
    private val a = stop("v1", "경포호", 377_950_000)
    private val b = stop("v2", "동화가든", 377_800_000)
    private val c = stop("v3", "안목해변", 377_700_000)
    private val route = CarOverlay(guiding = c, guidingStops = listOf(a, b, c))
    private fun wp(name: String, s: Int?) = TodayRoute.Waypoint(name, s)

    @Test fun theRouteIsOursWhileTheNavigationHeadsForItsLastStop() {
        assertTrue(TodayRoute.onRoute(route, "안목해변", null, null))
        assertTrue(TodayRoute.onRoute(route, "다른 이름", c.latE7, c.lonE7)) // renamed by the navigation, same spot
        assertFalse(TodayRoute.onRoute(route, "서울역", 375_547_000, 1_269_706_000))
        assertFalse(TodayRoute.onRoute(CarOverlay(), "안목해변", null, null))
    }

    @Test fun aWaypointArrivalMarksItsStopAndTheRouteGoesOn() {
        val g = TodayRoute.waypointArrived(route, "경포호", null, null)!!
        assertEquals("v1", g.visitId)
        val after = route.arrivedWaypoint(g, 99L, VisitHow.NAVI_ARRIVED)
        assertTrue("v1" in after.visited)
        assertEquals(VisitStamp(99L, VisitHow.NAVI_ARRIVED), after.visitedAt["v1"])
        assertEquals(listOf(b, c), after.guidingStops)
        assertEquals(c, after.guiding) // the navigation still drives to the last stop
    }

    @Test fun aWaypointIsMatchedByPositionWhenItsNameDiffers() {
        assertEquals("v2", TodayRoute.waypointArrived(route, "동화가든 본점", b.latE7 + 500, b.lonE7)!!.visitId)
        assertNull(TodayRoute.waypointArrived(route, "모르는 곳", 370_000_000, 1_270_000_000))
    }

    @Test fun theLastStopIsNeverAWaypointArrival() {
        // It arrives through the destination event; a waypoint event naming it is ignored.
        assertNull(TodayRoute.waypointArrived(route, "안목해변", c.latE7, c.lonE7))
        val lastLeg = route.copy(visited = setOf("v1", "v2"))
        assertNull(TodayRoute.waypointArrived(lastLeg, "경포호", null, null))
        assertNull(TodayRoute.waypointArrived(lastLeg, null, null, null, demo = true))
    }

    @Test fun theDemoSignalTakesTheNextWaypoint() {
        assertEquals("v1", TodayRoute.waypointArrived(route, null, null, null, demo = true)!!.visitId)
        assertEquals("v2", TodayRoute.waypointArrived(route.copy(visited = setOf("v1")), null, null, null, demo = true)!!.visitId)
    }

    @Test fun theNextStopsTimeIsItsWaypointsNotTheDestinations() {
        val ws = listOf(wp("경포호", 1_200), wp("동화가든", 2_400))
        assertEquals(1_200, TodayRoute.nextLegSeconds(route, "v1", "안목해변", null, null, 3_600, ws))
        // After the first waypoint: the list shrinks and the next stop is the second one.
        val after = route.copy(visited = setOf("v1"))
        assertEquals(1_100, TodayRoute.nextLegSeconds(after, "v2", "안목해변", null, null, 2_300, listOf(wp("동화가든", 1_100))))
        // On the last leg it is the destination's own time.
        assertEquals(900, TodayRoute.nextLegSeconds(route.copy(visited = setOf("v1", "v2")), "v3", "안목해변", null, null, 900, emptyList()))
    }

    @Test fun theDistanceComesFromTheSameLegAsTheTime() {
        val ws = listOf(TodayRoute.Waypoint("경포호", 8_220, 198_000), TodayRoute.Waypoint("동화가든", 8_460, 201_000))
        val dest = TodayRoute.Waypoint("안목해변", 9_000, 206_000)
        assertEquals(198_000, TodayRoute.nextLeg(route, "v1", null, null, dest, ws)!!.remainMetres)
        assertEquals(206_000, TodayRoute.nextLeg(route.copy(visited = setOf("v1", "v2")), "v3", null, null, dest, ws)!!.remainMetres)
    }

    @Test fun unnamedWaypointsAreTakenInOrderOnlyWhenTheListMatches() {
        // Exactly the waypoints still ahead (2) → the first one is the next stop.
        assertEquals(1_200, TodayRoute.nextLegSeconds(route, "v1", "안목해변", null, null, 3_600, listOf(wp("", 1_200), wp("", 2_400))))
        // A list of another length cannot be lined up with our stops: no number rather than a wrong one.
        assertNull(TodayRoute.nextLegSeconds(route, "v1", "안목해변", null, null, 3_600, listOf(wp("", 1_200))))
    }

    @Test fun noTimeWhenTheNextStopIsNotTheRoutesNextOrTheRouteChanged() {
        val ws = listOf(wp("경포호", 1_200), wp("동화가든", 2_400))
        assertNull(TodayRoute.nextLegSeconds(route, "v9", "안목해변", null, null, 3_600, ws)) // a stop that was not sent
        assertNull(TodayRoute.nextLegSeconds(route, "v2", "안목해변", null, null, 3_600, ws)) // v1 is still ahead of it
        assertNull(TodayRoute.nextLegSeconds(route, "v1", "서울역", 375_547_000, 1_269_706_000, 3_600, ws)) // navigation went elsewhere
        // A skipped waypoint is no longer ahead: the next stop is the one after it.
        assertEquals(2_400, TodayRoute.nextLegSeconds(route.copy(skipped = setOf("v1")), "v2", "안목해변", null, null, 3_600, ws))
    }
}
