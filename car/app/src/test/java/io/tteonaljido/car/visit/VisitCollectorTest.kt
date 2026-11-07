package io.tteonaljido.car.visit

import io.tteonaljido.trip.PlaceCategory
import io.tteonaljido.trip.Signals
import io.tteonaljido.trip.VisitFlag
import io.tteonaljido.trip.VisitInput
import io.tteonaljido.trip.VisitProgress
import io.tteonaljido.trip.VisitRecord
import io.tteonaljido.trip.VisitState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class VisitCollectorTest {
    private val MIN = 60_000L
    private fun rec() = VisitRecord("t", 1, "p", PlaceCategory.SIGHT, isWeekend = false, tArrive = 0)
    private val parkSig = Signals(distance = 100.0, gearPark = true, parkingBrake = true, pinDistanceM = 30.0)

    @Test fun persistsOnAwayThenConfirmsAndClearsOnDepart() {
        val persisted = mutableListOf<VisitProgress?>()
        val confirmed = mutableListOf<VisitRecord>()
        val c = VisitCollector(recovered = null, persistProgress = { persisted += it }, confirm = { confirmed += it })
        c.apply(VisitInput.Arrived(rec()), 0)
        c.apply(VisitInput.Tick(parkSig), 0)
        c.apply(VisitInput.Tick(parkSig), 7 * MIN)        // PARKED
        c.apply(VisitInput.PowerDown, 20 * MIN)           // AWAY → persist
        assertEquals(VisitState.AWAY, persisted.last()!!.state)
        c.apply(VisitInput.Resumed, 90 * MIN)             // RESUMED
        c.apply(VisitInput.Tick(Signals(distance = 100.0)), 90 * MIN)
        c.apply(VisitInput.Tick(Signals(distance = 120.0)), 92 * MIN) // DEPARTED
        assertEquals(1, confirmed.size)
        assertEquals(92 - 7, confirmed[0].stayMinutes)
        assertNull(persisted.last())                      // snapshot cleared on finalize
    }

    @Test fun recoversAnInterruptedAwayOnStart() {
        val away = VisitProgress(VisitState.AWAY, rec().copy(tParked = 5 * MIN, tOff = 10 * MIN))
        val confirmed = mutableListOf<VisitRecord>()
        val c = VisitCollector(recovered = away, persistProgress = {}, confirm = { confirmed += it })
        c.start(60 * MIN)                                 // Resumed within 24h → RESUMED
        assertEquals(VisitState.RESUMED, c.state.progress?.state)
        c.apply(VisitInput.Tick(Signals(distance = 100.0)), 60 * MIN)
        c.apply(VisitInput.Tick(Signals(distance = 120.0)), 61 * MIN)
        assertEquals(1, confirmed.size)
        assertEquals(61 - 5, confirmed[0].stayMinutes)
    }

    @Test fun staleAwayRecoversAsOutlier() {
        val away = VisitProgress(VisitState.AWAY, rec().copy(tParked = 5 * MIN, tOff = 10 * MIN))
        val confirmed = mutableListOf<VisitRecord>()
        val c = VisitCollector(recovered = away, persistProgress = {}, confirm = { confirmed += it })
        c.start(25 * 60 * MIN)                            // >24h → finalized as OUTLIER
        assertEquals(1, confirmed.size)
        assertTrue(VisitFlag.OUTLIER in confirmed[0].flags)
    }
}
