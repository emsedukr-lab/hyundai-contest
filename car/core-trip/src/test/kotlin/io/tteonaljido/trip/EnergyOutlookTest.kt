package io.tteonaljido.trip

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** M57: the battery expected at the end of today's route (SOC + range + the navigation's estimate), and what it changes. */
class EnergyOutlookTest {
    @Test fun theNavigationsOwnConsumptionIsUsedFirst() {
        // 70% now, the navigation says 58% after a 60 km leg → 0.2 %/km. 100 km more (×1.2 = 120 km) costs 24% → 34%.
        assertEquals(34, EnergyOutlook.socAtDayEnd(70, rangeKm = 300, laterKm = 100, naviSocAtNext = 58, nextLegMetres = 60_000))
    }

    @Test fun withoutAnEstimateTheRangeAtTheCurrentChargeIsUsed() {
        // 60% is good for 240 km; 100 km (×1.2 = 120 km) is half of it → 30%.
        assertEquals(30, EnergyOutlook.socAtDayEnd(60, rangeKm = 240, laterKm = 100, naviSocAtNext = null, nextLegMetres = null))
        // A known next leg (road distance) is added to what the range must cover: (120 + 60) / 240 → 15%.
        assertEquals(15, EnergyOutlook.socAtDayEnd(60, rangeKm = 240, laterKm = 100, naviSocAtNext = null, nextLegMetres = 60_000))
    }

    @Test fun neverBelowEmptyAndNeverInvented() {
        assertEquals(0, EnergyOutlook.socAtDayEnd(30, rangeKm = 100, laterKm = 200, naviSocAtNext = null, nextLegMetres = null))
        assertNull(EnergyOutlook.socAtDayEnd(null, 300, 100, 58, 60_000))
        assertNull(EnergyOutlook.socAtDayEnd(70, 300, null, 58, 60_000)) // the rest of the day is unknown
        assertNull(EnergyOutlook.socAtDayEnd(70, null, 100, null, null)) // nothing to estimate from
        // An estimate above the current charge (charging on the way) is not a consumption rate: fall back to the range,
        // which must cover the next leg too — (120 + 60) / 300 of the battery is used → 28%.
        assertEquals(28, EnergyOutlook.socAtDayEnd(70, rangeKm = 300, laterKm = 100, naviSocAtNext = 80, nextLegMetres = 60_000))
    }

    @Test fun aDayThatEndsNearlyEmptyIsAdvisedEvenWithAHealthyCharge() {
        // 55% and the range covers the day (so the old rules said nothing), but the day would end at 12%.
        assertNull(EnergyPolicy.advise(VehicleKind.EV, 55, 250, 150, lodgingAhead = true))
        val a = EnergyPolicy.advise(VehicleKind.EV, 55, 250, 150, lodgingAhead = true, socAtDayEnd = 12)!!
        assertEquals(EnergyAction.FAST_CHARGE, a.action)
        assertEquals(EnergyWhere.NEXT_STOP, a.where)
        assertEquals(12, a.socAtDayEnd)
    }

    @Test fun aComfortableEndKeepsTheCalmOvernightAdvice() {
        val a = EnergyPolicy.advise(VehicleKind.EV, 38, 250, 60, lodgingAhead = true, socAtDayEnd = 27)!!
        assertEquals(EnergyAction.SLOW_CHARGE, a.action)
        assertEquals(27, a.socAtDayEnd)
    }

    @Test fun sportModeIsPointedOutOnlyWhenThereIsAdvice() {
        assertTrue(EnergyPolicy.advise(VehicleKind.EV, 30, 200, 50, true, driveMode = DriveMode.SPORT)!!.ecoHint)
        assertFalse(EnergyPolicy.advise(VehicleKind.EV, 30, 200, 50, true, driveMode = DriveMode.ECO)!!.ecoHint)
        assertNull(EnergyPolicy.advise(VehicleKind.EV, 90, 400, 50, true, driveMode = DriveMode.SPORT))
    }

    @Test fun aCombustionCarIsAlsoAdvisedWhenTheRangeWillNotCoverTheDay() {
        // 45% fuel is above the refuel window, but 200 km of range will not cover 180 km × 1.2.
        val a = EnergyPolicy.advise(VehicleKind.ICE, 45, rangeKm = 200, remainingDayKm = 180, lodgingAhead = false)!!
        assertEquals(EnergyAction.REFUEL, a.action)
        assertEquals("refuel_range", a.reasonCode)
        assertNull(EnergyPolicy.advise(VehicleKind.ICE, 45, rangeKm = 400, remainingDayKm = 180, lodgingAhead = false))
        assertEquals("refuel", EnergyPolicy.advise(VehicleKind.ICE, 25, rangeKm = 400, remainingDayKm = 180, lodgingAhead = false)!!.reasonCode)
    }
}
