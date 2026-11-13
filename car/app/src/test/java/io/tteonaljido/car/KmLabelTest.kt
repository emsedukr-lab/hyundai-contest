package io.tteonaljido.car

import io.tteonaljido.car.ui.screens.kmLabel
import org.junit.Assert.assertEquals
import org.junit.Test

/** One format for every distance on the screen: no ".0", one decimal below 100 km, whole kilometres from there. */
class KmLabelTest {
    @Test fun wholeKilometresCarryNoDecimal() {
        assertEquals("3", kmLabel(3_000))
        assertEquals("17", kmLabel(17_000))
        assertEquals("202", kmLabel(202_400))
    }

    @Test fun aFractionKeepsOneDecimalBelowAHundredKilometres() {
        assertEquals("3.8", kmLabel(3_782))
        assertEquals("0.4", kmLabel(420))
        assertEquals("99.9", kmLabel(99_940))
        assertEquals("100", kmLabel(99_960)) // rounds up to a whole number: still no ".0"
        assertEquals("217", kmLabel(216_600))
    }
}
