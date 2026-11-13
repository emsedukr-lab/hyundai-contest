package io.tteonaljido.car.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.tteonaljido.car.R
import io.tteonaljido.car.navi.NaviLive
import io.tteonaljido.car.ui.components.PleosCard
import io.tteonaljido.car.ui.components.PleosText
import io.tteonaljido.car.ui.components.Space
import io.tteonaljido.car.ui.components.StatusLine
import io.tteonaljido.car.ui.components.Tag
import io.tteonaljido.car.ui.components.Tone
import io.tteonaljido.car.ui.theme.Pleos
import io.tteonaljido.trip.CheckCode
import io.tteonaljido.trip.CheckItem
import io.tteonaljido.trip.CheckLevel
import io.tteonaljido.trip.DepartureReport
import io.tteonaljido.trip.RestAdvice
import io.tteonaljido.trip.RestAdvisor
import io.tteonaljido.trip.RestPlan
import java.util.Locale

/*
 * M57 panels: what the car itself reported (Pleos Vehicle SDK) and what the navigation knows about the route
 * (NaviHelper), put next to the plan. Every line is words first — the dot only repeats the tone.
 */

private fun km(metres: Int) = String.format(Locale.ROOT, "%.1f", metres / 1000.0)

@Composable
private fun checkText(i: CheckItem): String = when (i.code) {
    CheckCode.ENERGY_SHORT -> stringResource(R.string.check_energy_short, i.a ?: 0)
    CheckCode.POWER_LIMITED -> stringResource(R.string.check_power_limited)
    CheckCode.BRAKE_FLUID_LOW -> stringResource(R.string.check_brake_fluid)
    CheckCode.ENGINE_OIL_LOW -> stringResource(R.string.check_engine_oil)
    CheckCode.WASHER_LOW -> stringResource(R.string.check_washer)
    CheckCode.CHARGE_CABLE -> stringResource(R.string.check_cable)
    CheckCode.DOOR_OPEN -> i.a?.takeIf { it > 1 }?.let { stringResource(R.string.check_door_n, it) } ?: stringResource(R.string.check_door)
    CheckCode.TRUNK_OPEN -> stringResource(R.string.check_trunk)
    CheckCode.BELT_UNBUCKLED -> stringResource(R.string.check_belt, i.a ?: 0, i.b ?: 0)
}

/** 출발 전 점검: one tag that says it all, then at most three things to look at (the rest is counted). Parked only. */
@Composable
fun DepartureCard(report: DepartureReport) {
    val secondary = colorResource(R.color.tn_text_secondary)
    PleosCard(gap = Space.x16) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.x16)) {
            PleosText(stringResource(R.string.departure_title), Pleos.type.titleSmall, maxLines = 1)
            if (report.ready) Tag(stringResource(R.string.departure_ready), Tone.OK)
            else Tag(stringResource(R.string.departure_count, report.items.size), if (report.level == CheckLevel.STOP) Tone.ERROR else Tone.CAUTION)
        }
        report.items.take(3).forEach { StatusLine(checkText(it), if (it.level == CheckLevel.STOP) Tone.ERROR else Tone.CAUTION) }
        if (report.items.size > 3) PleosText(stringResource(R.string.check_more, report.items.size - 3), Pleos.type.bodyMediumNormal, secondary, maxLines = 1)
        if (report.ready) PleosText(stringResource(R.string.departure_basis, report.known), Pleos.type.bodyMediumNormal, secondary, maxLines = 2)
    }
}

/** The rest advice as its two lines: why (how long, how far), and what to do (with whether the schedule allows it). */
@Composable
fun restTexts(a: RestAdvice): Pair<String, String> {
    val d = durationLabel(a.drivingMinutes)
    val why = a.drivingKm?.let { stringResource(R.string.rest_long_km, d, it) } ?: stringResource(R.string.rest_long, d)
    val what = when (a.plan) {
        RestPlan.AT_NEXT_STOP -> stringResource(R.string.rest_at_stop, a.nextStopMinutes ?: 0)
        RestPlan.REST_AREA -> stringResource(R.string.rest_area, km(a.restAreaMetres ?: 0))
        RestPlan.ANYWHERE -> stringResource(R.string.rest_anywhere)
    }
    val fits = when (a.fitsSchedule) {
        true -> " · " + stringResource(R.string.rest_fits, RestAdvisor.BREAK_MINUTES)
        false -> " · " + stringResource(R.string.rest_no_room)
        null -> ""
    }
    return why to what + fits
}

/** Traffic on the route as one line, or null when the road is clear / nothing is known. */
@Composable
fun trafficText(live: NaviLive?): String? {
    val t = live?.traffic?.takeIf { live.guiding } ?: return null
    return t.congestionMetres?.let { stringResource(R.string.traffic_jam, km(it)) } ?: t.incidents.takeIf { it > 0 }?.let { stringResource(R.string.traffic_incidents, it) }
}

/** The toll, for a single-stop route only: with waypoints the navigation's figure covers just the first leg. */
@Composable
fun tollText(live: NaviLive?): String? = live?.tollWon?.takeIf { live.guiding && live.waypoints.isEmpty() }?.let { stringResource(R.string.toll_line, String.format(Locale.KOREA, "%,d", it)) }
