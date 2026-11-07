package io.tteonaljido.trip

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class VisitTrackerTest {
    private val MIN = 60_000L
    private fun rec(cat: PlaceCategory = PlaceCategory.SIGHT) = VisitRecord("t", 1, "p", cat, isWeekend = false, tArrive = 0)

    /** Feeds a sequence of (input, now); returns the final state and every finalized record. */
    private fun run(vararg steps: Pair<VisitInput, Long>, start: VisitTrackerState = VisitTrackerState()): Pair<VisitTrackerState, List<VisitRecord>> {
        var st = start
        val finals = mutableListOf<VisitRecord>()
        for ((inp, now) in steps) {
            val r = VisitTracker.step(st, inp, now)
            st = r.state
            r.finalized?.let(finals::add)
        }
        return st to finals
    }

    private val parkSig = Signals(distance = 100.0, gearPark = true, parkingBrake = true, pinDistanceM = 30.0)

    @Test fun normalArriveParkAwayResumeDepart() {
        val (st, finals) = run(
            VisitInput.Arrived(rec()) to 0,
            VisitInput.Tick(parkSig) to 0,                 // first stop tick
            VisitInput.Tick(parkSig) to 7 * MIN,           // stationary ≥20s, 2 signals, near pin → PARKED at 7 min
            VisitInput.PowerDown to 20 * MIN,              // → AWAY
            VisitInput.Resumed to 90 * MIN,                // → RESUMED
            VisitInput.Tick(Signals(distance = 100.0)) to 90 * MIN,  // re-baseline distance
            VisitInput.Tick(Signals(distance = 110.0)) to 92 * MIN,  // moving → DEPARTED
        )
        assertEquals(VisitState.IDLE, st.progress?.state ?: VisitState.IDLE)
        assertEquals(1, finals.size)
        val r = finals[0]
        assertEquals(7, r.parkingMinutes)          // 0 → 7 min
        assertEquals(92 - 7, r.stayMinutes)        // tParked 7 min → tDepart 92 min
        assertEquals(30, r.parkDistanceM)
        assertTrue(r.flags.isEmpty())
        assertTrue(r.confirmed)
    }

    @Test fun circlingTheLotDoesNotParkUntilStationary() {
        val (st, finals) = run(
            VisitInput.Arrived(rec()) to 0,
            VisitInput.Tick(parkSig.copy(distance = 100.0)) to 0,       // stop
            VisitInput.Tick(parkSig.copy(distance = 150.0)) to 10_000,  // moving again → resets
            VisitInput.Tick(parkSig.copy(distance = 150.0)) to 25_000,  // stopped only 15s since 10s
        )
        assertEquals(VisitState.ARRIVED, st.progress?.state)
        assertTrue(finals.isEmpty())
    }

    @Test fun dropOffGivesZeroStay() {
        val parked = run(
            VisitInput.Arrived(rec()) to 0,
            VisitInput.Tick(parkSig) to 0,
            VisitInput.Tick(parkSig) to MIN,
        ).first
        assertEquals(VisitState.PARKED, parked.progress?.state)
        val (st, finals) = run(VisitInput.Tick(Signals(distance = 500.0, driverDoorOpen = false)) to 3 * MIN, start = parked)
        assertEquals(VisitState.IDLE, st.progress?.state ?: VisitState.IDLE)
        assertEquals(1, finals.size)
        assertTrue(VisitFlag.DROP_OFF in finals[0].flags)
        assertEquals(0, finals[0].stayMinutes)
    }

    @Test fun briefRestartKeepsStayCounting() {
        val (st, finals) = run(
            VisitInput.Arrived(rec()) to 0,
            VisitInput.Tick(parkSig) to 0,
            VisitInput.Tick(parkSig) to 5 * MIN,            // PARKED at 5 min
            VisitInput.PowerDown to 10 * MIN,               // AWAY, tOff=10
            VisitInput.Resumed to 30 * MIN,                 // RESUMED, tOn=30
            VisitInput.PowerDown to 32 * MIN,               // within 5 min → back to AWAY (brief start)
            VisitInput.Resumed to 50 * MIN,                 // RESUMED again
            VisitInput.Tick(Signals(distance = 100.0)) to 50 * MIN,
            VisitInput.Tick(Signals(distance = 120.0)) to 51 * MIN,  // moving → DEPARTED
        )
        assertEquals(1, finals.size)
        assertEquals(51 - 5, finals[0].stayMinutes)   // stay = tDepart(51) − tParked(5), restart ignored
    }

    @Test fun parkTimeoutFlagsDelayedButStaysArrived() {
        val oneSignal = Signals(distance = 100.0, parkingBrake = true, pinDistanceM = 30.0) // only 1 signal → never parks
        val (st, finals) = run(
            VisitInput.Arrived(rec()) to 0,
            VisitInput.Tick(oneSignal) to 0,
            VisitInput.Tick(oneSignal) to 61 * MIN,   // past 60-min timeout
        )
        assertEquals(VisitState.ARRIVED, st.progress?.state)
        assertTrue(VisitFlag.PARK_DELAYED in st.progress!!.record.flags)
        assertTrue(finals.isEmpty())
    }

    @Test fun routeGoneDiscardsAnArrivedMeasurement() {
        val (st, finals) = run(VisitInput.Arrived(rec()) to 0, VisitInput.RouteGone to MIN)
        assertEquals(VisitState.IDLE, st.progress?.state ?: VisitState.IDLE)
        assertNull(st.progress)
        assertTrue(finals.isEmpty())
    }

    @Test fun staleAwayBecomesOutlierAfter24h() {
        val away = run(
            VisitInput.Arrived(rec()) to 0,
            VisitInput.Tick(parkSig) to 0,
            VisitInput.Tick(parkSig) to MIN,
            VisitInput.PowerDown to 2 * MIN,
        ).first
        assertEquals(VisitState.AWAY, away.progress?.state)
        val (st, finals) = run(VisitInput.Resumed to 25 * 60 * MIN, start = away) // 25 h later
        assertEquals(VisitState.IDLE, st.progress?.state ?: VisitState.IDLE)
        assertEquals(1, finals.size)
        assertTrue(VisitFlag.OUTLIER in finals[0].flags)
    }

    @Test fun farFromPinOrTooFewSignalsNeverParks() {
        val far = run(VisitInput.Arrived(rec()) to 0, VisitInput.Tick(parkSig.copy(pinDistanceM = 400.0)) to 0, VisitInput.Tick(parkSig.copy(pinDistanceM = 400.0)) to MIN).first
        assertEquals(VisitState.ARRIVED, far.progress?.state)
        val few = run(VisitInput.Arrived(rec()) to 0, VisitInput.Tick(Signals(distance = 100.0, parkingBrake = true, pinDistanceM = 10.0)) to 0, VisitInput.Tick(Signals(distance = 100.0, parkingBrake = true, pinDistanceM = 10.0)) to MIN).first
        assertEquals(VisitState.ARRIVED, few.progress?.state)
    }
}
