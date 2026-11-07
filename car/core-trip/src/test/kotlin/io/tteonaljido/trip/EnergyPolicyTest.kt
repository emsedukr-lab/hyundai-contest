package io.tteonaljido.trip

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class EnergyPolicyTest {
    private fun advise(kind: VehicleKind, pct: Int?, range: Int? = null, dayKm: Int? = null, lodging: Boolean = true) =
        EnergyPolicy.advise(kind, pct, range, dayKm, lodging)

    @Test fun evFullAndReachableNeedsNothing() {
        assertNull(advise(VehicleKind.EV, 80, range = 300, dayKm = 100))
    }

    @Test fun evComfortableSocWithLodgingAheadSuggestsSlowOvernightCharge() {
        val a = advise(VehicleKind.EV, 35, range = 300, dayKm = 100, lodging = true)!!
        assertEquals(EnergyAction.SLOW_CHARGE, a.action)
        assertEquals(EnergyWhere.LODGING, a.where)
    }

    @Test fun evComfortableSocWithoutLodgingAheadFallsBackToFastAtNextStop() {
        val a = advise(VehicleKind.EV, 35, range = 300, dayKm = 100, lodging = false)!!
        assertEquals(EnergyAction.FAST_CHARGE, a.action)
        assertEquals(EnergyWhere.NEXT_STOP, a.where)
    }

    @Test fun evCriticalSocSuggestsFastChargeNow() {
        val a = advise(VehicleKind.EV, 15, range = 300, dayKm = 50, lodging = true)!!
        assertEquals(EnergyAction.FAST_CHARGE, a.action)
        assertEquals(EnergyWhere.NEXT_STOP, a.where)
    }

    @Test fun evCannotReachDayEndSuggestsFastEvenWithHealthySoc() {
        // 60% SOC but the remaining day (280km) won't fit in range (300km) with the 1.2 safety margin → fast now.
        val a = advise(VehicleKind.EV, 60, range = 300, dayKm = 280, lodging = true)!!
        assertEquals(EnergyAction.FAST_CHARGE, a.action)
    }

    @Test fun iceInTheRefuelWindowSuggestsRefuelAtNextStop() {
        val a = advise(VehicleKind.ICE, 25)!!
        assertEquals(EnergyAction.REFUEL, a.action)
        assertEquals(EnergyWhere.NEXT_STOP, a.where)
        assertEquals(25, a.energyPercent)
    }

    @Test fun iceWithPlentyOfFuelNeedsNothing() {
        assertNull(advise(VehicleKind.ICE, 60))
    }

    @Test fun phevChargesLikeAnEv() {
        assertEquals(EnergyAction.SLOW_CHARGE, advise(VehicleKind.PHEV, 30, range = 200, dayKm = 50, lodging = true)!!.action)
    }

    @Test fun unknownKindOrMissingReadingGivesNoAdvice() {
        assertNull(advise(VehicleKind.UNKNOWN, 10))
        assertNull(advise(VehicleKind.EV, null))
        assertNull(advise(VehicleKind.ICE, null))
    }
}
