package io.tteonaljido.trip

import org.junit.Assert.assertEquals
import org.junit.Test

class VisitStatsTest {
    private val MIN = 60_000L
    private fun r(cat: PlaceCategory, parkMin: Int, stayMin: Int, flags: Set<VisitFlag> = emptySet(), placeId: String = "p") =
        VisitRecord("t", 1, placeId, cat, isWeekend = false, tArrive = 0, tParked = parkMin * MIN, tDepart = (parkMin + stayMin) * MIN, flags = flags)

    @Test fun parkingBufferDefaultsByCategoryAndWeekend() {
        assertEquals(10, ParkingBufferPolicy.base(PlaceCategory.SIGHT, false))
        assertEquals(15, ParkingBufferPolicy.base(PlaceCategory.SIGHT, true))
        assertEquals(5, ParkingBufferPolicy.base(PlaceCategory.LODGING, true))
        assertEquals(10, ParkingBufferPolicy.buffer(emptyList(), PlaceCategory.SIGHT, false, beforeFixed = false))
        assertEquals(15, ParkingBufferPolicy.buffer(emptyList(), PlaceCategory.SIGHT, false, beforeFixed = true)) // ×1.5
    }

    @Test fun parkingBufferUsesTripMedianAfterThreeSameType() {
        val recs = listOf(r(PlaceCategory.SIGHT, 8, 60), r(PlaceCategory.SIGHT, 12, 60), r(PlaceCategory.SIGHT, 16, 60))
        assertEquals(12, ParkingBufferPolicy.buffer(recs, PlaceCategory.SIGHT, false, beforeFixed = false))
        // only two of a type → still the default
        assertEquals(10, ParkingBufferPolicy.buffer(recs.take(2), PlaceCategory.SIGHT, false, beforeFixed = false))
        // OUTLIER excluded from the median source
        val withOutlier = recs + r(PlaceCategory.SIGHT, 90, 60, flags = setOf(VisitFlag.OUTLIER))
        assertEquals(12, ParkingBufferPolicy.buffer(withOutlier, PlaceCategory.SIGHT, false, beforeFixed = false))
    }

    @Test fun beforeFixedBufferIsCappedAt30() {
        val recs = listOf(r(PlaceCategory.SIGHT, 30, 60), r(PlaceCategory.SIGHT, 40, 60), r(PlaceCategory.SIGHT, 50, 60))
        assertEquals(30, ParkingBufferPolicy.buffer(recs, PlaceCategory.SIGHT, false, beforeFixed = true)) // 40×1.5=60 → cap 30
    }

    private val planned: (String) -> Int? = { mapOf("p1" to 60, "p2" to 60, "p3" to 60)[it] }

    @Test fun stayTendencyIsOneWithTooFewSamples() {
        assertEquals(1.0, StayTendency.of(emptyList(), planned), 1e-9)
        assertEquals(1.0, StayTendency.of(listOf(r(PlaceCategory.FOOD, 5, 120, placeId = "p1")), planned), 1e-9)
    }

    @Test fun stayTendencyMedianOfActualOverPlanned() {
        val recs = listOf(r(PlaceCategory.FOOD, 5, 120, placeId = "p1"), r(PlaceCategory.SIGHT, 5, 30, placeId = "p2")) // 2.0, 0.5
        assertEquals(1.25, StayTendency.of(recs, planned), 1e-9)
    }

    @Test fun stayTendencyExcludesAndClamps() {
        val recs = listOf(
            r(PlaceCategory.FOOD, 5, 180, placeId = "p1"),                  // 3.0
            r(PlaceCategory.SIGHT, 5, 180, placeId = "p2"),                 // 3.0 → median 3.0 → clamp 2.0
            r(PlaceCategory.LODGING, 5, 600, placeId = "p3"),              // excluded (lodging)
            r(PlaceCategory.FOOD, 5, 2, placeId = "p1"),                    // excluded (<5 min)
            r(PlaceCategory.FOOD, 5, 60, flags = setOf(VisitFlag.DROP_OFF), placeId = "p1"), // excluded (drop-off)
        )
        assertEquals(2.0, StayTendency.of(recs, planned), 1e-9)
    }
}
