package io.tteonaljido.trip

/**
 * M63: in the car, the Hyundai navigation is what times, measures and orders the trip.
 *
 * The navigation has no "from A to B" query: `requestTrip` only answers from where the car stands. A route with
 * waypoints does carry more: once it has started, the navigation reports what is left to every waypoint and to the
 * destination, counted from the car, and the difference of two neighbours is the leg between them
 * (docs/evidence/navi-waypoints). So a leg the car is nowhere near (home → the first night's lodging, stop → stop on
 * day 3) is measured by laying its two ends next to each other on a route, reading the numbers and cancelling the route.
 *
 *  - [NaviMeasure] plans those routes and turns the readings into leg times and distances ([CarOverlay.legEstimates]).
 *  - [RouteOptimizer] picks the day's fastest order from the measured legs.
 *  - [CarOrder] lays an order chosen in the car over the phone's plan, which itself is never edited.
 */
object CarOrder {
    /** The car's order for a day, only while it still is a reordering of exactly that day's stops. */
    fun of(trip: Trip, overlay: CarOverlay, dayIndex: Int): List<String>? {
        val wanted = overlay.orderOverrides[dayIndex] ?: return null
        val plan = trip.days.getOrNull(dayIndex - 1)?.visitOrder ?: return null
        return wanted.takeIf { it != plan && it.size == plan.size && it.toSet() == plan.toSet() }
    }

    /** The plan as the car follows it: `plan` with every valid [CarOverlay.orderOverrides] applied (the same object when there is none). */
    fun apply(plan: Trip, overlay: CarOverlay): Trip {
        if (overlay.orderOverrides.isEmpty()) return plan
        var changed = false
        val days = plan.days.map { d ->
            val order = of(plan, overlay, d.dayIndex) ?: return@map d
            changed = true
            d.copy(visitOrder = order, legs = relaid(plan, d, order))
        }
        return if (changed) plan.copy(days = days) else plan
    }

    /**
     * A plan leg survives a reordering only where the same two places still follow each other (null stands for the
     * day's start and end, which no order moves). Every other leg is left empty for the navigation's measurement.
     */
    private fun relaid(plan: Trip, day: Day, order: List<String>): List<Leg?> {
        fun ref(id: String) = plan.visits.first { it.visitId == id }.placeRef
        fun ends(o: List<String>) = (0..o.size).map { k -> (if (k == 0) null else ref(o[k - 1])) to (if (k == o.size) null else ref(o[k])) }
        val planned = ends(day.visitOrder).zip(day.legs).toMap()
        return ends(order).map { planned[it] }
    }
}

object NaviMeasure {
    /**
     * Waypoints per measuring route. The SDK only names two (`WaypointIndex.FIRST`, `SECOND`); the emulator's navigation
     * carried nine in the order sent. What a real car's navigation takes is not known, so the caller reads back how
     * many it kept and plans the rest with that number.
     */
    const val MAX_WAYPOINTS = 9

    /** Two ends closer than this are one spot: the leg is zero without asking (the navigation refuses such a route; same rule as the phone's server). */
    const val SAME_SPOT_METRES = 30.0

    /** [LegEstimate.source] of a leg read off a waypoint route (a `requestTrip` answer is "NAVI"). */
    const val SOURCE = "NAVI_ROUTE"

    /** One end of a leg the car can point the navigation at. `key` is the end's name in [LegKeys]. */
    data class Point(val key: String, val latE7: Int, val lonE7: Int)

    data class Edge(val from: Point, val to: Point) {
        val key: String get() = "${from.key}>${to.key}"
        val sameSpot: Boolean get() = metres(from.latE7, from.lonE7, to.latE7, to.lonE7) < SAME_SPOT_METRES
    }

    /** What the navigation says is left to one point of a route, counted from the car (seconds, metres). */
    data class Reading(val seconds: Int, val metres: Int)

    fun point(trip: Trip, overlay: CarOverlay, key: String, dayIndex: Int): Point? {
        val at: Pair<Int, Int>? = when (key) {
            LegKeys.ORIGIN -> overlay.originFor(trip, dayIndex)?.let { it.latE7 to it.lonE7 }
            LegKeys.HOME -> overlay.home?.let { it.latE7 to it.lonE7 } ?: trip.home?.let { it.latE7 to it.lonE7 }
            else -> overlay.poiBindings[key]?.let { it.latE7 to it.lonE7 }
                ?: trip.places.firstOrNull { it.placeRef == key }?.let { p -> p.latE7?.let { la -> p.lonE7?.let { lo -> la to lo } } }
        }
        return at?.let { Point(key, it.first, it.second) }
    }

    private fun stops(trip: Trip, overlay: CarOverlay, dayIndex: Int): List<Point?> =
        trip.days[dayIndex - 1].visitOrder.map { id -> point(trip, overlay, trip.visits.first { it.visitId == id }.placeRef, dayIndex) }

