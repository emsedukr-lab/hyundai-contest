package io.tteonaljido.trip

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Where a day ends ([NextDestination.endOf]): the car names it next to the next destination and can guide straight
 * there. It is the night's lodging, or the trip's final destination on the last day, whatever was visited or skipped.
 */
class DayEndTest {
    private val schemaDir = File(System.getProperty("schemaDir"))
    private val sample = (TransferParser.parse(File(schemaDir, "fixtures/valid/sample.json").readText()) as ParseResult.Ok).transfer.trip

    @Test fun aDayBeforeTheLastEndsAtItsLodging() {
        val end = NextDestination.endOf(sample, 2) as Target.Lodging
        assertEquals(sample.days[1].lodgingPlaceRef, end.place.placeRef)
        assertEquals(end.place.name, end.label)
    }

    @Test fun theLastDayEndsAtTheFinalDestination() {
        val end = NextDestination.endOf(sample, sample.days.size) as Target.Final
        assertTrue(end.endpoint is Endpoint.Home)
        assertNull(end.place)
    }

    @Test fun aNightWithoutLodgingHasNoEndToGuideTo() {
        val open = sample.copy(days = sample.days.map { if (it.dayIndex == 2) it.copy(lodgingPlaceRef = null) else it })
        assertNull(NextDestination.endOf(open, 2))
        // …and the next step says so once the day's stops are done, as before.
        val done = CarOverlay(skipped = open.days[1].visitOrder.toSet())
        assertEquals("NO_LODGING", NextDestination.of(open, done, 2).noteCode)
    }

    @Test fun skippingStopsDoesNotMoveTheEndAndTheNextStepReachesIt() {
        val day = sample.days[1]
        // One stop skipped: the next step is the stop after it, the end is unchanged.
        val one = CarOverlay(skipped = setOf(day.visitOrder.first()))
        assertEquals(day.visitOrder[1], (NextDestination.of(sample, one, 2).target as Target.Stop).visitId)
        assertEquals(NextDestination.endOf(sample, 2), NextDestination.endOf(sample, 2))
        // Every stop skipped: the next step is the day's end itself.
        val all = CarOverlay(skipped = day.visitOrder.toSet())
        assertEquals(NextDestination.endOf(sample, 2), NextDestination.of(sample, all, 2).target)
        assertEquals("LODGING", NextDestination.of(sample, all, 2).noteCode)
        assertEquals("RETURN", NextDestination.of(sample, CarOverlay(skipped = sample.days.last().visitOrder.toSet()), sample.days.size).noteCode)
    }
}
