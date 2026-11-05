package io.tteonaljido.car.guide

import io.tteonaljido.car.Container
import io.tteonaljido.car.navi.NaviArrival
import io.tteonaljido.trip.ArrivalRule
import io.tteonaljido.trip.CarOverlay
import io.tteonaljido.trip.GuidingTarget
import io.tteonaljido.trip.VisitHow
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
        scope.launch { c.navi.arrivals.collect(::onArrival) }
    }

    private fun onArrival(a: NaviArrival) {
        if (!c.autoArrive.value) return
        val t = c.trips().load().trips.filter { it.overlay.guiding != null }.maxByOrNull { it.overlay.guiding!!.requestedAt } ?: return
        val g = t.overlay.guiding!!
        if (!a.demo && !ArrivalRule.matches(g, a.name, null, null)) return
        val now = c.nowMs()
        c.updateTrip(t.localId) { it.copy(overlay = it.overlay.arrived(g, now, if (a.demo) VisitHow.DEMO_SIGNAL else VisitHow.NAVI_ARRIVED)) } ?: return
        _last.value = ArrivalNote(t.localId, g.visitId, g.name, now, a.demo)
        _changed.tryEmit(Unit)
    }

    fun dismiss() { _last.value = null }
}

/** Arriving at a stop marks it visited; arriving at the night's lodging or the final destination just ends guiding. */
fun CarOverlay.arrived(g: GuidingTarget, now: Long, how: VisitHow): CarOverlay {
    val id = g.visitId ?: return copy(guiding = null)
    return copy(visited = visited + id, visitedAt = visitedAt + (id to VisitStamp(now, how)), guiding = null)
}
