package io.tteonaljido.car.ui.screens

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.dimensionResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import io.tteonaljido.car.LiveView
import io.tteonaljido.car.R
import io.tteonaljido.car.ui.components.Dot
import io.tteonaljido.car.ui.components.Icon
import io.tteonaljido.car.ui.components.MustTag
import io.tteonaljido.car.ui.components.PleosCard
import io.tteonaljido.car.ui.components.PleosText
import io.tteonaljido.car.ui.components.Radius
import io.tteonaljido.car.ui.components.Space
import io.tteonaljido.car.ui.components.Tag
import io.tteonaljido.car.ui.components.Tone
import io.tteonaljido.car.ui.theme.Pleos
import io.tteonaljido.trip.Endpoint
import io.tteonaljido.trip.Importance
import io.tteonaljido.trip.LegFrom
import io.tteonaljido.trip.LocalTrip
import io.tteonaljido.trip.TripOverview
import io.tteonaljido.trip.TripValidator
import io.tteonaljido.trip.originFor
import io.tteonaljido.trip.zoneOrUtc
import java.util.Locale

/*
 * One day of the trip in the car (M55), drawn like the phone's editor timeline (M51): a dashed route rail with markers
 * (start dot, numbered stops, bed or flag), slim one-line bars for where the day starts and ends, two-line stop cards
 * (name and 꼭 / time range and stay), and '↓ 15분' between them. Read-only here: the plan is edited on the phone.
 */

/** The rail column is an icon button wide (80), its markers 48 — the design system's icon sizes. */
private val RAIL @Composable get() = dimensionResource(R.dimen.pleos_buttons_icon_medium_width)
private val MARKER @Composable get() = Space.x48
/** Distance from the row top to the marker's top, so the marker sits on the card's first line. */
private val MARKER_TOP @Composable get() = Space.x24

/** 30분 · 1시간 · 1시간 30분 (the phone's minutesLabel). */
@Composable
internal fun durationLabel(min: Int): String = when {
    min >= 60 && min % 60 == 0 -> stringResource(R.string.dur_h, min / 60)
    min >= 60 -> stringResource(R.string.dur_hm, min / 60, min % 60)
    else -> stringResource(R.string.dur_m, min)
}

