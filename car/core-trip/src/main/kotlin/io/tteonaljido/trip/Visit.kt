// not used by the current screens or timetable — kept as the groundwork for estimating real parking time from
// NaviHelper + Vehicle SDK data (navigation ended → ignition off + belt released + doors locked) later.
package io.tteonaljido.trip

import kotlin.math.roundToInt
import kotlinx.serialization.Serializable

/**
 * 주차·체류 측정 (parking/stay measurement). A pure, SDK-free state machine fed by vehicle signals (distance, parking
 * brake, driver door, seat belt, power-down — and gear if the car exposes it) plus the navigation's arrival event.
 * It only measures: nothing here edits the user's plan. What is stored is transition *timestamps* and the pin-parking
 * distance — never raw signal values or coordinates (principle 2/5). Records live on [CarOverlay] so they are deleted
 * with the trip and never leave the car.
 */

@Serializable
enum class VisitState { IDLE, ARRIVED, PARKED, AWAY, RESUMED }

@Serializable
enum class VisitFlag { PARK_DELAYED, DROP_OFF, OUTLIER }

/** One measured visit. Durations are derived; only the transition instants (epoch millis) and pin distance are stored. */
@Serializable
data class VisitRecord(
    val tripId: String,
    val dayIndex: Int,
    val placeId: String,
    val category: PlaceCategory,
    val isWeekend: Boolean,
    val tArrive: Long,
    val tParked: Long? = null,
    val tOff: Long? = null,
    val tOn: Long? = null,
    val tDepart: Long? = null,
    val parkDistanceM: Int? = null,
    val flags: Set<VisitFlag> = emptySet(),
) {
    /** Navi arrival → actually parked, in minutes; null until parked. */
    val parkingMinutes: Int? get() = tParked?.let { ((it - tArrive) / 60_000L).toInt() }
    /** Parked → departed, in minutes; 0 for a drop-off; null until departed. */
    val stayMinutes: Int? get() = if (VisitFlag.DROP_OFF in flags) 0 else (if (tParked != null && tDepart != null) ((tDepart - tParked) / 60_000L).toInt() else null)
    val confirmed: Boolean get() = tDepart != null
}

/** An in-progress measurement, persisted so an AWAY (app closed / car asleep) resumes on the next launch. */
@Serializable
data class VisitProgress(val state: VisitState, val record: VisitRecord)

object VisitThresholds {
    /** Stationary (driving distance not increasing) this long before we treat it as parked. */
    const val STOP_MS = 20_000L
    /** Give up waiting to park after this and flag PARK_DELAYED (stay ARRIVED). */
    const val PARK_TIMEOUT_MS = 60 * 60_000L
    /** Engine on then off again within this window = a brief restart, still "away" (stay keeps counting). */
    const val QUICK_RESTART_MS = 5 * 60_000L
    /** An unfinished measurement older than this is finalized as an OUTLIER and excluded from stats. */
    const val OUTLIER_MS = 24 * 60 * 60_000L
    /** Pin ↔ parking distance cap. Reuses the navigation's "same place" radius (150 m). */
    const val PIN_METRES = PlaceMatch.SAME_METRES
    /** How many of {gear P, parking brake, driver door open, belt unbuckled} must agree to call it parked. */
    const val MIN_SIGNALS = 2
}

/** A snapshot of the read-only vehicle signals at one tick. Nulls mean "unsupported / unknown" (never crash). */
data class Signals(
    val distance: Double? = null,
    val gearPark: Boolean? = null,
    val parkingBrake: Boolean = false,
    val driverDoorOpen: Boolean = false,
    val seatBeltUnbuckled: Boolean = false,
    val pinDistanceM: Double? = null,
)

sealed interface VisitInput {
    /** Navigation reported arrival at the stop the record describes. */
    data class Arrived(val record: VisitRecord) : VisitInput
    /** Periodic signal snapshot. */
    data class Tick(val signals: Signals) : VisitInput
    data object PowerDown : VisitInput
    /** The app process is being torn down while parked (the "app close" hook). */
    data object AppClosing : VisitInput
    /** onRouteCancelled / onDestinationChanged — the trip to this stop is gone. */
    data object RouteGone : VisitInput
    /** Next boot: the vehicle service connected again. */
    data object Resumed : VisitInput
}

/** Progress plus the transient tracking the reducer needs (only [progress] is persisted at AWAY). */
data class VisitTrackerState(
    val progress: VisitProgress? = null,
    val lastDistance: Double? = null,
    val stoppedSince: Long? = null,
)

