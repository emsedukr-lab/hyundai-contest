package io.tteonaljido.trip

import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.cos

/**
 * What the car's trip list and day timeline show at a glance (M55), ported from the phone so both read the same:
 * the whole-trip route sketch (packages/web lib/routeSketch.ts `tripSketch`), where a trip stands today
 * (lib/nextTrip.ts `tripWhen`) and a day's summary line (운전 · 숙소 도착 · 미확인). Pure; nothing leaves the car.
 */

data class SketchPoint(val x: Double, val y: Double, val lodging: Boolean, val n: Int?)

/** One day of the sketch: its stops (and that night's lodging) in order, joined to the previous day's last point. */
data class SketchDay(val dayIndex: Int, val from: SketchPoint?, val points: List<SketchPoint>)

data class TripSketch(val days: List<SketchDay>, val width: Double, val height: Double, val plotted: Int)

/** Where a trip stands on [today]: days until it leaves, the day we are on, or over. [focusDay] is the day to draw in blue. */
sealed interface TripWhen {
    val focusDay: Int?
    data class Ahead(val days: Int) : TripWhen { override val focusDay: Int get() = 1 }
    data object StartsToday : TripWhen { override val focusDay: Int get() = 1 }
    data class OnDay(val day: Int) : TripWhen { override val focusDay: Int get() = day }
    data object Past : TripWhen { override val focusDay: Int? get() = null }
}

/** 운전 55분 · 숙소 도착 16:10 · 이동시간 1구간 미확인. [endAt] is null when an unknown leg or departure hides it. */
data class DaySummary(val driveMinutes: Int, val unknownLegs: Int, val endAt: Int?, val lastDay: Boolean)

object TripOverview {
    /**
     * Every day's stops and lodgings on one sketch, north up, keeping the map's proportions (longitude scaled by
     * cos(latitude)) and centred in the box. Home is left out so a far-away start does not shrink the trip to a dot.
     */
    fun sketch(trip: Trip, width: Double = 300.0, height: Double = 176.0, pad: Double = 16.0): TripSketch {
        data class Raw(val dayIndex: Int, val lodging: Boolean, val n: Int?, val lat: Int, val lon: Int)
        val place = trip.places.associateBy { it.placeRef }
        val visit = trip.visits.associateBy { it.visitId }
        val raws = buildList {
            for (day in trip.days) {
                day.visitOrder.forEachIndexed { i, id ->
                    val p = visit[id]?.placeRef?.let(place::get)
                    val lat = p?.latE7
                    val lon = p?.lonE7
                    if (lat != null && lon != null) add(Raw(day.dayIndex, false, i + 1, lat, lon))
                }
                val lodging = if (day.dayIndex < trip.days.size) day.lodgingPlaceRef?.let(place::get) else null
                val lat = lodging?.latE7
                val lon = lodging?.lonE7
                if (lat != null && lon != null) add(Raw(day.dayIndex, true, null, lat, lon))
            }
        }
        if (raws.isEmpty()) return TripSketch(emptyList(), width, height, 0)
        val lat0 = Math.toRadians(raws.sumOf { it.lat.toDouble() } / raws.size * 1e-7)
        val k = cos(lat0)
        val xs = raws.map { it.lon * k }
        val ys = raws.map { it.lat.toDouble() }
        val minX = xs.min(); val maxX = xs.max(); val minY = ys.min(); val maxY = ys.max()
        val spanX = maxX - minX
        val spanY = maxY - minY
        val scale = if (spanX == 0.0 && spanY == 0.0) 0.0
        else minOf(if (spanX != 0.0) (width - 2 * pad) / spanX else Double.POSITIVE_INFINITY, if (spanY != 0.0) (height - 2 * pad) / spanY else Double.POSITIVE_INFINITY)
        val offX = (width - spanX * scale) / 2
        val offY = (height - spanY * scale) / 2
        val days = mutableListOf<SketchDay>()
        var last: SketchPoint? = null
        for (day in trip.days) {
            val points = raws.indices.filter { raws[it].dayIndex == day.dayIndex }.map { i ->
                SketchPoint(offX + (xs[i] - minX) * scale, offY + (maxY - ys[i]) * scale, raws[i].lodging, raws[i].n)
            }
            if (points.isEmpty()) continue
            days += SketchDay(day.dayIndex, last, points)
            last = points.last()
        }
        return TripSketch(days, width, height, raws.size)
    }

    fun tripWhen(startDate: String, endDate: String, today: LocalDate): TripWhen {
        val start = LocalDate.parse(startDate)
        val end = LocalDate.parse(endDate)
        return when {
            today.isBefore(start) -> TripWhen.Ahead(ChronoUnit.DAYS.between(today, start).toInt())
            today == start -> TripWhen.StartsToday
            !today.isAfter(end) -> TripWhen.OnDay(ChronoUnit.DAYS.between(start, today).toInt() + 1)
            else -> TripWhen.Past
        }
    }

    /** Driving time of the day's known legs (car estimates included), how many legs have no time, and when the day ends. */
    fun daySummary(trip: Trip, overlay: CarOverlay, dayIndex: Int): DaySummary {
        val day = trip.days[dayIndex - 1]
        val legs = (0..day.visitOrder.size).map { TripValidator.leg(trip, overlay, dayIndex, it) }
        return DaySummary(
            driveMinutes = legs.sumOf { it?.minutes ?: 0 },
            unknownLegs = legs.count { it == null },
            endAt = TripValidator.dayEnd(trip, dayIndex, overlay),
            lastDay = dayIndex == trip.days.size,
        )
    }

    /** The trip to put first: the one under way, else the soonest upcoming, else the first in list order. */
    fun <T> pickNext(items: List<T>, trip: (T) -> Trip, today: (T) -> LocalDate): T? {
        if (items.isEmpty()) return null
        fun start(t: T) = LocalDate.parse(trip(t).startDate)
        fun end(t: T) = LocalDate.parse(trip(t).endDate)
        items.firstOrNull { !today(it).isBefore(start(it)) && !today(it).isAfter(end(it)) }?.let { return it }
        return items.filter { start(it).isAfter(today(it)) }.minByOrNull { trip(it).startDate } ?: items.first()
    }

    /** '다른 여행' order: trips ahead or under way by departure (then end, then name), then past trips, most recent first. */
    fun <T> sortOthers(items: List<T>, trip: (T) -> Trip, today: (T) -> LocalDate): List<T> {
        val byStart = compareBy<T>({ trip(it).startDate }, { trip(it).endDate }, { trip(it).name })
        val (past, ahead) = items.partition { LocalDate.parse(trip(it).endDate).isBefore(today(it)) }
        return ahead.sortedWith(byStart) + past.sortedWith(byStart.reversed())
    }
}
