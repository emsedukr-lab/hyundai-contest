package io.tteonaljido.trip

/**
 * "시간 지킴이": the rest of today's plan re-timed from the current minute, using the navigation's remaining time for
 * the leg being driven. It never edits the plan; it reports how the next fixed reservation (or the day's return-by
 * time) looks and may suggest skipping one optional stop.
 */
enum class Punctuality { ON_TIME, TIGHT, LATE, NO_DEADLINE, UNKNOWN }

/** Where the first leg's time came from. */
enum class Basis { NAVI_LIVE, FROM_HERE, PLAN, NONE }

/** The next fixed stop: `ready` = arrival + prep; `slack` = fixed − ready (negative = late). Null values: chain broken. */
data class FixedCheck(val visitId: String, val fixed: Int, val ready: Int?, val slack: Int?)

/** Skipping this optional stop saves at least `saves` minutes (its prep + stay; the drive saved is not counted). */
data class SkipSuggestion(val visitId: String, val saves: Int)

data class Projection(
    val dayIndex: Int,
    /** Null when every stop is done and the car heads to the night's lodging or the final destination. */
    val nextVisitId: String?,
    /** Minute of day the car reaches the next stop (or the day's end). */
    val arriveNext: Int?,
    val basis: Basis,
    val stops: List<StopTime>,
    /** Arrival at the next stop compared with the plan's own timeline (+ later, − earlier). */
    val vsPlan: Int?,
    val fixed: FixedCheck?,
    val endExpected: Int?,
    val endBy: Int?,
    val status: Punctuality,
    /** A leg had to be bridged across skipped stops (sum of the legs through them: an upper bound). */
    val approximate: Boolean,
    val skip: SkipSuggestion?,
)

object LiveProjection {
    /** Our own threshold for "빠듯": ten minutes or less to spare. */
    const val TIGHT_MINUTES = 10

    /**
     * `now` is the minute of day. `naviRemaining` is the navigation's remaining time to the next stop (only when it is
     * guiding to that same place); `hereToNext` is a one-off estimate from the car's position (`requestTrip`).
     */
    fun project(trip: Trip, overlay: CarOverlay, dayIndex: Int, now: Int, naviRemaining: Int? = null, hereToNext: Int? = null): Projection {
        val day = trip.days[dayIndex - 1]
        val order = day.visitOrder
        val visits = trip.visits.associateBy { it.visitId }
        val remaining = order.indices.filter { order[it] !in overlay.visited && order[it] !in overlay.skipped }
        val firstIdx = remaining.firstOrNull() ?: order.size
        // Position the car leaves from: the last visited stop before the next one (−1 = the day's start).
        val from = order.indices.lastOrNull { it < firstIdx && order[it] in overlay.visited } ?: -1
        var approximate = false
        // Plan legs from position a to position b (stop indices; −1 start, order.size end), through any stops in between.
        fun legs(a: Int, b: Int): Int? {
            var sum = 0
            for (k in (a + 1)..b) sum += (TripValidator.leg(trip, overlay, dayIndex, k) ?: return null).minutes
            if (b - a > 1) approximate = true
            return sum
        }
        val first = naviRemaining ?: hereToNext ?: legs(from, firstIdx)
        val basis = when {
            naviRemaining != null -> Basis.NAVI_LIVE
            hereToNext != null -> Basis.FROM_HERE
            first != null -> Basis.PLAN
            else -> Basis.NONE
        }
        val endBy = day.endBy?.let(TripValidator::minutes)

        if (remaining.isEmpty()) {
            val end = first?.let { now + it }
            val slack = if (endBy != null && end != null) endBy - end else null
            return Projection(dayIndex, null, end, basis, emptyList(), null, null, end, endBy, status(endBy != null, slack), approximate, null)
        }

        val items = remaining.mapIndexed { i, idx -> visits.getValue(order[idx]) to (if (i == 0) first else legs(remaining[i - 1], idx)) }
        val stops = TripValidator.walk(now, items)
        val tail = legs(remaining.last(), order.size)
        val endExpected = stops.last().end?.let { e -> tail?.let { e + it } }
        val plannedArrive = TripValidator.timeline(trip, dayIndex, overlay).firstOrNull { it.visitId == order[firstIdx] }?.arrive
        val vsPlan = stops.first().arrive?.let { a -> plannedArrive?.let { a - it } }

        val fixedPos = items.indexOfFirst { it.first.fixed != null }
        val fixed = if (fixedPos < 0) null else {
            val v = items[fixedPos].first
            val f = TripValidator.minutes(v.fixed!!.time)
            val ready = stops[fixedPos].arrive?.plus(v.prepMinutes)
            FixedCheck(v.visitId, f, ready, ready?.let { f - it })
        }
        val status = when {
            fixed != null -> status(true, fixed.slack)
            endBy != null -> status(true, endExpected?.let { endBy - it })
            else -> Punctuality.NO_DEADLINE
        }
        val skip = if (status != Punctuality.LATE) null else {
            val late = -(fixed?.slack ?: endExpected?.let { endBy!! - it } ?: 0)
            val before = if (fixedPos >= 0) items.take(fixedPos) else items
            before.map { it.first }
                .filter { it.importance == Importance.OPTIONAL && it.fixed == null }
                .map { SkipSuggestion(it.visitId, it.prepMinutes + it.stayMinutes) }
                .filter { it.saves >= late }
                .minByOrNull { it.saves }
        }
        return Projection(dayIndex, order[firstIdx], stops.first().arrive, basis, stops, vsPlan, fixed, endExpected, endBy, status, approximate, skip)
    }

    private fun status(hasDeadline: Boolean, slack: Int?): Punctuality = when {
        !hasDeadline -> Punctuality.NO_DEADLINE
        slack == null -> Punctuality.UNKNOWN
        slack < 0 -> Punctuality.LATE
        slack <= TIGHT_MINUTES -> Punctuality.TIGHT
        else -> Punctuality.ON_TIME
    }
}

/** Matches the navigation's arrival event to what this app asked it to guide to (the event carries no coordinates). */
object ArrivalRule {
    fun matches(guiding: GuidingTarget, arrivedName: String?, hereLatE7: Int?, hereLonE7: Int?): Boolean {
        if (!arrivedName.isNullOrBlank() && arrivedName.trim() == guiding.name.trim()) return true
        if (hereLatE7 == null || hereLonE7 == null) return false
        return metres(guiding.latE7, guiding.lonE7, hereLatE7, hereLonE7) <= PlaceMatch.SAME_METRES
    }
}