/** '2일차 · 11월 21일 (토)' over '운전 55분 · 숙소 도착 16:10' — only the driving time in bold (phone M54). */
@Composable
fun DayHeading(t: LocalTrip, day: Int) {
    val d = t.view.days[day - 1]
    val s = remember(t, day) { TripOverview.daySummary(t.view, t.overlay, day) }
    val primary = colorResource(R.color.pleos_text_dark_primary)
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    val km = s.driveMetres
    val drive = when {
        s.driveMinutes <= 0 -> null
        km != null && km > 0 -> stringResource(R.string.sum_drive_km, durationLabel(s.driveMinutes), kmLabel(km))
        else -> stringResource(R.string.sum_drive, durationLabel(s.driveMinutes))
    }
    val rest = listOfNotNull(
        s.endAt?.let { stringResource(if (s.lastDay) R.string.sum_home else R.string.sum_lodging, TripValidator.hhmm(it)) },
        if (s.unknownLegs > 0) stringResource(R.string.sum_unknown, s.unknownLegs) else null,
    )
    Column(Modifier.fillMaxWidth().padding(bottom = Space.x8), verticalArrangement = Arrangement.spacedBy(Space.x4)) {
        PleosText(stringResource(R.string.day_header, day, dateLabel(d.date)), Pleos.type.titleSmall, maxLines = 1)
        if (drive != null || rest.isNotEmpty()) BasicText(
            buildAnnotatedString {
                drive?.let { withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = primary)) { append(it) } }
                rest.forEachIndexed { i, x -> if (i > 0 || drive != null) append(" · "); append(x) }
            },
            style = Pleos.type.bodyMedium.copy(fontWeight = FontWeight.Normal, color = secondary),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
fun DayTimeline(t: LocalTrip, day: Int, live: LiveView?) {
    val plan = t.view
    val d = plan.days[day - 1]
    val times = remember(t, day) { TripValidator.timeline(plan, day, t.overlay).associateBy { it.visitId } }
    // Live timetable: re-timed arrivals for today's stops still to come (empty on other days — `live` is today's only).
    val projArrive = live?.projection?.takeIf { it.dayIndex == day }?.stops?.associate { it.visitId to it.arrive } ?: emptyMap()
    val zone = remember(t) { plan.zoneOrUtc() }
    val home = stringResource(R.string.home)
    val undecided = stringResource(R.string.lodging_undecided)
    val startName = when {
        t.overlay.originFor(plan, day) != null -> stringResource(R.string.origin_here)
        day == 1 -> when (val o = plan.origin) {
            is Endpoint.Home -> home
            is Endpoint.AtPlace -> TripValidator.placeName(plan, o.placeRef)
            is Endpoint.Current -> stringResource(R.string.origin_here) // no saved place chosen: the car's position when it leaves (M59)
        }
        else -> plan.days[day - 2].lodgingPlaceRef?.let { TripValidator.placeName(plan, it) } ?: undecided
    }
    val startAt = TripValidator.departure(plan, day, t.overlay)
    val last = day == plan.days.size
    val endRef = if (last) (plan.finalDestination as? Endpoint.AtPlace)?.placeRef else d.lodgingPlaceRef
    val endName = endRef?.let { TripValidator.placeName(plan, it) } ?: if (last) home else null
    val endAt = TripValidator.dayEnd(plan, day, t.overlay)

    Column(Modifier.fillMaxWidth()) {
        RailRow(top = false, marker = { Marker(fill = colorResource(R.color.pleos_icon_dark_primary), size = Space.x32) }) {
            Bar(
                stringResource(R.string.tl_start), startName,
                startAt?.let { stringResource(R.string.tl_depart_at, TripValidator.hhmm(it)) } ?: stringResource(R.string.tl_depart_free),
                quietTime = startAt == null,
            )
        }
        LegRow(t, day, 0)
        d.visitOrder.forEachIndexed { k, id ->
            val v = plan.visits.first { it.visitId == id }
            val time = times[id]
            val status = when {
                id in t.overlay.skipped -> stringResource(R.string.tag_skipped) to Tone.NEUTRAL
                id in t.overlay.visited -> (t.overlay.visitedAt[id]?.let { stringResource(R.string.tag_visited_at, clock(it.at, zone)) } ?: stringResource(R.string.tag_visited)) to Tone.OK
                id in t.overlay.deferredTo -> stringResource(R.string.tag_deferred_to, t.overlay.deferredTo.getValue(id).toString()) to Tone.NEUTRAL
                id in t.overlay.deferred -> stringResource(R.string.tag_deferred) to Tone.NEUTRAL
                else -> null
            }
            val done = id in t.overlay.visited || id in t.overlay.skipped
            RailRow(marker = { NumberMarker(k + 1, done) }) {
                PleosCard(Modifier.padding(vertical = Space.x8), padding = Space.x24, gap = Space.x8) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.x12)) {
                        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.x12)) {
                            PleosText(
                                TripValidator.placeName(plan, v.placeRef), Pleos.type.bodyLargeStrong,
                                colorResource(if (done) R.color.pleos_text_dark_secondary else R.color.pleos_text_dark_primary),
                                Modifier.weight(1f, fill = false), maxLines = 1,
                            )
                            if (v.importance == Importance.MUST) MustTag(stringResource(R.string.tl_must))
                        }
                        status?.let { (text, tone) -> Tag(text, tone) }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.x8)) {
                        // A fixed time is marked by the lock and the bold time — weight, not color.
                        val fixedColor = colorResource(R.color.pleos_text_dark_primary)
                        if (v.fixed != null) Icon(R.drawable.ic_lock, Space.x32, colorResource(R.color.pleos_icon_dark_primary))
                        val start = time?.start
                        val end = time?.end
                        if (start != null) {
                            val range = if (end != null) stringResource(R.string.tl_range, TripValidator.hhmm(start), TripValidator.hhmm(end)) else TripValidator.hhmm(start)
                            val ink = if (v.fixed != null) fixedColor else colorResource(R.color.pleos_text_dark_primary)
                            BasicText(
                                buildAnnotatedString {
                                    withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = ink)) { append(range) }
                                    append(" · "); append(durationLabel(v.stayMinutes))
                                },
                                style = Pleos.type.bodyMedium.copy(fontWeight = FontWeight.Normal, color = colorResource(R.color.pleos_text_dark_secondary)),
                                maxLines = 1, overflow = TextOverflow.Ellipsis,
                            )
                        } else {
                            PleosText(stringResource(R.string.time_check) + " · " + durationLabel(v.stayMinutes), Pleos.type.bodyMediumNormal, colorResource(R.color.pleos_text_dark_secondary), maxLines = 1)
                        }
                    }
                    // Only when the live time differs from the plan: the same number twice is noise.
                    projArrive[id]?.takeIf { it != time?.arrive }?.let { now ->
                        val planned = time?.arrive
                        Tag(
                            stringResource(R.string.tag_eta_now, TripValidator.hhmm(now)) + (planned?.let { " · " + stringResource(R.string.tag_eta_plan, TripValidator.hhmm(it)) } ?: ""),
                            Tone.INFO,
                        )
                    }
                }
            }
            LegRow(t, day, k + 1)
        }
        RailRow(bottom = false, marker = { Marker(icon = if (last) R.drawable.ic_flag else R.drawable.ic_bed) }) {
            Bar(
                stringResource(if (last) R.string.tl_return else R.string.tl_lodging), endName ?: undecided,
                endAt?.let { stringResource(R.string.tl_arrive_at, TripValidator.hhmm(it)) },
                quietName = endName == null,
            )
        }
    }
}

private fun clock(ms: Long, zone: java.time.ZoneId) =
    java.time.Instant.ofEpochMilli(ms).atZone(zone).let { String.format(Locale.ROOT, "%02d:%02d", it.hour, it.minute) }

