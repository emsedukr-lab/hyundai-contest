package io.tteonaljido.trip

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDate

class TripRulesTest {
    private val schemaDir = File(System.getProperty("schemaDir"))
    private fun load(name: String) = (TransferParser.parse(File(schemaDir, "fixtures/valid/$name.json").readText()) as ParseResult.Ok).transfer.trip
    private val sample = load("sample")
    private fun codes(t: Trip, o: CarOverlay = CarOverlay(), today: LocalDate? = null) = TripValidator.validate(t, o, today).issues.map { it.code }
    private fun withDay(t: Trip, n: Int, f: (Day) -> Day) = t.copy(days = t.days.map { if (it.dayIndex == n) f(it) else it })

    /* ---------- validator ---------- */

    @Test fun sampleFixedSchedulesFitButUnknownLegsAreReported() {
        val issues = TripValidator.validate(sample).issues
        assertTrue(issues.none { it.code == "LATE_FOR_FIXED" })
        assertTrue(issues.any { it.code == "LEG_UNKNOWN" && it.dayIndex == 1 })
        assertTrue(issues.any { it.code == "HOURS_UNKNOWN" })
        assertTrue(issues.any { it.code == "ORIGIN_HOME_UNKNOWN" })
        assertTrue(issues.any { it.code == "UNASSIGNED" })
    }

    @Test fun timelineWaitsForFixedTimes() {
        val t = TripValidator.timeline(sample, 2).associateBy { it.visitId }
        assertEquals(TripValidator.minutes("09:35"), t.getValue("v4").arrive)
        assertEquals(TripValidator.minutes("11:15"), t.getValue("v5").arrive)
        assertEquals(TripValidator.minutes("13:00"), t.getValue("v5").start) // arrives 11:15, waits for the 13:00 reservation
    }

    @Test fun lateForFixedIsAConflict() {
        val late = withDay(sample, 4) { it.copy(departTime = "10:05") } // 10-min leg → arrives 10:15 for the 10:00 fixed time
        val issue = TripValidator.validate(late).issues.single { it.code == "LATE_FOR_FIXED" }
        assertEquals(Severity.CONFLICT, issue.severity)
        assertTrue(issue.text.contains("10:15"))
        assertEquals(listOf("4", "정동심곡바다부채길", "10:00", "10:15"), issue.args) // expected = hhmm(arrival), no parking time
        // Arriving 09:55 for 10:00 is on time (it used to be late once 20 min of parking time was added).
        assertFalse("LATE_FOR_FIXED" in codes(withDay(sample, 4) { it.copy(departTime = "09:45") }))
    }

    /** M42: parking time (`prepMinutes`) is not counted anywhere — a stop starts the minute the car arrives. */
    @Test fun aVisitWithPrepMinutes30StartsExactlyAtItsArrival() {
        val withPrep = sample.copy(visits = sample.visits.map { if (it.visitId == "v4" || it.visitId == "v10") it.copy(prepMinutes = 30) else it })
        val lake = TripValidator.timeline(withPrep, 2).first { it.visitId == "v4" }
        assertEquals(TripValidator.minutes("09:35"), lake.arrive)
        assertEquals(lake.arrive, lake.start)
        assertEquals(lake.start!! + 90, lake.end)
        // A fixed stop reached exactly at its time is on time, whatever its prepMinutes; the live projection agrees.
        val exact = withDay(withPrep, 4) { it.copy(departTime = "09:50") }
        val cliff = TripValidator.timeline(exact, 4).single()
        assertEquals(TripValidator.minutes("10:00"), cliff.arrive)
        assertEquals(cliff.arrive, cliff.start)
        assertFalse("LATE_FOR_FIXED" in codes(exact))
        val live = LiveProjection.project(exact, CarOverlay(), 4, TripValidator.minutes("09:50"))
        assertEquals(TripValidator.minutes("10:00"), live.fixed!!.ready)
        assertEquals(0, live.fixed!!.slack)
    }

    @Test fun missingLegBeforeFixedCannotBeChecked() {
        val unknown = withDay(sample, 4) { it.copy(legs = listOf(null, null)) }
        assertTrue("FIXED_UNCHECKED" in codes(unknown))
        assertFalse("LATE_FOR_FIXED" in codes(unknown))
    }

