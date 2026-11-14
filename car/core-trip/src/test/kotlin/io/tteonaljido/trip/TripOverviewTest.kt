package io.tteonaljido.trip

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDate

/** M55: the car's trip list card and day summary, same rules as the phone (routeSketch.ts, nextTrip.ts, M54 summary). */
class TripOverviewTest {
    private val schemaDir = File(System.getProperty("schemaDir"))
    private val sample = (TransferParser.parse(File(schemaDir, "fixtures/valid/sample.json").readText()) as ParseResult.Ok).transfer.trip
    private fun m(hhmm: String) = TripValidator.minutes(hhmm)

    @Test fun sketchPlotsEveryStopAndLodgingInsideTheBox() {
        val s = TripOverview.sketch(sample, 300.0, 176.0, 16.0)
        val withCoords = sample.places.filter { it.latE7 != null }.map { it.placeRef }.toSet()
        val stops = sample.days.sumOf { d -> d.visitOrder.count { id -> sample.visits.first { it.visitId == id }.placeRef in withCoords } }
        val lodgings = sample.days.dropLast(1).count { it.lodgingPlaceRef in withCoords }
        assertEquals(stops + lodgings, s.plotted)
        assertEquals(sample.days.map { it.dayIndex }, s.days.map { it.dayIndex })
        s.days.flatMap { it.points }.forEach { p ->
            assertTrue("x ${p.x}", p.x in 16.0 - 1e-6..284.0 + 1e-6)
            assertTrue("y ${p.y}", p.y in 16.0 - 1e-6..160.0 + 1e-6)
        }
    }

    @Test fun sketchChainsDaysAndNumbersStops() {
        val s = TripOverview.sketch(sample)
        assertNull(s.days.first().from)
        s.days.zipWithNext().forEach { (a, b) -> assertEquals(a.points.last(), b.from) }
        val day2 = s.days.first { it.dayIndex == 2 }
        assertEquals(listOf(1, 2, 3, 4, null), day2.points.map { it.n })   // four stops, then that night's lodging
        assertTrue(day2.points.last().lodging)
        assertTrue(s.days.last().points.none { it.lodging })                // the last day has no lodging
    }

    @Test fun mapMarkersKeepFirstAndLastAndSpreadTheRest() {
        val m = TripOverview.mapMarkers(sample)
        assertTrue(m.size in 2..5)
        assertEquals(m.size, m.distinct().size)
        val all = TripOverview.mapMarkers(sample, max = 100)
        assertEquals(all.first(), m.first())
        assertEquals(all.last(), m.last())
        // Never more than asked for.
        assertTrue(TripOverview.mapMarkers(sample, max = 3).size <= 3)
    }

    @Test fun sketchIsNorthUp() {
        val s = TripOverview.sketch(sample)
        val pts = sample.days.flatMap { d -> d.visitOrder.map { id -> sample.places.first { it.placeRef == sample.visits.first { v -> v.visitId == id }.placeRef } } }
        val north = pts.maxBy { it.latE7!! }
        val south = pts.minBy { it.latE7!! }
        fun yOf(name: String): Double {
            sample.days.forEach { d ->
                d.visitOrder.forEachIndexed { i, id ->
                    if (sample.places.first { it.placeRef == sample.visits.first { v -> v.visitId == id }.placeRef }.name == name) {
                        return s.days.first { it.dayIndex == d.dayIndex }.points.first { it.n == i + 1 }.y
                    }
                }
            }
            error(name)
        }
        assertTrue(yOf(north.name) < yOf(south.name))
    }

    @Test fun sketchSkipsPlacesWithoutCoordinates() {
        val noCoords = sample.copy(places = sample.places.map { it.copy(latE7 = null, lonE7 = null) })
        val s = TripOverview.sketch(noCoords)
        assertEquals(0, s.plotted)
        assertTrue(s.days.isEmpty())
    }

    @Test fun tripWhenBeforeDuringAfter() {
        assertEquals(TripWhen.Ahead(10), TripOverview.tripWhen("2026-11-20", "2026-11-23", LocalDate.parse("2026-11-10")))
        assertEquals(TripWhen.Ahead(1), TripOverview.tripWhen("2026-11-20", "2026-11-23", LocalDate.parse("2026-11-19")))
        assertEquals(TripWhen.StartsToday, TripOverview.tripWhen("2026-11-20", "2026-11-23", LocalDate.parse("2026-11-20")))
        assertEquals(TripWhen.OnDay(2), TripOverview.tripWhen("2026-11-20", "2026-11-23", LocalDate.parse("2026-11-21")))
        assertEquals(TripWhen.OnDay(4), TripOverview.tripWhen("2026-11-20", "2026-11-23", LocalDate.parse("2026-11-23")))
        assertEquals(TripWhen.Past, TripOverview.tripWhen("2026-11-20", "2026-11-23", LocalDate.parse("2026-11-24")))
        assertEquals(2, TripWhen.OnDay(2).focusDay)
        assertNull(TripWhen.Past.focusDay)
    }

    @Test fun daySummaryAddsKnownLegsAndEndsAtTheLodging() {
        // Day 2: 5 + 10 + 15 + 10 + 15 = 55 minutes; 09:30 start, the 13:00 reservation holds, lodging at 16:10.
        val d2 = TripOverview.daySummary(sample, CarOverlay(), 2)
        assertEquals(DaySummary(55, 0, m("16:10"), false), d2)
    }

    @Test fun daySummaryCountsUnknownLegsAndHidesTheEnd() {
        val d4 = TripOverview.daySummary(sample, CarOverlay(), 4)   // legs [10, unknown] → home time unknown
        assertEquals(10, d4.driveMinutes)
        assertEquals(1, d4.unknownLegs)
        assertNull(d4.endAt)
        assertTrue(d4.lastDay)
        val d1 = TripOverview.daySummary(sample, CarOverlay(), 1)   // first leg from home unknown
        assertEquals(45, d1.driveMinutes)
        assertEquals(1, d1.unknownLegs)
    }

    @Test fun daySummaryUsesTheNavigationsEstimateWhereThePlanHasNone() {
        val key = LegKeys.of(sample, CarOverlay(), 4, 1)!!
        val o = CarOverlay(legEstimates = mapOf(key to LegEstimate(140, 90_000, 0L)))
        val d4 = TripOverview.daySummary(sample, o, 4)
        assertEquals(150, d4.driveMinutes)
        assertEquals(0, d4.unknownLegs)
        assertEquals(m("10:00") + 180 + 140, d4.endAt)
    }

    @Test fun nextTripIsTheOngoingThenTheSoonest() {
        data class T(val name: String, val start: String, val end: String)
        val list = listOf(T("past", "2026-10-01", "2026-10-02"), T("later", "2026-12-01", "2026-12-02"), T("soon", "2026-11-20", "2026-11-23"))
        fun trip(t: T) = sample.copy(name = t.name, startDate = t.start, endDate = t.end)
        val today = { _: T -> LocalDate.parse("2026-11-10") }
        assertEquals("soon", TripOverview.pickNext(list, ::trip, today)?.name)
        assertEquals("soon", TripOverview.pickNext(list, ::trip) { LocalDate.parse("2026-11-21") }?.name)
        assertEquals("past", TripOverview.pickNext(list.take(1), ::trip, today)?.name)
        assertEquals(listOf("soon", "later", "past"), TripOverview.sortOthers(list, ::trip, today).map { it.name })
    }
}
