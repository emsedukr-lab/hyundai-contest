// M42: not used by the current screens or timetable — kept as the groundwork for estimating real parking time from
// NaviHelper + Vehicle SDK data (navigation ended → ignition off + belt released + doors locked) later.
package io.tteonaljido.car.visit

import io.tteonaljido.trip.VisitInput
import io.tteonaljido.trip.VisitProgress
import io.tteonaljido.trip.VisitRecord
import io.tteonaljido.trip.VisitState
import io.tteonaljido.trip.VisitTracker
import io.tteonaljido.trip.VisitTrackerState

/**
 * Drives the pure [VisitTracker] from inputs and owns the two side effects: it persists synchronously the moment a
 * measurement becomes AWAY (the process may die right after), and confirms + clears a finalized record. App-scoped
 * (owned by the Container, like `GuidanceTracker`) — no foreground service, so measurement runs only while the app
 * process is alive and resumes from the persisted AWAY snapshot on the next launch. The flow/tick wiring that calls
 * [apply] (merging vehicle signals + navigation arrivals) lives in the Container adapter (phase 2); this class holds
 * the testable logic.
 */
class VisitCollector(
    recovered: VisitProgress?,
    private val persistProgress: (VisitProgress?) -> Unit,
    private val confirm: (VisitRecord) -> Unit,
) {
    var state: VisitTrackerState = VisitTrackerState(progress = recovered)
        private set

    /** Call once at startup after loading `overlay.visitProgress`: resume an interrupted AWAY measurement. */
    fun start(now: Long) {
        if (state.progress?.state == VisitState.AWAY) apply(VisitInput.Resumed, now)
    }

    /** Feed one input; persists on reaching AWAY, confirms + clears the persisted snapshot on a finalized record. */
    fun apply(input: VisitInput, now: Long) {
        val step = VisitTracker.step(state, input, now)
        state = step.state
        if (state.progress?.state == VisitState.AWAY) persistProgress(state.progress)
        step.finalized?.let {
            confirm(it)
            persistProgress(null)
        }
    }
}
