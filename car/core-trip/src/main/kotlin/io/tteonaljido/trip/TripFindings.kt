package io.tteonaljido.trip

/**
 * How the re-check's findings are shown (M66). [TripValidator] and its severities are untouched; this only sorts what
 * it reported by who settles it, so a normal trip does not open with a column of orange "확인 필요" lines:
 *
 * - [Who.PERSON]: something a person has to do or decide — conflicts, a reservation that cannot be checked, missing
 *   information only they can supply. Shown with its severity (red / orange) and counted in "충돌 n" · "확인 필요 n".
 * - [Who.NAVI]: something the car's navigation fills in — legs nobody has timed yet (it measures them) and a home the
 *   phone sent no address for (the navigation's own '집' is used). Shown as quiet information, never counted.
 * - [Who.NOTE]: [Severity.INFO] remarks, which the screens leave out as before.
 *
 * A code that is not listed is a person's to settle: a new finding stays visible until it is sorted on purpose.
 */
object TripFindings {
    enum class Who { PERSON, NAVI, NOTE }

    /** Findings that are open only until the navigation has measured a leg or its '집' is read. */
    private val NAVI_FILLS = setOf("LEG_UNKNOWN", "FIRST_DEPARTURE_UNKNOWN", "ORIGIN_HOME_UNKNOWN", "RETURN_HOME_UNKNOWN")

    fun who(issue: Issue): Who = when {
        issue.code in NAVI_FILLS && issue.severity == Severity.UNCERTAIN -> Who.NAVI
        issue.severity == Severity.INFO -> Who.NOTE
        else -> Who.PERSON
    }

    /**
     * One screen's findings. [person] keeps the validator's order. [untimedLegs] is how many legs wait for the
     * navigation's time; [homeOrigin] / [homeReturn] say the start / the return is a home the navigation supplies.
     */
    data class View(val person: List<Issue>, val untimedLegs: Int, val homeOrigin: Boolean, val homeReturn: Boolean) {
        val conflicts get() = person.count { it.severity == Severity.CONFLICT }
        val toCheck get() = person.count { it.severity == Severity.UNCERTAIN }
        val naviFills get() = untimedLegs > 0 || homeOrigin || homeReturn
        val clear get() = person.isEmpty()
    }

    /** The whole trip (import review, next-trip card), or with [day] that day's findings plus those tied to no day. */
    fun of(report: ValidationReport, day: Int? = null): View {
        val scope = if (day == null) report.issues else report.issues.filter { it.dayIndex == day || it.dayIndex == null }
        val navi = scope.filter { who(it) == Who.NAVI }
        return View(
            person = scope.filter { who(it) == Who.PERSON },
            // LEG_UNKNOWN carries (day, legs); a count that cannot be read still stands for one leg.
            untimedLegs = navi.filter { it.code == "LEG_UNKNOWN" }.sumOf { it.args.getOrNull(1)?.toIntOrNull() ?: 1 },
            homeOrigin = navi.any { it.code == "ORIGIN_HOME_UNKNOWN" },
            homeReturn = navi.any { it.code == "RETURN_HOME_UNKNOWN" },
        )
    }
}
