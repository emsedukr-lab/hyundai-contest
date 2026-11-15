package io.tteonaljido.trip

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** SDK enum names → this app's terms. Names, not SDK types, so an unknown future value is simply unknown. */
class VehicleTermsTest {
    @Test fun fluidLevels() {
        assertEquals(FluidLevel.OK, VehicleTerms.fluid("NORMAL"))
        assertEquals(FluidLevel.OK, VehicleTerms.fluid("HIGH"))
        assertEquals(FluidLevel.LOW, VehicleTerms.fluid("LOW"))
        assertEquals(FluidLevel.CRITICAL, VehicleTerms.fluid("CRITICALLY_LOW"))
        assertNull(VehicleTerms.fluid("ERROR")) // a sensor fault is unknown, not low
    }

    @Test fun driveModes() {
        assertEquals(DriveMode.SPORT, VehicleTerms.driveMode("SPORT"))
        assertEquals(DriveMode.ECO, VehicleTerms.driveMode("ECO"))
        assertNull(VehicleTerms.driveMode("TERRAIN"))
    }
}
