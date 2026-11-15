// not used by the current screens or timetable — kept as the groundwork for estimating real parking time from
// NaviHelper + Vehicle SDK data (navigation ended → ignition off + belt released + doors locked) later.
package io.tteonaljido.trip

/**
 * 주차 여유·체류 경향 (parking-buffer / stay-tendency) derived from this trip's confirmed [VisitRecord]s. Pure Kotlin.
 * Meant as advisory inputs to the car timeline (not applied today, see above) — they never change the user's plan,
 * and never leave the car.
 * No per-place crowd statistics and no upload (that is a future-plan item, intentionally not built here).
 */

private fun medianInt(xs: List<Int>): Int {
    val s = xs.sorted()
    val m = s.size / 2
    return if (s.size % 2 == 1) s[m] else ((s[m - 1] + s[m] + 1) / 2) // round half up
}

private fun medianDouble(xs: List<Double>): Double {
    val s = xs.sorted()
    val m = s.size / 2
    return if (s.size % 2 == 1) s[m] else (s[m - 1] + s[m]) / 2.0
}

/** Minutes to add after a leg for finding and parking — a default table, replaced by this trip's own median once enough. */
object ParkingBufferPolicy {
    /** (weekday, weekend) default minutes per category. Edit here to tune. */
    private val BASE: Map<PlaceCategory, Pair<Int, Int>> = mapOf(
        PlaceCategory.SIGHT to (10 to 15),
        PlaceCategory.FOOD to (5 to 10),
        PlaceCategory.CAFE to (5 to 10),
        PlaceCategory.LODGING to (5 to 5),
        PlaceCategory.OTHER to (5 to 10),
    )
    const val BEFORE_FIXED_FACTOR = 1.5 // a reservation just ahead deserves more slack
    const val MAX_MINUTES = 30
    const val MIN_SAMPLES = 3 // this many same-type records in the trip replaces the default with their median

    fun base(category: PlaceCategory, isWeekend: Boolean): Int = BASE.getValue(category).let { if (isWeekend) it.second else it.first }

    /** Buffer for a stop of [category]; uses this trip's median park time when ≥3 same-type records exist; ×1.5 (≤30) before a fixed stop. */
    fun buffer(records: List<VisitRecord>, category: PlaceCategory, isWeekend: Boolean, beforeFixed: Boolean): Int {
        val measured = records.filter { it.category == category && VisitFlag.OUTLIER !in it.flags }.mapNotNull { it.parkingMinutes }
        val b = if (measured.size >= MIN_SAMPLES) medianInt(measured) else base(category, isWeekend)
        return if (beforeFixed) minOf(MAX_MINUTES, Math.round(b * BEFORE_FIXED_FACTOR).toInt()) else b
    }
}

/** How this trip's real stays compare with the planned ones: a multiplier on remaining stops' planned stay. */
object StayTendency {
    const val MIN_SAMPLES = 2
    const val MIN_STAY_MIN = 5
    const val MAX_STAY_MIN = 20 * 60
    const val LOW = 0.5
    const val HIGH = 2.0

    /** Median of actual/planned stay over confirmed non-lodging records (drop-off/outlier and out-of-range excluded); 1.0 if &lt;2, clamped [0.5, 2.0]. */
    fun of(records: List<VisitRecord>, plannedStay: (placeId: String) -> Int?): Double {
        val ratios = records.filter {
            it.confirmed && VisitFlag.DROP_OFF !in it.flags && VisitFlag.OUTLIER !in it.flags && it.category != PlaceCategory.LODGING
        }.mapNotNull { r ->
            val actual = r.stayMinutes ?: return@mapNotNull null
            if (actual < MIN_STAY_MIN || actual > MAX_STAY_MIN) return@mapNotNull null
            val planned = plannedStay(r.placeId)?.takeIf { it > 0 } ?: return@mapNotNull null
            actual.toDouble() / planned
        }
        return if (ratios.size < MIN_SAMPLES) 1.0 else medianDouble(ratios).coerceIn(LOW, HIGH)
    }
}
