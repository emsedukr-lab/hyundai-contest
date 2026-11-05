package io.tteonaljido.car.ui

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import io.tteonaljido.car.R
import io.tteonaljido.trip.Change
import io.tteonaljido.trip.Issue
import io.tteonaljido.trip.NextStep

/** A message decided in a ViewModel and rendered in the UI language. */
data class Msg(@StringRes val id: Int, val args: List<Any> = emptyList()) {
    constructor(@StringRes id: Int, vararg args: Any) : this(id, args.toList())
}

@Composable
fun text(m: Msg): String = stringResource(m.id, *m.args.toTypedArray())

private val ISSUE = mapOf(
    "NAME_ONLY" to R.string.issue_name_only,
    "NO_COORDINATES" to R.string.issue_no_coordinates,
    "OUTSIDE_KOREA" to R.string.issue_outside_korea,
    "DUPLICATE_PLACE" to R.string.issue_duplicate_place,
    "FIXED_UNASSIGNED" to R.string.issue_fixed_unassigned,
    "UNASSIGNED" to R.string.issue_unassigned,
    "FIXED_OFF_GRID" to R.string.issue_fixed_off_grid,
    "FIRST_DEPARTURE_UNKNOWN" to R.string.issue_first_departure_unknown,
    "DEPARTURE_UNKNOWN" to R.string.issue_departure_unknown,
    "DEPART_PREVIOUS_DAY" to R.string.issue_depart_previous_day,
    "LEG_UNKNOWN" to R.string.issue_leg_unknown,
    "LATE_FOR_FIXED" to R.string.issue_late_for_fixed,
    "FIXED_UNCHECKED" to R.string.issue_fixed_unchecked,
    "CLOSED_DATE" to R.string.issue_closed_date,
    "CLOSED_WEEKDAY" to R.string.issue_closed_weekday,
    "OUTSIDE_HOURS" to R.string.issue_outside_hours,
    "PAST_END_BY" to R.string.issue_past_end_by,
    "HOURS_UNKNOWN" to R.string.issue_hours_unknown,
    "LODGING_MISSING" to R.string.issue_lodging_missing,
    "LAST_DAY_LODGING" to R.string.issue_last_day_lodging,
    "LODGING_CATEGORY" to R.string.issue_lodging_category,
    "ORIGIN_HOME_UNKNOWN" to R.string.issue_origin_home_unknown,
    "RETURN_HOME_UNKNOWN" to R.string.issue_return_home_unknown,
    "NAVI_RESOLVE" to R.string.issue_navi_resolve,
    "PAST_TRIP" to R.string.issue_past_trip,
)

private val CHANGE = mapOf(
    "NAME" to R.string.change_name,
    "PERIOD" to R.string.change_period,
    "PLACES_ADDED" to R.string.change_places_added,
    "PLACES_REMOVED" to R.string.change_places_removed,
    "FIXED" to R.string.change_fixed,
    "ORDER" to R.string.change_order,
    "LODGING" to R.string.change_lodging,
    "ENDPOINTS" to R.string.change_endpoints,
    "DETAILS" to R.string.change_details,
)

private val NEXT = mapOf(
    "FIXED" to R.string.next_fixed,
    "NO_LODGING" to R.string.next_no_lodging,
    "LODGING" to R.string.next_lodging,
    "RETURN" to R.string.next_return,
)

/** Falls back to the Korean text from the core module if a code has no string yet. */
@Composable
fun issueText(i: Issue): String = ISSUE[i.code]?.let { stringResource(it, *i.args.toTypedArray()) } ?: i.text

@Composable
fun changeText(c: Change): String = CHANGE[c.code]?.let { stringResource(it, *c.args.toTypedArray()) } ?: c.text

@Composable
fun noteText(s: NextStep): String = NEXT[s.noteCode]?.let { stringResource(it, *s.noteArgs.toTypedArray()) } ?: s.note
