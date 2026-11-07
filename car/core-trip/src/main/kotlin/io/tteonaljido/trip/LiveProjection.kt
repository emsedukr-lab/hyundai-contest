package io.tteonaljido.trip

/**
 * "시간 지킴이": the rest of today's plan re-timed from the current minute, using the navigation's remaining time for
 * the leg being driven. It never edits the plan; it reports how the next fixed reservation (or the day's return-by
 * time) looks and may suggest skipping one optional stop.
 */
enum class Punctuality { ON_TIME, TIGHT, LATE, NO_DEADLINE, UNKNOWN }

/** Which deadline the status is measured against. */
enum class DeadlineKind { FIXED, END_BY, NONE }

/** Where the first leg's time came from. */
enum class Basis { NAVI_LIVE, FROM_HERE, PLAN, NONE }

/** The next fixed stop: `ready` = arrival + prep; `slack` = fixed − ready (negative = late). Null values: chain broken. */
data class FixedCheck(val visitId: String, val fixed: Int, val ready: Int?, val slack: Int?)

/** Skipping this optional stop saves at least `saves` minutes (its prep + stay; the drive saved is not counted). */
data class SkipSuggestion(val visitId: String, val saves: Int)

/** Doing this optional stop later (moved after the day's fixed stop) frees the same `saves` minutes before the deadline — but the stop still happens, at the tail of the day. */
data class DeferSuggestion(val visitId: String, val saves: Int)

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
    /** The binding deadline (the more urgent of the next fixed stop and the day's return-by time) and its slack. */
    val deadlineKind: DeadlineKind,
    val deadlineSlack: Int?,
    val status: Punctuality,
    /** A leg had to be bridged across skipped stops (sum of the legs through them: an upper bound). */
    val approximate: Boolean,
    val skip: SkipSuggestion?,
    /** Same candidate as [skip] when late, offered as "do it later" instead of dropping it. Null when nothing helps. */
    val defer: DeferSuggestion? = null,
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
        // Deferred stops stay in the plan but are re-timed at the tail of today's remaining order (stable sort keeps
        // the plan's relative order within each group). With no deferral this is a no-op, so existing behaviour is unchanged.
        val remaining = order.indices
            .filter { order[it] !in overlay.visited && order[it] !in overlay.skipped }
            .sortedBy { if (order[it] in overlay.deferred) 1 else 0 }
        val firstIdx = remaining.firstOrNull() ?: order.size
        // Position the car leaves from: the last visited stop before the next one (−1 = the day's start).
        val from = order.indices.lastOrNull { it < firstIdx && order[it] in overlay.visited } ?: -1
        var approximate = false
        // Plan legs from position a to position b (stop indices; −1 start, order.size end), through any stops in between.
        // A deferred stop can sit at a lower index than the stop before it in the re-timed order (b ≤ a); the plan has no
        // leg for that jump, so the chain is reported as unknown from there (honest "확인 필요" for the later, moved stops).
        fun legs(a: Int, b: Int): Int? {
            if (b <= a) { approximate = true; return null }
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
            val kind = if (endBy != null) DeadlineKind.END_BY else DeadlineKind.NONE
            return Projection(dayIndex, null, end, basis, emptyList(), null, null, end, endBy, kind, slack, status(endBy != null, slack), approximate, null)
        }

        val items = remaining.mapIndexed { i, idx -> visits.getValue(order[idx]) to (if (i == 0) first else legs(remaining[i - 1], idx)) }
        // Measured parking buffer / stay tendency (car-only input). Empty records → buffer 0 and mult 1.0, so the plan's
        // own timeline is unchanged; it activates once this trip has measurements. Never edits the plan.
        val places = trip.places.associateBy { it.placeRef }
        val isWeekend = runCatching { java.time.LocalDate.parse(day.date).dayOfWeek.let { it == java.time.DayOfWeek.SATURDAY || it == java.time.DayOfWeek.SUNDAY } }.getOrDefault(false)
        val stayMult = StayTendency.of(overlay.visitRecords) { id -> trip.visits.firstOrNull { it.placeRef == id }?.stayMinutes }
        val buffers: List<Int> = if (overlay.visitRecords.isEmpty()) List(items.size) { 0 }
            else items.map { (v, _) -> ParkingBufferPolicy.buffer(overlay.visitRecords, places[v.placeRef]?.category ?: PlaceCategory.OTHER, isWeekend, beforeFixed = v.fixed != null) }
        val stops = TripValidator.walk(now, items, { buffers.getOrElse(it) { 0 } }, stayMult)
        val tail = legs(remaining.last(), order.size)
        val endExpected = stops.last().end?.let { e -> tail?.let { e + it } }
        val plannedArrive = TripValidator.timeline(trip, dayIndex, overlay).firstOrNull { it.visitId == order[firstIdx] }?.arrive
        val vsPlan = stops.first().arrive?.let { a -> plannedArrive?.let { a - it } }

        val fixedPos = items.indexOfFirst { it.first.fixed != null }
        val fixed = if (fixedPos < 0) null else {
            val v = items[fixedPos].first
            val f = TripValidator.minutes(v.fixed!!.time)
            val ready = stops[fixedPos].arrive?.plus(v.prepMinutes + buffers.getOrElse(fixedPos) { 0 })
            FixedCheck(v.visitId, f, ready, ready?.let { f - it })
        }
        // Both a fixed stop and a return-by time can apply; the nearer-to-late one is what the driver is shown.
        val endSlack = if (endBy != null) endExpected?.let { endBy - it } else null
        val (deadlineKind, deadlineSlack) = when {
            fixed != null && endBy != null -> {
                val f = fixed.slack
                val e = endSlack
                when {
                    f != null && e != null -> if (e < f) DeadlineKind.END_BY to e else DeadlineKind.FIXED to f
                    f != null -> DeadlineKind.FIXED to f
                    e != null -> DeadlineKind.END_BY to e
                    else -> DeadlineKind.FIXED to null
                }
            }
            fixed != null -> DeadlineKind.FIXED to fixed.slack
            endBy != null -> DeadlineKind.END_BY to endSlack
            else -> DeadlineKind.NONE to null
        }
        val status = status(deadlineKind != DeadlineKind.NONE, deadlineSlack)
        // The best optional stop to shed before the deadline (already-deferred stops sit at the tail, so they are never
        // re-suggested). The same candidate can be either skipped (dropped) or deferred (done later) — the driver chooses.
        val lateCand: Pair<String, Int>? = if (status != Punctuality.LATE) null else {
            val late = -(deadlineSlack ?: 0)
            // Only optional stops before the fixed one (if any) help; a return-by deadline lets any optional stop help.
            val before = if (fixedPos >= 0) items.take(fixedPos) else items
            before.mapIndexedNotNull { i, (v, _) ->
                if (v.importance == Importance.OPTIONAL && v.fixed == null) (v.visitId to (v.prepMinutes + Math.round(v.stayMinutes * stayMult).toInt() + buffers.getOrElse(i) { 0 })) else null
            }.filter { it.second >= late }.minByOrNull { it.second }
        }
        val skip = lateCand?.let { SkipSuggestion(it.first, it.second) }
        val defer = lateCand?.let { DeferSuggestion(it.first, it.second) }
        return Projection(dayIndex, order[firstIdx], stops.first().arrive, basis, stops, vsPlan, fixed, endExpected, endBy, deadlineKind, deadlineSlack, status, approximate, skip, defer)
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