/** A row on the route: the rail column (dashed line + marker) and the content beside it. */
@Composable
private fun RailRow(top: Boolean = true, bottom: Boolean = true, marker: (@Composable () -> Unit)?, content: @Composable () -> Unit) {
    val line = colorResource(R.color.pleos_divider_tertiary)
    val markerTop = MARKER_TOP
    val markerSize = MARKER
    val dashLength = Space.x8
    val stroke = Space.x4
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
        Box(
            Modifier.width(RAIL).fillMaxHeight().drawBehind {
                val x = size.width / 2
                val mid = (markerTop + markerSize / 2).toPx()
                val y0 = if (top) 0f else mid
                val y1 = if (bottom) size.height else mid
                if (y1 > y0) {
                    val dash = dashLength.toPx()
                    drawLine(line, Offset(x, y0), Offset(x, y1), strokeWidth = stroke.toPx(), cap = StrokeCap.Round, pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash, dash * 2)))
                }
            },
            contentAlignment = Alignment.TopCenter,
        ) {
            if (marker != null) Box(Modifier.padding(top = markerTop).size(markerSize), contentAlignment = Alignment.Center) { marker() }
        }
        Box(Modifier.weight(1f).padding(start = Space.x8)) { content() }
    }
}

@Composable
private fun Marker(fill: androidx.compose.ui.graphics.Color? = null, @DrawableRes icon: Int? = null, size: Dp = MARKER) {
    val ring = colorResource(R.color.pleos_divider_tertiary)
    Box(
        Modifier
            .size(size)
            .clip(CircleShape)
            .background(fill ?: colorResource(R.color.pleos_surface_basic))
            .then(if (fill == null) Modifier.border(Space.x4, ring, CircleShape) else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        if (icon != null) Icon(icon, Space.x32, colorResource(R.color.pleos_icon_dark_secondary))
    }
}

@Composable
private fun NumberMarker(n: Int, done: Boolean) {
    Box(
        Modifier
            .size(MARKER)
            .clip(CircleShape)
            .background(colorResource(if (done) R.color.pleos_surface_high else R.color.pleos_surface_basic))
            .border(Space.x4, colorResource(if (done) R.color.pleos_divider_secondary else R.color.pleos_icon_dark_primary), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        PleosText("$n", Pleos.type.label, colorResource(if (done) R.color.pleos_text_dark_tertiary else R.color.pleos_text_dark_primary), maxLines = 1)
    }
}

/** [출발]/[숙소]/[귀가] name … 09:30 출발 — one slim line (phone M51). */
@Composable
private fun Bar(tag: String, name: String, time: String?, quietTime: Boolean = false, quietName: Boolean = false) {
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(Radius.r24)
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = Space.x8)
            .heightIn(min = dimensionResource(R.dimen.pleos_buttons_basic_medium_height))
            .clip(shape)
            .background(colorResource(R.color.pleos_surface_basic))
            .border(dimensionResource(R.dimen.pleos_page_navigation_border_bottom), colorResource(R.color.pleos_divider_secondary), shape)
            .padding(horizontal = Space.x24, vertical = Space.x16),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x16),
    ) {
        Tag(tag)
        PleosText(name, if (quietName) Pleos.type.bodyLarge else Pleos.type.bodyLargeStrong, if (quietName) secondary else colorResource(R.color.pleos_text_dark_primary), Modifier.weight(1f), maxLines = 1)
        time?.let { PleosText(it, if (quietTime) Pleos.type.bodyMediumNormal else Pleos.type.bodyMedium, if (quietTime) secondary else colorResource(R.color.pleos_text_dark_primary), maxLines = 1) }
    }
}

/** '↓ 15분' between two places (the phone's value); '↓ 15분 · 6.3km · 내비' when the car's navigation measured it; an orange dot when nobody has. */
@Composable
private fun LegRow(t: LocalTrip, day: Int, k: Int) {
    val leg = TripValidator.leg(t.view, t.overlay, day, k)
    RailRow(marker = null) {
        Row(Modifier.heightIn(min = Space.x48).padding(start = Space.x16), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.x12)) {
            if (leg == null) {
                Dot(Tone.CAUTION, Space.x12)
                PleosText(stringResource(R.string.tl_leg_unknown), Pleos.type.bodySmallStrong, maxLines = 1)
            } else {
                val metres = leg.metres
                PleosText(
                    when {
                        leg.from != LegFrom.NAVI -> stringResource(R.string.tl_leg, durationLabel(leg.minutes))
                        metres != null && metres > 0 -> stringResource(R.string.tl_leg_navi_km, durationLabel(leg.minutes), kmLabel(metres))
                        else -> stringResource(R.string.tl_leg_navi, durationLabel(leg.minutes))
                    },
                    Pleos.type.bodySmall, colorResource(R.color.pleos_text_dark_secondary), maxLines = 1,
                )
            }
        }
    }
}