    @Test fun arrivalBasisNeedsTheFirstLegAndCanRequireLeavingTheDayBefore() {
        val arrival = sample.copy(firstDay = FirstDay.ArriveFirstStop("09:00", 10))
        assertTrue("FIRST_DEPARTURE_UNKNOWN" in codes(arrival))
        val far = withDay(arrival, 1) { it.copy(legs = listOf(Leg(600, Leg.LegSource.USER_ESTIMATE)) + it.legs.drop(1)) }
        assertTrue("DEPART_PREVIOUS_DAY" in codes(far))
    }

    @Test fun userEnteredHoursAreCheckedAgainstTheVisitDate() {
        val withHome = load("with-home") // cheolttuk: closed on 2026-11-21, open Fridays 09:00–21:00 only
        assertFalse(codes(withHome).any { it.startsWith("CLOSED") })
        val moved = withHome.copy(
            days = withHome.days.map {
                when (it.dayIndex) {
                    1 -> it.copy(visitOrder = it.visitOrder - "v1", legs = it.legs.drop(1))
                    2 -> it.copy(visitOrder = listOf("v1") + it.visitOrder, legs = listOf(null) + it.legs)
                    else -> it
                }
            },
        )
        assertTrue("CLOSED_DATE" in codes(moved))
    }

    @Test fun lodgingChainAndHomeResolution() {
        val noLodging = withDay(sample, 2) { it.copy(lodgingPlaceRef = null) }
        assertTrue(TripValidator.validate(noLodging).issues.any { it.code == "LODGING_MISSING" && it.dayIndex == 2 })
        val home = NaviBinding("h", "0", "HMG", 375_662_952, 1_269_779_451, "집", "서울")
        assertFalse("ORIGIN_HOME_UNKNOWN" in codes(sample, CarOverlay(home = home)))
    }

    @Test fun nameOnlyPlaceIsUncertainUntilTheNavigationConfirmsIt() {
        val t = load("place-without-coordinates")
        val issue = TripValidator.validate(t).issues.single { it.code == "NAME_ONLY" }
        assertEquals(Severity.UNCERTAIN, issue.severity)
        val bound = CarOverlay(poiBindings = mapOf("mukho" to NaviBinding("", "", "", 375_500_000, 1_291_100_000, "묵호 논골담길", "")))
        assertFalse("NAME_ONLY" in codes(t, bound))
        assertEquals(Match.NEAR, PlaceMatch.classify(null, null, null, 1, 1, null))
    }

    @Test fun pastTripSuggestsCleanup() {
        assertTrue("PAST_TRIP" in codes(sample, today = LocalDate.parse("2026-12-01")))
        assertFalse("PAST_TRIP" in codes(sample, today = LocalDate.parse("2026-11-21")))
    }

    @Test fun validationNeverChangesThePlan() {
        val before = sample.copy()
        TripValidator.validate(sample)
        assertEquals(before, sample)
    }

    /* ---------- import decision (spec 24-4) ---------- */

    private val stored = ImportDecision.apply(ImportChoice.IMPORT_NEW, sample, ImportDecision.decide(sample, emptyList()), "L1", 0).trip!!

    @Test fun newTripOffersImportOrCancel() {
        val d = ImportDecision.decide(sample, emptyList())
        assertEquals(ImportCase.NEW, d.case)
        assertEquals(listOf(ImportChoice.IMPORT_NEW, ImportChoice.CANCEL), d.choices)
    }

    @Test fun identicalResendChangesNothingEvenIfHomeConsentDiffers() {
        val withHome = sample.copy(home = Home("서울", 375_662_952, 1_269_779_451))
        val d = ImportDecision.decide(withHome, listOf(stored))
        assertEquals(ImportCase.SAME, d.case)
        val r = ImportDecision.apply(ImportChoice.ACKNOWLEDGE_SAME, withHome, d, "L2", 1)
        assertNull(r.trip)
        assertEquals("ALREADY_IMPORTED", r.resultCode)
    }

    @Test fun sameRevisionWithNewHomeOffersAddHomeAndFillsOnlyTheHome() {
        val withHome = sample.copy(home = Home("서울", 375_662_952, 1_269_779_451))
        val saved = stored.copy(overlay = CarOverlay(visited = setOf("v1")))
        val d = ImportDecision.decide(withHome, listOf(saved))
        assertEquals(ImportCase.SAME, d.case)
        assertTrue(ImportChoice.ADD_HOME in d.choices)
        assertTrue(d.changes.any { it.code == "HOME_ADDED" })
        val r = ImportDecision.apply(ImportChoice.ADD_HOME, withHome, d, "L9", 7)
        assertEquals("HOME_ADDED", r.resultCode)
        assertEquals(withHome.home, r.trip!!.plan.home)
        assertEquals(saved.overlay, r.trip!!.overlay)            // overlay untouched
        assertEquals(saved.meta.revision, r.trip!!.meta.revision) // revision untouched
    }