    private fun start(trip: Trip, overlay: CarOverlay, dayIndex: Int) = LegKeys.dayStart(trip, overlay, dayIndex)?.let { point(trip, overlay, it, dayIndex) }
    private fun end(trip: Trip, overlay: CarOverlay, dayIndex: Int) = LegKeys.dayEnd(trip, dayIndex)?.let { point(trip, overlay, it, dayIndex) }

    /** The legs of one day in its order, where both ends are points the car knows (a name-only place or an unknown home leaves a gap). */
    fun dayLegs(trip: Trip, overlay: CarOverlay, dayIndex: Int): List<Edge> {
        val points = listOf(start(trip, overlay, dayIndex)) + stops(trip, overlay, dayIndex) + end(trip, overlay, dayIndex)
        return points.zipWithNext().mapNotNull { (a, b) -> if (a != null && b != null) Edge(a, b) else null }
    }

    /** Every leg of the trip from `fromDay` on, in driving order. */
    fun tripLegs(trip: Trip, overlay: CarOverlay, fromDay: Int = 1): List<Edge> =
        (fromDay.coerceAtLeast(1)..trip.days.size).flatMap { dayLegs(trip, overlay, it) }

    /** Every leg some order of the day's stops could use: start → each stop, stop → stop both ways, each stop → end. */
    fun dayMatrix(trip: Trip, overlay: CarOverlay, dayIndex: Int): List<Edge> {
        val stops = stops(trip, overlay, dayIndex).filterNotNull()
        val out = mutableListOf<Edge>()
        start(trip, overlay, dayIndex)?.let { s -> stops.forEach { out += Edge(s, it) } }
        stops.forEach { a -> stops.forEach { b -> if (a != b) out += Edge(a, b) } }
        end(trip, overlay, dayIndex)?.let { e -> stops.forEach { out += Edge(it, e) } }
        return out.distinct()
    }

    /** Legs that need no route: both ends are one spot. */
    fun zeroLegs(edges: List<Edge>, at: Long): Map<String, LegEstimate> =
        edges.filter { it.sameSpot }.associate { it.key to LegEstimate(0, 0, at, SOURCE) }

    /**
     * Routes that between them drive every edge once: each is the points in driving order, at most `maxWaypoints`
     * waypoints and the destination. Edges that continue where the route stands are strung together; when none does,
     * the route hops to the next wanted edge's start — that hop costs one leg of this route, a new route costs a whole
     * request (about ten seconds, docs/evidence/navi-waypoints).
     * `atCar` marks a point where the car stands: every route starts from the car anyway, so an edge leaving such a
     * point opens a route (it then costs no waypoint) and is never hopped to (the route would drive back to where it began).
     */
    fun chains(edges: List<Edge>, maxWaypoints: Int = MAX_WAYPOINTS, atCar: (Point) -> Boolean = { false }): List<List<Point>> {
        val max = maxWaypoints.coerceAtLeast(1) + 1
        val left = LinkedHashSet(edges.filterNot { it.sameSpot })
        val out = mutableListOf<List<Point>>()
        while (left.isNotEmpty()) {
            val first = (left.firstOrNull { atCar(it.from) } ?: left.first()).also(left::remove)
            val chain = mutableListOf(first.from, first.to)
            while (chain.size < max) {
                val last = chain.last()
                val next = left.firstOrNull { it.from == last }
                if (next != null) {
                    chain += next.to
                    left.remove(next)
                    continue
                }
                val far = left.firstOrNull { !atCar(it.from) } ?: break
                // No room for the hop and the edge, or the hop itself would be a zero-length leg: start a new route.
                if (chain.size + 2 > max || Edge(last, far.from).sameSpot) break
                chain += far.from
                chain += far.to
                left.remove(far)
            }
            out += chain
        }
        return out
    }

    /**
     * The legs between a route's points, from the navigation's readings for those points (one per point, in order).
     * A leg is kept only where the numbers add up: the later point is further along in time and not nearer in distance.
     * Seconds round up to minutes, like every other time from the navigation.
     */
    fun legs(chain: List<Point>, readings: List<Reading>, at: Long): Map<String, LegEstimate> {
        if (readings.size != chain.size) return emptyMap()
        return (1 until chain.size).mapNotNull { i ->
            val seconds = readings[i].seconds - readings[i - 1].seconds
            val metres = readings[i].metres - readings[i - 1].metres
            if (seconds <= 0 || metres < 0) null else "${chain[i - 1].key}>${chain[i].key}" to LegEstimate((seconds + 59) / 60, metres, at, SOURCE)
        }.toMap()
    }

    /** How much of the trip (from `fromDay`) the navigation has timed: legs with a navigation time / legs it could time. */
    data class Coverage(val measured: Int, val total: Int, val latestAt: Long?)

    fun coverage(trip: Trip, overlay: CarOverlay, fromDay: Int = 1): Coverage {
        val legs = tripLegs(trip, overlay, fromDay)
        val got = legs.mapNotNull { overlay.legEstimates[it.key] }
        return Coverage(got.size, legs.size, got.maxOfOrNull { it.at })
    }
}

