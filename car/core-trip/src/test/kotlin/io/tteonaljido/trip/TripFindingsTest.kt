package io.tteonaljido.trip

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** findings sorted by who settles them — a person (shown as 충돌 / 확인 필요) or the car's navigation (quiet lines). */
class TripFindingsTest {
    private val schemaDir = File(System.getProperty("schemaDir"))
    private val sample = (TransferParser.parse(File(schemaDir, "fixtures/valid/sample.json").readText()) as ParseResult.Ok).transfer.trip
    private fun withDay(t: Trip, n: Int, f: (Day) -> Day) = t.copy(days = t.days.map { if (it.dayIndex == n) f(it) else it })
    private fun issue(severity: Severity, code: String, day: Int? = null, vararg args: String) = Issue(severity, code, code, day, args.toList())

    @Test fun untimedLegsAndANaviHomeAreTheNavigationsToFill() {
        listOf("LEG_UNKNOWN", "FIRST_DEPARTURE_UNKNOWN", "ORIGIN_HOME_UNKNOWN", "RETURN_HOME_UNKNOWN").forEach {
            assertEquals(it, TripFindings.Who.NAVI, TripFindings.who(issue(Severity.UNCERTAIN, it)))
        }
    }

    @Test fun whatAPersonMustSettleStaysWithThePerson() {
        listOf("NO_COORDINATES", "FIXED_UNASSIGNED", "DEPART_PREVIOUS_DAY", "LATE_FOR_FIXED", "CLOSED_DATE", "CLOSED_WEEKDAY", "OUTSIDE_HOURS", "PAST_END_BY").forEach {
            assertEquals(it, TripFindings.Who.PERSON, TripFindings.who(issue(Severity.CONFLICT, it)))
        }
        // Open questions the navigation cannot answer by measuring, and the ambiguous ones, stay visible as 확인 필요.
        listOf("NAME_ONLY", "OUTSIDE_KOREA", "FIXED_OFF_GRID", "DEPARTURE_UNKNOWN", "FIXED_UNCHECKED", "HOURS_UNKNOWN", "LODGING_MISSING").forEach {
            assertEquals(it, TripFindings.Who.PERSON, TripFindings.who(issue(Severity.UNCERTAIN, it)))
        }
    }

    @Test fun anUnknownCodeIsAPersonsAndInfoIsANote() {
        assertEquals(TripFindings.Who.PERSON, TripFindings.who(issue(Severity.UNCERTAIN, "SOMETHING_NEW")))
        assertEquals(TripFindings.Who.NOTE, TripFindings.who(issue(Severity.INFO, "NAVI_RESOLVE")))
        // A navigation code raised as a conflict would be a person's again: only its open-question form is routine.
        assertEquals(TripFindings.Who.PERSON, TripFindings.who(issue(Severity.CONFLICT, "LEG_UNKNOWN")))
    }

    @Test fun everyFindingTheValidatorRaisesForTheSampleIsSorted() {
        val report = TripValidator.validate(sample)
        val view = TripFindings.of(report)
        val shown = report.issues.filter { it.severity != Severity.INFO }
        val navi = shown.filter { TripFindings.who(it) == TripFindings.Who.NAVI }
        assertEquals(shown - navi.toSet(), view.person)
        assertEquals(report.conflicts, view.conflicts)
        assertEquals(report.uncertain - navi.size, view.toCheck)
        assertEquals(report.issues.filter { it.code == "LEG_UNKNOWN" }.sumOf { it.args[1].toInt() }, view.untimedLegs)
    }

    @Test fun aTripWhoseOnlyOpenPointsAreTheNavigationsIsClear() {
        // Home with no address at both ends: the first and the last leg have no time.
        val t = withDay(withDay(sample.copy(origin = Endpoint.Home, finalDestination = Endpoint.Home, home = null), 1) { d -> d.copy(legs = listOf(null) + d.legs.drop(1)) }, sample.days.size) { d -> d.copy(legs = d.legs.dropLast(1) + null) }
        val report = TripValidator.validate(t)
        val view = TripFindings.of(report)
        assertTrue(report.issues.any { it.code == "LEG_UNKNOWN" })
        assertTrue(view.homeOrigin && view.homeReturn && view.naviFills)
        assertTrue(view.untimedLegs >= 2)
        assertTrue(view.person.none { TripFindings.who(it) != TripFindings.Who.PERSON })
        assertEquals(report.conflicts, view.conflicts)
        // Sorting is presentation only: the report still counts them.
        assertTrue(report.uncertain >= view.toCheck + 4)
    }

    @Test fun aRealConflictIsCountedNextToTheNavigationsLines() {
        val late = withDay(sample, 4) { it.copy(departTime = "10:05") } // arrives 10:15 for the 10:00 fixed time (TripRulesTest)
        val view = TripFindings.of(TripValidator.validate(late))
        assertTrue(view.person.any { it.code == "LATE_FOR_FIXED" })
        assertTrue(view.conflicts >= 1)
        assertFalse(view.clear)
    }

    @Test fun aDayShowsItsOwnFindingsAndThoseTiedToNoDay() {
        val report = ValidationReport(
            listOf(
                issue(Severity.UNCERTAIN, "LEG_UNKNOWN", 1, "1", "2"),
                issue(Severity.UNCERTAIN, "LEG_UNKNOWN", 4, "4", "1"),
                issue(Severity.UNCERTAIN, "ORIGIN_HOME_UNKNOWN", 1),
                issue(Severity.UNCERTAIN, "RETURN_HOME_UNKNOWN", 4),
                issue(Severity.UNCERTAIN, "HOURS_UNKNOWN", null, "3"),
                issue(Severity.CONFLICT, "LATE_FOR_FIXED", 2),
                issue(Severity.INFO, "NAVI_RESOLVE", null, "14"),
            ),
        )
        val all = TripFindings.of(report)
        assertEquals(listOf("HOURS_UNKNOWN", "LATE_FOR_FIXED"), all.person.map { it.code })
        assertEquals(3, all.untimedLegs)
        assertEquals(1, all.conflicts)
        assertEquals(1, all.toCheck)

        val day1 = TripFindings.of(report, 1)
        assertEquals(listOf("HOURS_UNKNOWN"), day1.person.map { it.code })
        assertEquals(2, day1.untimedLegs)
        assertTrue(day1.homeOrigin)
        assertFalse(day1.homeReturn)

        val day3 = TripFindings.of(report, 3)
        assertFalse(day3.naviFills)
        assertEquals(listOf("HOURS_UNKNOWN"), day3.person.map { it.code })

        val day4 = TripFindings.of(report, 4)
        assertEquals(1, day4.untimedLegs)
        assertTrue(day4.homeReturn)
    }

    @Test fun nothingOpenIsClearWithNothingForTheNavigation() {
        val view = TripFindings.of(ValidationReport(listOf(issue(Severity.INFO, "LEG_NAVI", 1, "1", "3"))))
        assertTrue(view.clear)
        assertFalse(view.naviFills)
    }
}