    @Test fun sameRevisionWhenHomeAlreadyKnownJustAcknowledges() {
        val withHome = sample.copy(home = Home("서울", 375_662_952, 1_269_779_451))
        val saved = ImportDecision.apply(ImportChoice.IMPORT_NEW, withHome, ImportDecision.decide(withHome, emptyList()), "LH", 0).trip!!
        val d = ImportDecision.decide(withHome, listOf(saved))
        assertEquals(ImportCase.SAME, d.case)
        assertFalse(ImportChoice.ADD_HOME in d.choices)
    }

    @Test fun newerRevisionOffersUpdateCopyOrCancelAndListsChanges() {
        val newer = sample.copy(revision = 2, name = "강릉 바다 여행")
        val d = ImportDecision.decide(newer, listOf(stored))
        assertEquals(ImportCase.NEWER, d.case)
        assertEquals(listOf(ImportChoice.UPDATE, ImportChoice.SAVE_COPY, ImportChoice.CANCEL), d.choices)
        assertTrue(d.changes.any { it.code == "NAME" && it.text.startsWith("이름") })
    }

    @Test fun olderRevisionNeverDowngrades() {
        val local = stored.copy(meta = stored.meta.copy(revision = 9))
        val d = ImportDecision.decide(sample, listOf(local))
        assertEquals(ImportCase.OLDER, d.case)
        assertFalse(ImportChoice.UPDATE in d.choices)
    }

    @Test fun sameRevisionDifferentContentIsTreatedAsDiverged() {
        val d = ImportDecision.decide(sample.copy(name = "다른 내용"), listOf(stored))
        assertEquals(ImportCase.DIVERGED, d.case)
        assertEquals(listOf(ImportChoice.SAVE_COPY, ImportChoice.CANCEL), d.choices)
    }

    @Test(expected = IllegalArgumentException::class)
    fun choicesNotOfferedAreRefused() {
        ImportDecision.apply(ImportChoice.UPDATE, sample, ImportDecision.decide(sample, emptyList()), "L3", 0)
    }

    @Test fun updateKeepsNearbyBindingsAndDropsMovedOnes() {
        val b = NaviBinding("1", "0", "HMG", 378_920_000, 1_288_260_000, "철뚝소머리집", "")
        val bound = stored.copy(overlay = CarOverlay(poiBindings = mapOf("cheolttuk" to b, "lake" to b), visited = setOf("v1", "gone")))
        val newer = sample.copy(revision = 2)
        val r = ImportDecision.apply(ImportChoice.UPDATE, newer, ImportDecision.decide(newer, listOf(bound)), "x", 5).trip!!
        assertEquals(setOf("cheolttuk"), r.overlay.poiBindings.keys) // 'lake' binding is kilometres away from the lake
        assertEquals(setOf("v1"), r.overlay.visited)
        assertEquals("L1", r.localId)
        assertEquals(2, r.meta.revision)
    }

    @Test fun savedCopyIsDetachedSoLaterImportsStillMatchTheOriginal() {
        val newer = sample.copy(revision = 2)
        val copy = ImportDecision.apply(ImportChoice.SAVE_COPY, newer, ImportDecision.decide(newer, listOf(stored)), "C1", 1).trip!!
        assertNull(copy.meta.sourceTripId)
        assertTrue(copy.meta.copy)
        assertFalse(copy.plan.name.endsWith("(사본)")) // the plan itself is never edited
        assertEquals("L1", ImportDecision.decide(newer, listOf(copy, stored)).existing?.localId)
    }

    /* ---------- next destination ---------- */

    @Test fun nextDestinationWalksStopsThenLodgingThenHome() {
        val first = NextDestination.of(sample, CarOverlay(), 1)
        assertEquals("철뚝소머리집", first.target?.label)
        val done = NextDestination.of(sample, CarOverlay(visited = setOf("v1", "v2", "v3")), 1)
        assertTrue(done.target is Target.Lodging)
        assertEquals("스카이베이호텔 경포", done.target?.label)
        val lastDay = NextDestination.of(sample, CarOverlay(visited = setOf("v10")), 4)
        assertTrue(lastDay.target is Target.Final)
        assertEquals(3, NextDestination.dayIndexFor(sample, LocalDate.parse("2026-11-22")))
        assertNull(NextDestination.dayIndexFor(sample, LocalDate.parse("2026-11-24")))
    }
}
