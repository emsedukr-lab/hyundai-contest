package io.tteonaljido.car.guide

import io.tteonaljido.car.Container
import io.tteonaljido.car.navi.NaviArrival
import io.tteonaljido.trip.ArrivalRule
import io.tteonaljido.trip.CarOverlay
import io.tteonaljido.trip.GuidingTarget
import io.tteonaljido.trip.TodayRoute
import io.tteonaljido.trip.VisitHow
import io.tteonaljido.trip.arrivedWaypoint
import io.tteonaljido.trip.VisitStamp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/** The most recent automatic arrival, so the screen can show it with an undo button. */
data class ArrivalNote(val localId: String, val visitId: String?, val name: String, val at: Long, val demo: Boolean)

/**
 * App-scoped (outlives screens): turns the navigation's arrival event into "visited" for the stop this app asked it to
 * guide to. It writes only the car-side overlay, never the plan, and only when the setting is on.
 */
class GuidanceTracker(private val c: Container) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val _changed = MutableSharedFlow<Unit>(extraBufferCapacity = 4)
    val changed: SharedFlow<Unit> = _changed
    private val _last = MutableStateFlow<ArrivalNote?>(null)
    val lastArrival: StateFlow<ArrivalNote?> = _last

    init {
        scope.launch { c.navi.arrivals.collect { onArrival(it) } }
    }

    private suspend fun onArrival(a: NaviArrival) {
        if (!c.autoArrive.value) return
        // The arrival event carries only a name; the car's position lets a renamed destination still match within 150 m.
        val here = if (a.demo) null else runCatching { c.navi.currentLocation() }.getOrNull()
        val now = c.nowMs()
        val how = if (a.demo) VisitHow.DEMO_SIGNAL else VisitHow.NAVI_ARRIVED
        // Read the latest guiding target and write the result under the same lock, so a route started in the meantime
        // (or a trip deleted) is not confused with this arrival.
        val note = c.locked { repo ->
            val t = repo.load().trips.filter { it.overlay.guiding != null }.maxByOrNull { it.overlay.guiding!!.requestedAt } ?: return@locked null
            val g = t.overlay.guiding!!
            // On a multi-stop route ('오늘 경로 전송') the waypoints come first: the navigation's waypoint event, or the
            // demo signal while waypoints are still ahead. The stop is marked and the route goes on.
            val waypoint = if (a.waypoint || a.demo) TodayRoute.waypointArrived(t.overlay, a.name, here?.latE7, here?.lonE7, a.demo) else null
            if (waypoint != null) {
                repo.save(t.copy(overlay = t.overlay.arrivedWaypoint(waypoint, now, how)))
                return@locked ArrivalNote(t.localId, waypoint.visitId, waypoint.name, now, a.demo)
            }
            if (a.waypoint) return@locked null // a waypoint this app did not send: nothing to mark
            if (!a.demo && !ArrivalRule.matches(g, a.name, here?.latE7, here?.lonE7)) return@locked null
            repo.save(t.copy(overlay = t.overlay.arrived(g, now, how)))
            ArrivalNote(t.localId, g.visitId, g.name, now, a.demo)
        } ?: return
        _last.value = note
        _changed.tryEmit(Unit)
    }

    fun dismiss() { _last.value = null }
}

/** Arriving at a stop marks it visited; arriving at the night's lodging or the final destination just ends guiding. Either way the sent route is over. */
fun CarOverlay.arrived(g: GuidingTarget, now: Long, how: VisitHow): CarOverlay {
    val id = g.visitId ?: return copy(guiding = null, guidingStops = emptyList())
    return copy(visited = visited + id, visitedAt = visitedAt + (id to VisitStamp(now, how)), guiding = null, guidingStops = emptyList())
}
