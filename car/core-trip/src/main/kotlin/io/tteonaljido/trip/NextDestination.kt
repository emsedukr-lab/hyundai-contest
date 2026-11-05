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

object NextDestination {
    fun dayIndexFor(trip: Trip, today: LocalDate): Int? {
        val n = today.toEpochDay() - LocalDate.parse(trip.startDate).toEpochDay() + 1
        return if (n in 1..trip.days.size) n.toInt() else null
    }

    /** First stop of the given day neither visited nor skipped; then that night's lodging, or the final destination on the last day. */
    fun of(trip: Trip, overlay: CarOverlay, dayIndex: Int): NextStep {
        val day = trip.days[dayIndex - 1]
        val places = trip.places.associateBy { it.placeRef }
        val stop = day.visitOrder.firstOrNull { it !in overlay.visited && it !in overlay.skipped }
        if (stop != null) {
            val v = trip.visits.first { it.visitId == stop }
            val p = places.getValue(v.placeRef)
            return NextStep(dayIndex, Target.Stop(stop, p, p.name), v.fixed?.let { "고정 ${it.time}" } ?: "", if (v.fixed != null) "FIXED" else "", listOfNotNull(v.fixed?.time))
        }
        val isLast = dayIndex == trip.days.size
        if (!isLast) {
            val lodging = day.lodgingPlaceRef?.let(places::get)
                ?: return NextStep(dayIndex, null, "${dayIndex}일차 숙소가 정해지지 않았어요", "NO_LODGING", listOf("$dayIndex"))
            return NextStep(dayIndex, Target.Lodging(lodging, lodging.name), "오늘 묵을 곳", "LODGING")
        }
        val end = trip.finalDestination
        val place = (end as? Endpoint.AtPlace)?.let { places[it.placeRef] }
        return NextStep(dayIndex, Target.Final(end, place, place?.name ?: "집"), "마지막 날 귀가", "RETURN")
    }
}