data class VisitStep(val state: VisitTrackerState, val finalized: VisitRecord? = null)

/** Pure reducer: `step(state, input, now) → (state, finalizedRecord?)`. No clock, no IO — `now` is supplied. */
object VisitTracker {
    private val T = VisitThresholds

    fun step(s: VisitTrackerState, input: VisitInput, now: Long): VisitStep {
        val phase = s.progress?.state ?: VisitState.IDLE
        val rec = s.progress?.record
        return when (input) {
            is VisitInput.Arrived -> VisitStep(VisitTrackerState(VisitProgress(VisitState.ARRIVED, input.record.copy(tArrive = now))))
            VisitInput.RouteGone -> if (phase == VisitState.ARRIVED) VisitStep(VisitTrackerState()) else VisitStep(s)
            VisitInput.AppClosing -> if (phase == VisitState.PARKED && rec != null) VisitStep(s.copy(progress = VisitProgress(VisitState.AWAY, rec.copy(tOff = now)))) else VisitStep(s)
            VisitInput.PowerDown -> when {
                phase == VisitState.PARKED && rec != null -> VisitStep(s.copy(progress = VisitProgress(VisitState.AWAY, rec.copy(tOff = now))))
                // Engine off again shortly after a resume: a brief restart, stay away and keep the original tOff.
                phase == VisitState.RESUMED && rec?.tOn != null && now - rec.tOn < T.QUICK_RESTART_MS -> VisitStep(VisitTrackerState(VisitProgress(VisitState.AWAY, rec)))
                else -> VisitStep(s)
            }
            VisitInput.Resumed -> when {
                phase != VisitState.AWAY || rec == null -> VisitStep(s)
                now - rec.tArrive > T.OUTLIER_MS -> VisitStep(VisitTrackerState(), rec.copy(flags = rec.flags + VisitFlag.OUTLIER, tDepart = now))
                else -> VisitStep(VisitTrackerState(VisitProgress(VisitState.RESUMED, rec.copy(tOn = now))))
            }
            is VisitInput.Tick -> tick(s, phase, rec, input.signals, now)
        }
    }

    private fun tick(s: VisitTrackerState, phase: VisitState, rec: VisitRecord?, sig: Signals, now: Long): VisitStep {
        val moving = sig.distance != null && s.lastDistance != null && sig.distance > s.lastDistance
        val newLast = sig.distance ?: s.lastDistance
        when (phase) {
            VisitState.ARRIVED -> {
                if (rec == null) return VisitStep(s.copy(lastDistance = newLast))
                val stoppedSince = if (moving) null else (s.stoppedSince ?: now)
                // 60분이 지나도 못 세우면 '지연'만 표시하고 ARRIVED 유지.
                val delayed = now - rec.tArrive >= T.PARK_TIMEOUT_MS && VisitFlag.PARK_DELAYED !in rec.flags
                val recNow = if (delayed) rec.copy(flags = rec.flags + VisitFlag.PARK_DELAYED) else rec
                val signalCount = listOf(sig.gearPark == true, sig.parkingBrake, sig.driverDoorOpen, sig.seatBeltUnbuckled).count { it }
                val stationaryLong = stoppedSince != null && now - stoppedSince >= T.STOP_MS
                val nearPin = sig.pinDistanceM != null && sig.pinDistanceM <= T.PIN_METRES
                return if (stationaryLong && signalCount >= T.MIN_SIGNALS && nearPin) {
                    VisitStep(VisitTrackerState(VisitProgress(VisitState.PARKED, recNow.copy(tParked = now, parkDistanceM = sig.pinDistanceM!!.roundToInt())), lastDistance = newLast))
                } else {
                    VisitStep(VisitTrackerState(VisitProgress(VisitState.ARRIVED, recNow), lastDistance = newLast, stoppedSince = stoppedSince))
                }
            }
            VisitState.PARKED -> {
                // 시동 OFF 없이 문 닫고 다시 움직이면 드롭오프(체류 0).
                if (moving && !sig.driverDoorOpen && rec != null) return VisitStep(VisitTrackerState(lastDistance = newLast), rec.copy(flags = rec.flags + VisitFlag.DROP_OFF, tDepart = now))
                return VisitStep(s.copy(lastDistance = newLast))
            }
            VisitState.RESUMED -> {
                if (moving && rec != null) return VisitStep(VisitTrackerState(lastDistance = newLast), rec.copy(tDepart = now))
                return VisitStep(s.copy(lastDistance = newLast))
            }
            else -> return VisitStep(s.copy(lastDistance = newLast))
        }
    }
}
