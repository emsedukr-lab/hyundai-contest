package io.tteonaljido.trip

import java.time.LocalDate

/** Where "다음 목적지 안내" should go, decided from the plan and what the car has seen; never guessed. */
sealed interface Target {
    val label: String

    data class Stop(val visitId: String, val place: Place, override val label: String) : Target
    data class Lodging(val place: Place, override val label: String) : Target
    data class Final(val endpoint: Endpoint, val place: Place?, override val label: String) : Target
}

/** `note` is Korean; apps localize from `noteCode` + `noteArgs` (strings `next_<code>`). */
data class NextStep(val dayIndex: Int, val target: Target?, val note: String, val noteCode: String = "", val noteArgs: List<String> = emptyList())

/** The trip day a moment belongs to and its minute counted from that day's midnight. */
data class TripMoment(val dayIndex: Int, val minute: Int)

object NextDestination {
    /** Just past midnight the car is often still driving to that night's lodging: until 04:00 it is still the previous day. */
    const val GRACE_MINUTES = 4 * 60

    fun dayIndexFor(trip: Trip, today: LocalDate): Int? {
        val n = today.toEpochDay() - LocalDate.parse(trip.startDate).toEpochDay() + 1
        return if (n in 1..trip.days.size) n.toInt() else null
    }

    /**
     * Which trip day [epochMs] falls on (in the trip's zone) and its minute counted from that day's midnight. Before
     * 04:00 the previous trip day goes on and the minute runs past 1440 (00:30 → 1470), so the day's times and deadlines
     * still compare correctly. If there was no previous trip day (an early start on day 1), it is simply that day.
     */
    fun momentOf(trip: Trip, epochMs: Long): TripMoment? {
        val t = java.time.Instant.ofEpochMilli(epochMs).atZone(trip.zoneOrUtc())
        val minute = t.hour * 60 + t.minute
        if (minute < GRACE_MINUTES) dayIndexFor(trip, t.toLocalDate().minusDays(1))?.let { return TripMoment(it, minute + 1440) }
        return dayIndexFor(trip, t.toLocalDate())?.let { TripMoment(it, minute) }
    }

    /**
     * Today's remaining stops in guidance order: unvisited and unskipped, with "do later today" stops at the tail. A stop
     * moved to another day ([CarOverlay.deferredTo]) drops out of its own day; a stop moved INTO this day is appended at
     * the tail (its time is unknown — no plan leg leads to it). With no deferral this is just the plan's order.
     */
    fun upcoming(trip: Trip, overlay: CarOverlay, dayIndex: Int): List<String> {
        val own = trip.days[dayIndex - 1].visitOrder
            .filter { it !in overlay.visited && it !in overlay.skipped && it !in overlay.deferredTo }
            .sortedBy { if (it in overlay.deferred) 1 else 0 }
        val valid = trip.visits.mapTo(HashSet()) { it.visitId }
        val injected = overlay.deferredTo
            .filter { (id, d) -> d == dayIndex && id !in overlay.visited && id !in overlay.skipped && id in valid }
            .keys.sorted()
        return own + injected
    }

    /**
     * Where the given day ends: that night's lodging, or the trip's final destination on the last day. Null when the
     * night's lodging is not decided. It does not depend on what has been visited or skipped — the day ends there
     * whatever happens to the stops before it.
     */
    fun endOf(trip: Trip, dayIndex: Int): Target? {
        val places = trip.places.associateBy { it.placeRef }
        if (dayIndex < trip.days.size) return trip.days[dayIndex - 1].lodgingPlaceRef?.let(places::get)?.let { Target.Lodging(it, it.name) }
        val end = trip.finalDestination
        val place = (end as? Endpoint.AtPlace)?.let { places[it.placeRef] }
        return Target.Final(end, place, place?.name ?: "집")
    }

    /** First stop of the given day neither visited nor skipped (deferred stops go to the tail); then where the day ends ([endOf]). */
    fun of(trip: Trip, overlay: CarOverlay, dayIndex: Int): NextStep {
        val places = trip.places.associateBy { it.placeRef }
        val stop = upcoming(trip, overlay, dayIndex).firstOrNull()
        if (stop != null) {
            val v = trip.visits.first { it.visitId == stop }
            val p = places.getValue(v.placeRef)
            return NextStep(dayIndex, Target.Stop(stop, p, p.name), v.fixed?.let { "고정 ${it.time}" } ?: "", if (v.fixed != null) "FIXED" else "", listOfNotNull(v.fixed?.time))
        }
        return when (val end = endOf(trip, dayIndex)) {
            null -> NextStep(dayIndex, null, "${dayIndex}일차 숙소가 정해지지 않았어요", "NO_LODGING", listOf("$dayIndex"))
            is Target.Final -> NextStep(dayIndex, end, "마지막 날 귀가", "RETURN")
            else -> NextStep(dayIndex, end, "오늘 묵을 곳", "LODGING")
        }
    }
}
