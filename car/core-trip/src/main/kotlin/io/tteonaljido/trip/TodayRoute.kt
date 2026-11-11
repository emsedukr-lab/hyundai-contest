package io.tteonaljido.trip

/**
 * '오늘 경로 전송' as a route the car keeps following (M57). The navigation gets up to three stops in one request
 * (two waypoints + the destination); [CarOverlay.guidingStops] remembers them in driving order. Two navigation signals
 * are then read against that list:
 *  - `onWayPointArrived` → the matching stop is marked visited, like `onDestinationArrived` already does for the last one
 *  - `onDrivingInfo.waypoints` → the remaining time to the NEXT stop (not just to the final destination), so 시간 지킴이
 *    keeps working on a multi-stop route
 * Pure: the app passes plain values in, so this is tested without the SDK.
 */
object TodayRoute {
    /** One waypoint as the navigation reports it while driving: what is left to it from where the car is now. */
    data class Waypoint(val name: String, val remainSeconds: Int?, val remainMetres: Int? = null)

    private fun key(g: GuidingTarget) = g.visitId ?: "end"

    /** Stops of the sent route that are still ahead (not arrived, not skipped), in driving order. */
    fun pending(o: CarOverlay): List<GuidingTarget> = o.guidingStops.filter { it.visitId == null || (it.visitId !in o.visited && it.visitId !in o.skipped) }

    /** The navigation is still on the route this app sent: its destination is the route's last stop (same name or within 150 m). */
    fun onRoute(o: CarOverlay, destName: String?, destLatE7: Int?, destLonE7: Int?): Boolean {
        val last = o.guidingStops.lastOrNull() ?: return false
        return ArrivalRule.matches(last, destName, destLatE7, destLonE7)
    }

    /**
     * The stop a waypoint-arrival event belongs to: a pending stop before the final one whose name matches, or that
     * the car stands within 150 m of. Null when nothing matches (the event is then ignored — never a guess).
     * `demo` (emulator signal, which carries no place): the first pending waypoint.
     */
    fun waypointArrived(o: CarOverlay, arrivedName: String?, hereLatE7: Int?, hereLonE7: Int?, demo: Boolean = false): GuidingTarget? {
        val last = o.guidingStops.lastOrNull() ?: return null
        val waypoints = pending(o).filter { it != last }
        if (demo) return waypoints.firstOrNull()
        return waypoints.firstOrNull { ArrivalRule.matches(it, arrivedName, hereLatE7, hereLonE7) }
    }

    /**
     * What is left to the next stop [nextKey] (a visitId, or "end") while the navigation drives the sent route.
     * Only when that stop is the first one still ahead: on the last leg it is the destination's own remainder
     * ([dest]), before that the waypoint's — found by name, or by position in the list when the navigation lists
     * exactly the waypoints still ahead. Anything else is null, and the caller falls back to the plan's leg.
     */
    fun nextLeg(o: CarOverlay, nextKey: String, destLatE7: Int?, destLonE7: Int?, dest: Waypoint, waypoints: List<Waypoint>): Waypoint? {
        if (!onRoute(o, dest.name, destLatE7, destLonE7)) return null
        val ahead = pending(o)
        val next = ahead.firstOrNull() ?: return null
        if (key(next) != nextKey) return null
        if (ahead.size == 1) return dest
        val byName = waypoints.firstOrNull { it.name.isNotBlank() && it.name.trim() == next.name.trim() }
        return byName ?: waypoints.firstOrNull()?.takeIf { waypoints.size == ahead.size - 1 }
    }

    fun nextLegSeconds(o: CarOverlay, nextKey: String, destName: String?, destLatE7: Int?, destLonE7: Int?, destRemainSeconds: Int?, waypoints: List<Waypoint>): Int? =
        nextLeg(o, nextKey, destLatE7, destLonE7, Waypoint(destName.orEmpty(), destRemainSeconds), waypoints)?.remainSeconds
}

/** A waypoint of the sent route was reached: that stop is visited and leaves the list; the route itself goes on. */
fun CarOverlay.arrivedWaypoint(g: GuidingTarget, now: Long, how: VisitHow): CarOverlay {
    val id = g.visitId ?: return copy(guidingStops = guidingStops - g)
    return copy(visited = visited + id, visitedAt = visitedAt + (id to VisitStamp(now, how)), guidingStops = guidingStops - g)
}
