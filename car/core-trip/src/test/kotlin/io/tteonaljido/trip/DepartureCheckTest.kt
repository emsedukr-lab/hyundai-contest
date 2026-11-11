package io.tteonaljido.trip

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 출발 전 점검 (M57): vehicle readings combined with today's remaining distance; unknowns are left out, never guessed. */
class DepartureCheckTest {
    private val clear = VehicleSnapshot(
        powerLimited = false, washerLow = false, engineOil = FluidLevel.OK, brakeFluid = FluidLevel.OK,
        doorsOpen = 0, trunkOpen = false, chargePortOpen = false, occupants = 2, unbuckled = 0,
    )
    private fun codes(r: DepartureReport?) = r!!.items.map { it.code }

    @Test fun nothingReportedMeansNoCardAtAll() {
        assertNull(DepartureCheck.evaluate(null, null, null))
        assertNull(DepartureCheck.evaluate(VehicleSnapshot(), null, 120))
        // Gear, drive mode and the odometer feed other features; alone they are not a departure check.
        assertNull(DepartureCheck.evaluate(VehicleSnapshot(gearPark = true, driveMode = DriveMode.ECO, odometerKm = 12.0), null, null))
    }

    @Test fun everythingFineIsReadyAndSaysHowMuchWasChecked() {
        val r = DepartureCheck.evaluate(clear, rangeKm = 400, remainingDayKm = 150)!!
        assertTrue(r.ready)
        assertTrue(r.items.isEmpty())
        assertEquals(9, r.known) // range, power, brake fluid, engine oil, washer, charge port, doors, trunk, belts
    }

    @Test fun whatTheEmulatorsCarReportsIsEnoughForACheck() {
        // Vehicle Service 2.3.22 on the Pleos emulator: doors, charge port, seats and belts answer; fluids are unsupported.
        val r = DepartureCheck.evaluate(VehicleSnapshot(doorsOpen = 0, chargePortOpen = false, occupants = 4, unbuckled = 4, gearPark = true, odometerKm = 0.0), 500, 30)!!
        assertEquals(listOf(CheckItem(CheckCode.BELT_UNBUCKLED, CheckLevel.CAUTION, a = 4, b = 4)), r.items)
        assertEquals(4, r.known)
        assertFalse(r.ready)
    }

    @Test fun rangeAgainstTodaysRouteUsesTheSafetyMargin() {
        // 150 km of straight lines × 1.2 = 180 km: 170 km of range is short, 185 km is enough.
        assertEquals(listOf(CheckItem(CheckCode.ENERGY_SHORT, CheckLevel.CAUTION, a = 170)), DepartureCheck.evaluate(null, 170, 150)!!.items)
        assertTrue(DepartureCheck.evaluate(null, 185, 150)!!.ready)
        // Without both numbers nothing is said about energy.
        assertNull(DepartureCheck.evaluate(null, 170, null))
    }

    @Test fun occupiedSeatsWithoutABeltAreCounted() {
        val r = DepartureCheck.evaluate(clear.copy(occupants = 4, unbuckled = 1), null, null)!!
        assertEquals(CheckItem(CheckCode.BELT_UNBUCKLED, CheckLevel.CAUTION, a = 1, b = 4), r.items.single())
        // Occupancy without belt states is not enough to say anything.
        assertTrue(DepartureCheck.evaluate(clear.copy(occupants = 4, unbuckled = null), null, null)!!.ready)
    }

    @Test fun openChargePortDoorsAndTrunk() {
        val r = DepartureCheck.evaluate(clear.copy(chargePortOpen = true, doorsOpen = 2, trunkOpen = true), null, null)!!
        assertEquals(listOf(CheckCode.CHARGE_CABLE, CheckCode.DOOR_OPEN, CheckCode.TRUNK_OPEN), codes(r))
        assertEquals(2, r.items[1].a)
        assertEquals(CheckLevel.CAUTION, r.level)
    }

    @Test fun powerLimitAndFluids() {
        val r = DepartureCheck.evaluate(clear.copy(powerLimited = true, brakeFluid = FluidLevel.LOW, engineOil = FluidLevel.LOW, washerLow = true), null, null)!!
        assertEquals(listOf(CheckCode.POWER_LIMITED, CheckCode.BRAKE_FLUID_LOW, CheckCode.ENGINE_OIL_LOW, CheckCode.WASHER_LOW), codes(r))
        assertEquals(CheckLevel.STOP, r.items[0].level)
        assertEquals(CheckLevel.STOP, r.items[1].level) // brake fluid stops; low (not critical) oil and washer are cautions
        assertEquals(CheckLevel.CAUTION, r.items[2].level)
        assertEquals(CheckLevel.STOP, DepartureCheck.evaluate(clear.copy(engineOil = FluidLevel.CRITICAL), null, null)!!.level)
    }

    @Test fun stopItemsComeFirst() {
        val r = DepartureCheck.evaluate(clear.copy(washerLow = true, powerLimited = true, unbuckled = 1), 100, 150)!!
        assertEquals(CheckCode.POWER_LIMITED, r.items.first().code)
        assertEquals(setOf(CheckCode.POWER_LIMITED, CheckCode.ENERGY_SHORT, CheckCode.WASHER_LOW, CheckCode.BELT_UNBUCKLED), r.items.map { it.code }.toSet())
    }
}
