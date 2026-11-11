package io.tteonaljido.trip

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 쉬어 가기 권고 (M57): continuous driving, read with the navigation and the day's deadline. */
class RestAdvisorTest {
    private val min = 60_000L
    private fun drivingFor(minutes: Int, now: Long = 1_000 * min) = DriveSession(since = now - minutes * min)

    /* ---------- the driving stretch ---------- */

    @Test fun aStretchStartsWhenTheCarMovesAndCountsItsDistance() {
        val s0 = DriveSessions.step(DriveSession(), driving = true, now = 0, odometerKm = 1000.0)
        val s1 = DriveSessions.step(s0, driving = true, now = 90 * min, odometerKm = 1120.4)
        assertEquals(90, s1.minutes(90 * min))
        assertEquals(120, s1.km)
    }

    @Test fun aShortStopDoesNotEndTheStretch() {
        val s0 = DriveSessions.step(DriveSession(), true, 0)
        val stopped = DriveSessions.step(s0, false, 60 * min)
        val still = DriveSessions.step(stopped, false, 70 * min) // 10 minutes parked: a coffee, not a rest
        val again = DriveSessions.step(still, true, 71 * min)
        assertEquals(0L, again.since)
        assertNull(again.stoppedAt)
        assertEquals(125, again.minutes(125 * min))
    }

    @Test fun aRealBreakEndsItAndTheNextDriveStartsFresh() {
        val s0 = DriveSessions.step(DriveSession(), true, 0)
        val stopped = DriveSessions.step(s0, false, 130 * min)
        val rested = DriveSessions.step(stopped, false, 146 * min) // 16 minutes
        assertNull(rested.since)
        val next = DriveSessions.step(rested, true, 150 * min)
        assertEquals(150 * min, next.since)
        // Also when the long stop was never observed in between (the app was in the background).
        val jump = DriveSessions.step(stopped, true, 200 * min)
        assertEquals(200 * min, jump.since)
    }

    @Test fun aClockJumpMovesTheStretchWithIt() {
        // The emulator's demo clock jumps nine days ahead: 40 minutes of driving are still 40 minutes.
        val s = DriveSession(since = 100 * min, stoppedAt = 130 * min)
        val jump = 9 * 24 * 60 * min
        val moved = s.shifted(jump)
        assertEquals(40, moved.minutes(140 * min + jump))
        assertEquals(130 * min + jump, moved.stoppedAt)
        assertEquals(DriveSession(), DriveSession().shifted(jump))
    }

    @Test fun parkedWithoutAStretchStaysEmpty() {
        assertEquals(DriveSession(), DriveSessions.step(DriveSession(), false, 5 * min))
    }

    /* ---------- the advice ---------- */

    @Test fun noAdviceBeforeTwoHours() {
        assertNull(RestAdvisor.advise(drivingFor(119), 1_000 * min, nextStopMinutes = 50, slackMinutes = 40, restAreaMetres = 3_000))
        assertNull(RestAdvisor.advise(DriveSession(), 1_000 * min, null, null, null))
    }

    @Test fun afterTwoHoursARestAreaAheadIsNamedAndTheScheduleIsChecked() {
        val a = RestAdvisor.advise(drivingFor(130), 1_000 * min, nextStopMinutes = 50, slackMinutes = 40, restAreaMetres = 3_200)!!
        assertEquals(130, a.drivingMinutes)
        assertEquals(RestPlan.REST_AREA, a.plan)
        assertEquals(3_200, a.restAreaMetres)
        assertEquals(true, a.fitsSchedule)
        // Only 10 spare minutes: the break does not fit, and that is said rather than hidden.
        assertEquals(false, RestAdvisor.advise(drivingFor(130), 1_000 * min, 50, slackMinutes = 10, restAreaMetres = 3_200)!!.fitsSchedule)
    }

    @Test fun nearlyThereMeansRestOnArrival() {
        val a = RestAdvisor.advise(drivingFor(125), 1_000 * min, nextStopMinutes = 12, slackMinutes = 5, restAreaMetres = 800)!!
        assertEquals(RestPlan.AT_NEXT_STOP, a.plan)
        assertEquals(12, a.nextStopMinutes)
        assertNull(a.restAreaMetres)
        assertNull(a.fitsSchedule) // resting at the stop itself costs the schedule nothing
    }

    @Test fun nothingKnownAboutTheRoadStillAdvisesABreak() {
        val a = RestAdvisor.advise(drivingFor(150), 1_000 * min, null, null, null)!!
        assertEquals(RestPlan.ANYWHERE, a.plan)
        assertNull(a.fitsSchedule)
    }

    /* ---------- rest areas in the navigation's turn list ---------- */

    private fun turn(type: String, m: Int) = RestAreas.Turn(type, m.toDouble())
    /** The head of the list the emulator's navigation returned for Seongnam → Gangneung (each distance is from the turn before). */
    private val turns = listOf(
        turn("TURN_LEFT", 80), turn("TURN_LEFT", 390), turn("TURN_KEEP_R", 1_000), turn("TURN_RIGHT", 70), turn("TURN_ENTER_OVER_L", 950),
        turn("TURN_ENTER_UNDER_L", 1_100), turn("TURN_ENTER_IC_R", 18_000), turn("TURN_TOLL", 610), turn("TURN_ENTER_SERVICEAREA", 9_700),
        turn("TURN_RESTAREA", 15_000), turn("TURN_ARRIVE", 150_000),
    )

    @Test fun theRestAreaDistanceIsTheRunningTotalUpToIt() {
        assertEquals(31_900, RestAreas.ahead(turns, remainMetres = 198_000)) // the list adds up to 196.9 km
    }

    @Test fun aListThatNoLongerMatchesWhatIsLeftGivesNoDistance() {
        assertNull(RestAreas.ahead(turns, remainMetres = 120_000)) // the car has moved on; the list was not refreshed
        assertNull(RestAreas.ahead(turns, remainMetres = null))
        assertNull(RestAreas.ahead(emptyList(), 198_000))
    }

    @Test fun aRouteWithoutARestAreaHasNone() {
        assertNull(RestAreas.ahead(listOf(turn("TURN_LEFT", 500), turn("TURN_ARRIVE", 1_500)), 2_000))
    }
}