/**
 * The day's fastest order by the navigation's own times (M63). Same bar as the phone's 더 빠른 순서: it has to save at
 * least [MIN_SAVED] minutes of driving, add no timetable conflict and leave no more fixed times short of their margin.
 */
object RouteOptimizer {
    const val MIN_SAVED = 10
    /** A fixed time counts as short when the car would arrive less than this before it. */
    const val FIXED_MARGIN = 15
    /** Every order is tried, so the day is capped (8 stops = 40,320 orders). */
    const val MAX_STOPS = 8

    enum class Why { FEW_STOPS, TOO_MANY, STARTED, OPEN_ENDS }

    sealed interface Outcome {
        /** Nothing to compare: fewer than two stops, too many, a day already under way, or a start/end the car cannot place. */
        data class NotApplicable(val why: Why) : Outcome
        /** `missing` legs some order would use have no navigation time yet. */
        data class NeedsMeasure(val missing: Int) : Outcome
        /** The order the day already has is the fastest that fits (or within [MIN_SAVED] of it). */
        data class Best(val minutes: Int, val metres: Int) : Outcome
        data class Faster(val order: List<String>, val minutes: Int, val metres: Int, val savedMinutes: Int, val savedMetres: Int) : Outcome
    }

    private data class Cost(val minutes: Int, val metres: Int)

    fun suggest(plan: Trip, overlay: CarOverlay, dayIndex: Int): Outcome {
        val trip = CarOrder.apply(plan, overlay)
        val day = trip.days.getOrNull(dayIndex - 1) ?: return Outcome.NotApplicable(Why.FEW_STOPS)
        val order = day.visitOrder
        if (order.size < 2) return Outcome.NotApplicable(Why.FEW_STOPS)
        if (order.size > MAX_STOPS) return Outcome.NotApplicable(Why.TOO_MANY)
        // Once a stop is done, skipped or moved, the day is being driven: its order is the driver's from here on.
        val touched = order.any { it in overlay.visited || it in overlay.skipped || it in overlay.deferred || it in overlay.deferredTo } || overlay.deferredTo.values.any { it == dayIndex }
        if (touched) return Outcome.NotApplicable(Why.STARTED)
        val startKey = LegKeys.dayStart(trip, overlay, dayIndex)
        val endKey = LegKeys.dayEnd(trip, dayIndex)
        if (startKey == null || endKey == null) return Outcome.NotApplicable(Why.OPEN_ENDS)
        val matrix = NaviMeasure.dayMatrix(trip, overlay, dayIndex)
        // A stop, start or end without coordinates leaves the matrix short of n·(n+1) legs.
        if (matrix.size < order.size * (order.size + 1)) return Outcome.NotApplicable(Why.OPEN_ENDS)
        val times = matrix.associate { e -> e.key to (if (e.sameSpot) LegEstimate(0, 0, 0) else overlay.legEstimates[e.key]) }
        val missing = times.count { it.value == null }
        if (missing > 0) return Outcome.NeedsMeasure(missing)

        fun ref(id: String) = trip.visits.first { it.visitId == id }.placeRef
        fun cost(o: List<String>): Cost {
            val keys = listOf(startKey) + o.map(::ref) + endKey
            val legs = keys.zipWithNext().map { (a, b) -> times.getValue("$a>$b")!! }
            return Cost(legs.sumOf { it.minutes }, legs.sumOf { it.metres })
        }
        // How an order sits in the day's timetable: conflicts of that day, and fixed times reached with less than the margin.
        fun strain(o: List<String>): Pair<Int, Int> {
            val ov = overlay.copy(orderOverrides = overlay.orderOverrides + (dayIndex to o))
            val t = CarOrder.apply(plan, ov)
            val conflicts = TripValidator.validate(t, ov).forDay(dayIndex).count { it.severity == Severity.CONFLICT }
            val tight = TripValidator.timeline(t, dayIndex, ov).count { st ->
                val fixed = t.visits.first { it.visitId == st.visitId }.fixed?.let { TripValidator.minutes(it.time) }
                fixed != null && st.arrive != null && st.arrive > fixed - FIXED_MARGIN
            }
            return conflicts to tight
        }

        val now = cost(order)
        val (conflictsNow, tightNow) = strain(order)
        val best = permutations(order).map { it to cost(it) }.sortedWith(compareBy({ it.second.minutes }, { it.second.metres }))
            .firstOrNull { (o, c) ->
                if (c.minutes > now.minutes - MIN_SAVED) return@firstOrNull true // nothing left that saves enough: stop looking
                val (conflicts, tight) = strain(o)
                conflicts <= conflictsNow && tight <= tightNow
            }
        return if (best == null || best.second.minutes > now.minutes - MIN_SAVED) Outcome.Best(now.minutes, now.metres)
        else Outcome.Faster(best.first, best.second.minutes, best.second.metres, now.minutes - best.second.minutes, now.metres - best.second.metres)
    }

    private fun <T> permutations(items: List<T>): List<List<T>> =
        if (items.size <= 1) listOf(items) else items.flatMap { head -> permutations(items - head).map { listOf(head) + it } }
}
