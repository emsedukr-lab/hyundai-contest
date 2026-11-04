package io.tteonaljido.trip

import java.time.LocalDate

/** Where "다음 목적지 안내" should go, decided from the plan and what the car has seen; never guessed. */
sealed interface Target {
    val label: String

    data class Stop(val visitId: String, val place: Place, override val label: String) : Target
    data class Lodging(val place: Place, override val label: String) : Target
    data class Final(val endpoint: Endpoint, val place: Place?, override val label: String) : Target
}

data class NextStep(val dayIndex: Int, val target: Target?, val note: String)

object NextDestination {
    fun dayIndexFor(trip: Trip, today: LocalDate): Int? {
        val n = today.toEpochDay() - LocalDate.parse(trip.startDate).toEpochDay() + 1
        return if (n in 1..trip.days.size) n.toInt() else null
    }

    /** First not-yet-visited stop of the given day; then that night's lodging, or the final destination on the last day. */
    fun of(trip: Trip, overlay: CarOverlay, dayIndex: Int): NextStep {
        val day = trip.days[dayIndex - 1]
        val places = trip.places.associateBy { it.placeRef }
        val stop = day.visitOrder.firstOrNull { it !in overlay.visited }
        if (stop != null) {
            val v = trip.visits.first { it.visitId == stop }
            val p = places.getValue(v.placeRef)
            return NextStep(dayIndex, Target.Stop(stop, p, p.name), v.fixed?.let { "고정 ${it.time}" } ?: "")
        }
        val isLast = dayIndex == trip.days.size
        if (!isLast) {
            val lodging = day.lodgingPlaceRef?.let(places::get)
                ?: return NextStep(dayIndex, null, "${dayIndex}일차 숙소가 정해지지 않았어요")
            return NextStep(dayIndex, Target.Lodging(lodging, lodging.name), "오늘 묵을 곳")
        }
        val end = trip.finalDestination
        val place = (end as? Endpoint.AtPlace)?.let { places[it.placeRef] }
        return NextStep(dayIndex, Target.Final(end, place, place?.name ?: "집"), "마지막 날 귀가")
    }
}
