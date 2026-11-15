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

/**
 * The next fixed stop: `ready` = arrival (no parking time); `slack` = fixed − ready (negative = late). Null values:
 * chain broken.
 */
data class FixedCheck(val visitId: String, val fixed: Int, val ready: Int?, val slack: Int?)

/** Skipping this optional stop saves at least `saves` minutes (its planned stay; the drive saved is not counted). */
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
    /** Charge/refuel recommendation from the car's energy reading + the day's remaining distance; null when none applies. */
    val energy: EnergyAdvisory? = null,
    /** Rough distance (km, straight lines) between the remaining stops and on to the day's end; null when coordinates are missing. */
    val remainKm: Int? = null,
)

object LiveProjection {
    /** Our own threshold for "빠듯": ten minutes or less to spare. */
    const val TIGHT_MINUTES = 10

    /**
     * `now` is the minute of day. `naviRemaining` is the navigation's remaining time to the next stop (only when it is
     * guiding to that same place); `hereToNext` is a one-off estimate from the car's position (`requestTrip`).
     */
    fun project(
        trip: Trip,
        overlay: CarOverlay,
        dayIndex: Int,
        now: Int,
        naviRemaining: Int? = null,
        hereToNext: Int? = null,
        vehicleKind: VehicleKind = VehicleKind.UNKNOWN,
        energyPercent: Int? = null,
        rangeKm: Int? = null,
        /** The navigation's estimate for the leg to the next stop (`requestTrip`): battery on arrival and road distance. */
        naviSocAtNext: Int? = null,
        nextLegMetres: Int? = null,
        driveMode: DriveMode? = null,
    ): Projection {
        val day = trip.days[dayIndex - 1]
        val order = day.visitOrder
        val visits = trip.visits.associateBy { it.visitId }
        // Deferred stops stay in the plan but are re-timed at the tail of today's remaining order (stable sort keeps
        // the plan's relative order within each group). A stop moved to another day drops out here; a stop moved INTO
        // this day is appended as [injected] below. With no deferral this is a no-op, so existing behaviour is unchanged.
        val remaining = order.indices
            .filter { order[it] !in overlay.visited && order[it] !in overlay.skipped && order[it] !in overlay.deferredTo }
            .sortedBy { if (order[it] in overlay.deferred) 1 else 0 }
        // Stops moved into this day from another day (deferredTo → this dayIndex): shown at the tail, time unknown
        // (no plan leg reaches them), ordered deterministically by visitId.
        val injected = overlay.deferredTo
            .filter { (id, d) -> d == dayIndex && id !in overlay.visited && id !in overlay.skipped && visits.containsKey(id) }
            .keys.sorted().map { visits.getValue(it) }
        val firstIdx = remaining.firstOrNull() ?: order.size
        // Position the car leaves from: the last visited stop before the next one (−1 = the day's start).
        val from = order.indices.lastOrNull { it < firstIdx && order[it] in overlay.visited } ?: -1
        var approximate = injected.isNotEmpty()
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
        // When the only stops left are injected (moved in from another day), the next stop has no plan leg → no "first".
        // Otherwise unchanged: with own stops it is the leg to the next one; with none left at all it is the leg to the day's end.
        val first = if (remaining.isEmpty() && injected.isNotEmpty()) null else (naviRemaining ?: hereToNext ?: legs(from, firstIdx))
        val basis = when {
            naviRemaining != null -> Basis.NAVI_LIVE
            hereToNext != null -> Basis.FROM_HERE
            first != null -> Basis.PLAN
            else -> Basis.NONE
        }
        val endBy = day.endBy?.let(TripValidator::minutes)

        if (remaining.isEmpty() && injected.isEmpty()) {
            val end = first?.let { now + it }
            val slack = if (endBy != null && end != null) endBy - end else null
            val kind = if (endBy != null) DeadlineKind.END_BY else DeadlineKind.NONE
            return Projection(dayIndex, null, end, basis, emptyList(), null, null, end, endBy, kind, slack, status(endBy != null, slack), approximate, null)
        }

        // This day's own stops (plan legs) followed by any injected cross-day stops (unknown legs, at the tail).
        val items = remaining.mapIndexed { i, idx -> visits.getValue(order[idx]) to (if (i == 0) first else legs(remaining[i - 1], idx)) } +
            injected.map { it to null as Int? }
        // Same rule as the plan check: a stop starts on arrival (no parking time). Measured visit records
        // (overlay.visitRecords) are not applied — they are groundwork for estimating real parking time later.
        val places = trip.places.associateBy { it.placeRef }
        val stops = TripValidator.walk(now, items)
        val tail = if (remaining.isEmpty()) null else legs(remaining.last(), order.size)
        val endExpected = stops.last().end?.let { e -> tail?.let { e + it } }
        val nextVisitId = items.firstOrNull()?.first?.visitId
        val plannedArrive = if (remaining.isEmpty()) null else TripValidator.timeline(trip, dayIndex, overlay).firstOrNull { it.visitId == order[firstIdx] }?.arrive
        val vsPlan = stops.first().arrive?.let { a -> plannedArrive?.let { a - it } }

        val fixedPos = items.indexOfFirst { it.first.fixed != null }
        val fixed = if (fixedPos < 0) null else {
            val v = items[fixedPos].first
            val f = TripValidator.minutes(v.fixed!!.time)
            val ready = stops[fixedPos].arrive
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
            // Late for the fixed stop: only optional stops before it help. Late for the return-by time: only stops after the
            // last fixed one help — time saved before a fixed stop is absorbed by waiting for it (its time re-anchors the day).
            val helps = if (deadlineKind == DeadlineKind.FIXED) 0 until fixedPos else (items.indexOfLast { it.first.fixed != null } + 1) until items.size
            helps.mapNotNull { i ->
                val v = items[i].first
                if (v.importance == Importance.OPTIONAL && v.fixed == null) (v.visitId to v.stayMinutes) else null
            }.filter { it.second >= late }.minByOrNull { it.second }
        }
        val skip = lateCand?.let { SkipSuggestion(it.first, it.second) }
        val defer = lateCand?.let { DeferSuggestion(it.first, it.second) }
        // 충전·주유 권장: rough remaining-day distance (km) from the remaining stops' coordinates (+ the day's end anchor).
        val remainKm = run {
            fun coord(ref: String?) = ref?.let { r -> places[r] }?.takeIf { it.latE7 != null && it.lonE7 != null }?.let { it.latE7!! to it.lonE7!! }
            val pts = remaining.mapNotNull { coord(visits.getValue(order[it]).placeRef) }.toMutableList()
            val endRef = if (dayIndex == trip.days.size) (trip.finalDestination as? Endpoint.AtPlace)?.placeRef else day.lodgingPlaceRef
            coord(endRef)?.let { pts.add(it) }
            if (pts.size < 2) null else (1 until pts.size).sumOf { metres(pts[it - 1].first, pts[it - 1].second, pts[it].first, pts[it].second) }.let { (it / 1000).toInt() }
        }
        val lodgingAhead = dayIndex != trip.days.size && day.lodgingPlaceRef != null
        // The battery at the end of today's route, from SOC + range + the navigation's estimate together (EV/PHEV only).
        val socAtDayEnd = if (vehicleKind == VehicleKind.EV || vehicleKind == VehicleKind.PHEV) EnergyOutlook.socAtDayEnd(energyPercent, rangeKm, remainKm, naviSocAtNext, nextLegMetres) else null
        val energy = EnergyPolicy.advise(vehicleKind, energyPercent, rangeKm, remainKm, lodgingAhead, socAtDayEnd, driveMode)
        return Projection(dayIndex, nextVisitId, stops.first().arrive, basis, stops, vsPlan, fixed, endExpected, endBy, deadlineKind, deadlineSlack, status, approximate, skip, defer, energy, remainKm)
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
