package io.tteonaljido.car.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import io.tteonaljido.car.BuildConfig
import io.tteonaljido.car.Guide
import io.tteonaljido.car.HereEstimate
import io.tteonaljido.car.LiveView
import io.tteonaljido.car.guide.ArrivalNote
import io.tteonaljido.car.R
import io.tteonaljido.car.TripsViewModel
import io.tteonaljido.car.navi.NaviLive
import io.tteonaljido.car.safety.DriveState
import io.tteonaljido.car.safety.parked
import io.tteonaljido.car.ui.components.ButtonSize
import io.tteonaljido.car.ui.components.ButtonType
import io.tteonaljido.car.ui.components.PleosButton
import io.tteonaljido.car.ui.components.PleosCard
import io.tteonaljido.car.ui.components.PleosHeader
import io.tteonaljido.car.ui.components.PleosSystemPopup
import io.tteonaljido.car.ui.components.PleosText
import io.tteonaljido.car.ui.components.Screen
import io.tteonaljido.car.ui.components.StatusLine
import io.tteonaljido.car.ui.components.Tone
import io.tteonaljido.car.ui.issueText
import io.tteonaljido.car.ui.noteText
import io.tteonaljido.car.ui.text
import io.tteonaljido.car.ui.theme.Pleos
import io.tteonaljido.trip.Basis
import io.tteonaljido.trip.DeadlineKind
import io.tteonaljido.trip.Endpoint
import io.tteonaljido.trip.originFor
import io.tteonaljido.trip.LegFrom
import io.tteonaljido.trip.LocalTrip
import io.tteonaljido.trip.NextDestination
import io.tteonaljido.trip.Punctuality
import io.tteonaljido.trip.Severity
import io.tteonaljido.trip.Target
import io.tteonaljido.trip.TripValidator
import io.tteonaljido.trip.Visit
import io.tteonaljido.trip.zoneOrUtc
import java.util.Locale

@Composable
fun TripsScreen(vm: TripsViewModel, drive: DriveState, demoClock: Boolean, onImport: () -> Unit, onOpen: (String) -> Unit, onSettings: () -> Unit) {
    val trips by vm.trips.collectAsState()
    val unreadable by vm.unreadable.collectAsState()
    val now by vm.now.collectAsState()
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    Screen {
        PleosHeader(stringResource(R.string.app_name), stringResource(R.string.trips_subtitle)) {
            PleosButton(stringResource(if (drive.parked) R.string.import_button else R.string.parked_only), onImport, enabled = drive.parked, tag = "import")
            PleosButton(stringResource(R.string.settings), onSettings, type = ButtonType.SECONDARY, enabled = drive.parked, tag = "settings")
        }
        if (demoClock) DemoClockLine(now)
        if (unreadable > 0) StatusLine(stringResource(R.string.unreadable_files, unreadable), Tone.WARNING)
        if (trips.isEmpty()) {
            PleosCard {
                PleosText(stringResource(R.string.no_trips_title), Pleos.type.titleMedium)
                PleosText(stringResource(R.string.no_trips_body), Pleos.type.bodyLarge, secondary)
            }
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(24.dp)) {
            items(trips, key = { it.localId }) { t ->
                val todayDate = vm.today(t, now)
                val report = remember(t, todayDate) { TripValidator.validate(t.plan, t.overlay, todayDate) }
                val today = vm.todayIndex(t, now)
                val period = stringResource(R.string.labeled, periodLabel(t.plan), nightsLabel(t.plan))
                PleosCard(onClick = { onOpen(t.localId) }) {
                    PleosText(tripTitle(t), Pleos.type.titleMedium, maxLines = 1)
                    PleosText(if (today != null) stringResource(R.string.trip_card_today, period, today) else period, Pleos.type.bodyLarge, secondary, maxLines = 1)
                    PleosText(stringResource(R.string.trip_card_stats, t.plan.places.size, report.conflicts, report.uncertain, t.meta.revision), Pleos.type.bodySmall, secondary, maxLines = 1)
                    report.issues.firstOrNull { it.code == "PAST_TRIP" }?.let { StatusLine(issueText(it), Tone.WARNING) }
                }
            }
        }
    }
}

/** A detached copy keeps the plan's own name; the "(사본)" marker is metadata, added here in the UI language. */
@Composable
private fun tripTitle(t: LocalTrip): String = if (t.meta.copy) t.plan.name + stringResource(R.string.copy_suffix) else t.plan.name

/** Emulator demo clock: always visible while on, so a recorded demo never passes for real time. */
@Composable
private fun DemoClockLine(now: Long) {
    // Shown in the demo's own zone (Asia/Seoul, the sample trip's zone), not the host's, so the banner matches the demo time.
    val label = java.time.Instant.ofEpochMilli(now).atZone(java.time.ZoneId.of("Asia/Seoul")).let { String.format(Locale.ROOT, "%d/%d %02d:%02d", it.monthValue, it.dayOfMonth, it.hour, it.minute) }
    StatusLine(stringResource(R.string.demo_clock_banner, label), Tone.INFO)
}

@Composable
fun TripDetailScreen(vm: TripsViewModel, localId: String, drive: DriveState, demoClock: Boolean, onBack: () -> Unit) {
    val trips by vm.trips.collectAsState()
    val guide by vm.guide.collectAsState()
    val now by vm.now.collectAsState()
    val naviLive by vm.naviLive.collectAsState()
    val here by vm.here.collectAsState()
    val arrival by vm.lastArrival.collectAsState()
    val t = trips.firstOrNull { it.localId == localId } ?: return onBack()
    var day by remember(localId) { mutableIntStateOf(vm.todayIndex(t) ?: 1) }
    var confirmDelete by remember { mutableStateOf(false) }
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    val todayDate = vm.today(t, now)
    val report = remember(t, todayDate) { TripValidator.validate(t.plan, t.overlay, todayDate) }
    val live = remember(t, day, now, naviLive, here) { vm.live(t, day, now, naviLive, here) }

    Screen {
        PleosHeader(tripTitle(t), stringResource(R.string.detail_subtitle, periodLabel(t.plan), nightsLabel(t.plan), t.meta.revision)) {
            // While driving the card below is the whole screen; Back still works, there is nothing to tap.
            if (drive.parked) PleosButton(stringResource(R.string.list), onBack, type = ButtonType.SECONDARY, size = ButtonSize.SMALL)
        }
        if (demoClock) DemoClockLine(now)
        if (!drive.parked) {
            // Driving: one glanceable card, no scrolling, no buttons; it changes only as text.
            DrivingTripView(t, vm.todayIndex(t, now) ?: day, live, naviLive)
            return@Screen
        }
        report.issues.firstOrNull { it.code == "PAST_TRIP" }?.let { past ->
            PleosCard {
                StatusLine(issueText(past), Tone.WARNING)
                PleosButton(stringResource(R.string.delete_trip), { confirmDelete = true }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "pastDelete")
            }
        }
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            t.plan.days.forEach { d ->
                PleosButton(stringResource(R.string.day_n, d.dayIndex), { day = d.dayIndex }, type = if (d.dayIndex == day) ButtonType.PRIMARY else ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "day${d.dayIndex}")
            }
        }
        BoxWithConstraints(Modifier.fillMaxWidth().weight(1f)) {
            val wide = maxWidth >= 1000.dp
            val plan: @Composable () -> Unit = { DayPlan(t, day, live) }
            val side: @Composable () -> Unit = {
                Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    NextCard(vm, t, day, live, vm.hereFor(t, day, now, here), arrival?.takeIf { it.localId == t.localId })
                    PleosCard {
                        PleosText(stringResource(R.string.to_check), Pleos.type.titleSmall)
                        val shown = (report.forDay(day) + report.issues.filter { it.dayIndex == null }).filter { it.severity != Severity.INFO }.take(5)
                        if (shown.isEmpty()) PleosText(stringResource(R.string.nothing_to_check), Pleos.type.bodyMedium, secondary)
                        shown.forEach { SeverityLine(it.severity, issueText(it)) }
                        if (t.plan.home == null && t.overlay.home == null && (t.plan.origin is Endpoint.Home || t.plan.finalDestination is Endpoint.Home)) {
                            PleosButton(stringResource(R.string.load_navi_home), { vm.loadNaviHome(localId) }, type = ButtonType.SECONDARY, tag = "naviHome")
                        }
                    }
                    PleosButton(stringResource(R.string.delete_trip), { confirmDelete = true }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL)
                }
            }
            if (wide) Row(horizontalArrangement = Arrangement.spacedBy(32.dp)) {
                Column(Modifier.weight(0.55f).verticalScroll(rememberScrollState())) { plan() }
                Column(Modifier.weight(0.45f).verticalScroll(rememberScrollState())) { side() }
            } else Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(24.dp)) { side(); plan() }
        }
    }

    // No popups while driving: a pending one waits until the car is parked again.
    if (drive.parked) GuideDialogs(vm, guide)
    if (confirmDelete && drive.parked) {
        PleosSystemPopup(
            stringResource(R.string.delete_trip_title), stringResource(R.string.delete_trip_body), stringResource(R.string.delete), { confirmDelete = false; vm.delete(localId); onBack() },
            cancel = stringResource(R.string.cancel), onCancel = { confirmDelete = false },
        )
    }
}

/** The live status in one line, or null when there is nothing to say. */
@Composable
private fun liveStatus(t: LocalTrip, v: LiveView): Pair<String, Tone>? {
    val p = v.projection
    val head = when (p.basis) {
        Basis.NAVI_LIVE -> p.arriveNext?.let { stringResource(R.string.live_eta, TripValidator.hhmm(it)) }
        Basis.PLAN, Basis.FROM_HERE -> p.arriveNext?.let { stringResource(R.string.live_depart_now, TripValidator.hhmm(it)) }
        Basis.NONE -> null
    }
    // The binding deadline the projection chose (the more urgent of the fixed stop and the return-by time).
    val deadline = when (p.deadlineKind) {
        DeadlineKind.FIXED -> p.fixed?.let { f ->
            val fixed = t.plan.visits.first { it.visitId == f.visitId }.fixed!!
            stringResource(if (fixed.kind == Visit.Fixed.Kind.RESERVATION) R.string.deadline_reservation else R.string.deadline_fixed, fixed.time)
        }
        DeadlineKind.END_BY -> p.endBy?.let { stringResource(R.string.deadline_end_by, TripValidator.hhmm(it)) }
        DeadlineKind.NONE -> null
    }
    val slack = p.deadlineSlack
    // A missing number is said to be missing, never shown as 0.
    val tail = when {
        p.status == Punctuality.NO_DEADLINE -> null
        slack == null || p.status == Punctuality.UNKNOWN -> stringResource(R.string.live_unknown, deadline.orEmpty())
        p.status == Punctuality.ON_TIME -> stringResource(R.string.live_slack, deadline.orEmpty(), slack)
        p.status == Punctuality.TIGHT -> stringResource(R.string.live_tight, deadline.orEmpty(), slack)
        else -> stringResource(R.string.live_late, deadline.orEmpty(), -slack)
    }
    val text = listOfNotNull(head, tail).joinToString(" · ")
    if (text.isBlank()) return null
    val tone = when (p.status) {
        Punctuality.ON_TIME -> Tone.POSITIVE
        Punctuality.TIGHT, Punctuality.UNKNOWN -> Tone.WARNING
        Punctuality.LATE -> Tone.NEGATIVE
        Punctuality.NO_DEADLINE -> Tone.INFO
    }
    return (text + if (p.approximate) stringResource(R.string.live_approx) else "") to tone
}

@Composable
private fun DrivingTripView(t: LocalTrip, day: Int, live: LiveView?, naviLive: NaviLive?) {
    val step = remember(t, day) { NextDestination.of(t.plan, t.overlay, day) }
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    val label = when (val tg = step.target) {
        null -> stringResource(R.string.none)
        is Target.Final -> tg.place?.name ?: stringResource(R.string.home)
        else -> tg.label
    }
    // '꼭': the next stop has a fixed reservation time, so it must not be dropped.
    val mustKeep = (step.target as? Target.Stop)?.let { s -> t.plan.visits.first { it.visitId == s.visitId }.fixed != null } == true
    // The navigation's live remaining distance, only while it is actually guiding to this destination.
    val remainMetres = naviLive?.remainMetres?.takeIf { naviLive.guiding && live?.naviElsewhere == null }
    PleosCard {
        PleosText(stringResource(R.string.next_destination_day, day), Pleos.type.label, secondary)
        PleosText(label, Pleos.type.titleLarge, maxLines = 1)
        if (mustKeep) StatusLine(stringResource(R.string.drive_must), Tone.WARNING)
        remainMetres?.let { PleosText(stringResource(R.string.drive_remain, String.format(Locale.ROOT, "%.1f", it / 1000.0)), Pleos.type.titleMedium) }
        live?.let { v -> liveStatus(t, v)?.let { (text, tone) -> StatusLine(text, tone) } }
        PleosText(stringResource(R.string.guide_when_parked), Pleos.type.bodyMedium, secondary, maxLines = 1)
    }
}

@Composable
private fun DayPlan(t: LocalTrip, day: Int, live: LiveView?) {
    val d = t.plan.days[day - 1]
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    val times = remember(t, day) { TripValidator.timeline(t.plan, day, t.overlay).associateBy { it.visitId } }
    // Live timetable: re-timed arrivals for today's still-to-come stops (null for other days — `live` is only today's).
    val projArrive = live?.projection?.takeIf { it.dayIndex == day }?.stops?.associate { it.visitId to it.arrive } ?: emptyMap()
    val zone = remember(t) { t.plan.zoneOrUtc() }
    val home = stringResource(R.string.home)
    val start = if (t.overlay.originFor(day) != null) stringResource(R.string.origin_here)
    else if (day == 1) (if (t.plan.origin is Endpoint.Home) home else stringResource(R.string.origin_place))
    else t.plan.days[day - 2].lodgingPlaceRef?.let { TripValidator.placeName(t.plan, it) } ?: stringResource(R.string.lodging_undecided)
    @Composable
    fun legLine(k: Int) {
        val leg = TripValidator.leg(t.plan, t.overlay, day, k)
        PleosText(
            when {
                leg == null -> stringResource(R.string.leg_unknown)
                leg.minutes >= 60 -> stringResource(if (leg.from == LegFrom.NAVI) R.string.leg_navi_hm else R.string.leg_hm, leg.minutes / 60, leg.minutes % 60)
                leg.from == LegFrom.NAVI -> stringResource(R.string.leg_navi, leg.minutes)
                else -> stringResource(R.string.leg_minutes, leg.minutes)
            },
            Pleos.type.bodySmall, secondary, maxLines = 1,
        )
    }
    PleosCard {
        PleosText(stringResource(R.string.day_header, day, dateLabel(d.date)), Pleos.type.titleSmall)
        PleosText(stringResource(R.string.depart_from, start, TripValidator.departure(t.plan, day, t.overlay)?.let(TripValidator::hhmm) ?: stringResource(R.string.time_unknown)), Pleos.type.bodyMedium, secondary)
        legLine(0)
        d.visitOrder.forEachIndexed { k, id ->
            val v = t.plan.visits.first { it.visitId == id }
            val time = times[id]?.start?.let(TripValidator::hhmm) ?: stringResource(R.string.time_check)
            val visitedAt = t.overlay.visitedAt[id]?.let { java.time.Instant.ofEpochMilli(it.at).atZone(zone).let { z -> String.format(Locale.ROOT, "%02d:%02d", z.hour, z.minute) } }
            val marks = (if (v.fixed != null) stringResource(R.string.stop_fixed) else "") +
                when {
                    id in t.overlay.skipped -> stringResource(R.string.stop_skipped)
                    id in t.overlay.visited && visitedAt != null -> stringResource(R.string.stop_visited_at, visitedAt)
                    id in t.overlay.visited -> stringResource(R.string.stop_visited)
                    id in t.overlay.deferred -> stringResource(R.string.stop_deferred)
                    else -> ""
                }
            PleosText(stringResource(R.string.stop_line, k + 1, time, TripValidator.placeName(t.plan, v.placeRef)) + marks, Pleos.type.bodyLarge, maxLines = 1)
            projArrive[id]?.let { now ->
                val planned = times[id]?.arrive
                PleosText(
                    if (planned != null) stringResource(R.string.stop_eta_now, TripValidator.hhmm(now), TripValidator.hhmm(planned))
                    else stringResource(R.string.stop_eta_now_noplan, TripValidator.hhmm(now)),
                    Pleos.type.bodySmall, secondary, maxLines = 1,
                )
            }
            legLine(k + 1)
        }
        val last = day == t.plan.days.size
        val end = if (last) (t.plan.finalDestination as? Endpoint.AtPlace)?.let { TripValidator.placeName(t.plan, it.placeRef) } ?: home
        else d.lodgingPlaceRef?.let { TripValidator.placeName(t.plan, it) } ?: stringResource(R.string.lodging_undecided)
        PleosText(stringResource(if (last) R.string.return_to else R.string.stay_at, end), Pleos.type.bodyLargeStrong, maxLines = 1)
    }
}

@Composable
private fun NextCard(vm: TripsViewModel, t: LocalTrip, day: Int, live: LiveView?, here: HereEstimate?, arrival: ArrivalNote?) {
    val step = remember(t, day) { NextDestination.of(t.plan, t.overlay, day) }
    // "오늘 경로 전송" needs at least two upcoming stops with coordinates (destination + ≥1 waypoint).
    val canBundle = remember(t, day) {
        NextDestination.upcoming(t.plan, t.overlay, day).count { id ->
            t.plan.visits.firstOrNull { it.visitId == id }?.placeRef?.let { ref -> t.plan.places.firstOrNull { it.placeRef == ref }?.latE7 } != null
        } >= 2
    }
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    val home = stringResource(R.string.home)
    val label = when (val tg = step.target) {
        null -> stringResource(R.string.none)
        is Target.Final -> tg.place?.name ?: home
        else -> tg.label
    }
    val zone = remember(t) { t.plan.zoneOrUtc() }
    fun clock(ms: Long) = java.time.Instant.ofEpochMilli(ms).atZone(zone).let { String.format(Locale.ROOT, "%02d:%02d", it.hour, it.minute) }
    PleosCard {
        PleosText(stringResource(R.string.next_destination_day, day), Pleos.type.label, secondary)
        PleosText(label, Pleos.type.titleMedium, maxLines = 1)
        val note = noteText(step)
        if (note.isNotBlank()) PleosText(note, Pleos.type.bodyMedium, secondary, maxLines = 1)
        live?.let { v ->
            liveStatus(t, v)?.let { (text, tone) -> StatusLine(text, tone) }
            v.naviElsewhere?.let { StatusLine(stringResource(R.string.live_navi_elsewhere, it), Tone.INFO) }
        }
        here?.socAtDest?.let { soc -> StatusLine(stringResource(if (soc < LOW_SOC) R.string.soc_low else R.string.soc_at_dest, soc), if (soc < LOW_SOC) Tone.WARNING else Tone.INFO) }
        val lowSoc = (here?.socAtDest?.let { it < LOW_SOC } == true) || vm.naviLive.collectAsState().value?.lowBattery == true
        arrival?.let { a -> StatusLine(stringResource(if (a.demo) R.string.auto_arrived_demo else R.string.auto_arrived, a.name, clock(a.at)), Tone.POSITIVE) }
        val skip = live?.projection?.skip
        val defer = live?.projection?.defer
        // Skip and defer point at the same optional stop; show one banner naming it, then offer both choices.
        skip?.let { s -> StatusLine(stringResource(R.string.skip_suggest, TripValidator.placeName(t.plan, t.plan.visits.first { it.visitId == s.visitId }.placeRef)), Tone.WARNING) }
        val skippedToday = t.plan.days[day - 1].visitOrder.filter { it in t.overlay.skipped }
        val deferredToday = t.plan.days[day - 1].visitOrder.filter { it in t.overlay.deferred }
        // Marking an arrival or starting from here only makes sense for the day you are on.
        val isToday = vm.todayIndex(t) == day
        FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            PleosButton(stringResource(R.string.guide_next), { vm.guideNext(t.localId, day) }, enabled = step.target != null, tag = "guide")
            if (canBundle) PleosButton(stringResource(R.string.guide_today), { vm.guideToday(t.localId, day) }, type = ButtonType.SECONDARY, tag = "guideToday")
            (step.target as? Target.Stop)?.let { s -> PleosButton(stringResource(R.string.mark_arrived), { vm.markVisited(t.localId, s.visitId) }, type = ButtonType.SECONDARY, enabled = isToday, tag = "visited") }
            PleosButton(stringResource(R.string.depart_here), { vm.departHere(t.localId, day) }, type = ButtonType.SECONDARY, enabled = isToday, tag = "departHere")
            if (t.overlay.originFor(day) != null) PleosButton(stringResource(R.string.undo_depart), { vm.undoDepartHere(t.localId, day) }, type = ButtonType.SECONDARY, tag = "undoDepart")
        }
        if (skip != null || defer != null || arrival?.visitId != null || skippedToday.isNotEmpty() || deferredToday.isNotEmpty() || lowSoc) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                skip?.let { s -> PleosButton(stringResource(R.string.skip), { vm.skip(t.localId, s.visitId) }, size = ButtonSize.SMALL, tag = "skip") }
                defer?.let { s -> PleosButton(stringResource(R.string.defer_back), { vm.defer(t.localId, s.visitId) }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "defer") }
                arrival?.visitId?.let { id -> PleosButton(stringResource(R.string.undo_arrival), { vm.undoVisited(t.localId, id) }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "undoArrival") }
                skippedToday.lastOrNull()?.let { PleosButton(stringResource(R.string.unskip_last), { vm.unskip(t.localId, it) }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "unskip") }
                deferredToday.lastOrNull()?.let { PleosButton(stringResource(R.string.undefer_last), { vm.undefer(t.localId, it) }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "undefer") }
                if (lowSoc) PleosButton(stringResource(R.string.nearby_chargers), vm::openChargers, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "chargers")
            }
        }
    }
}

/** Our own threshold for a low battery at the destination (the navigation's estimate), stated as such in the docs. */
private const val LOW_SOC = 20

@Composable
private fun GuideDialogs(vm: TripsViewModel, g: Guide) {
    when (g) {
        Guide.Idle -> Unit
        is Guide.Working -> PleosSystemPopup(stringResource(R.string.wait_title), text(g.msg), stringResource(R.string.close), vm::dismissGuide)
        is Guide.ConfirmReplace -> PleosSystemPopup(
            stringResource(R.string.replace_title), stringResource(R.string.replace_body, g.current, g.target), stringResource(R.string.replace_yes), { vm.confirmReplace() },
            cancel = stringResource(R.string.replace_no), onCancel = vm::dismissGuide,
        )
        is Guide.ConfirmPlace -> {
            val distance = if (g.metres >= 1000) String.format(Locale.ROOT, "%.1fkm", g.metres / 1000.0) else "${g.metres}m"
            PleosSystemPopup(
                stringResource(R.string.place_title),
                if (g.metres < 0) stringResource(R.string.place_body_unknown, g.found.name, g.wanted) else stringResource(R.string.place_body_distance, g.found.name, g.wanted, distance),
                stringResource(R.string.place_yes), vm::acceptPlace, cancel = stringResource(R.string.place_search_again), onCancel = vm::searchInNavi,
            )
        }
        is Guide.ConfirmHome -> PleosSystemPopup(
            stringResource(R.string.home_title),
            stringResource(R.string.home_body, g.home.address.ifBlank { g.home.name }.ifBlank { stringResource(R.string.home_bookmark) }),
            stringResource(R.string.use), vm::acceptHome, cancel = stringResource(R.string.cancel), onCancel = vm::dismissGuide,
        )
        is Guide.Done -> PleosSystemPopup(stringResource(R.string.done_title), text(g.msg), stringResource(R.string.confirm), vm::dismissGuide)
        is Guide.Failed -> if (g.canSearch) PleosSystemPopup(
            stringResource(R.string.failed_title), text(g.msg), stringResource(R.string.search_in_navi), vm::searchInNavi,
            cancel = stringResource(R.string.close), onCancel = vm::dismissGuide,
        )
        else PleosSystemPopup(stringResource(R.string.cannot_guide_title), text(g.msg), stringResource(R.string.confirm), vm::dismissGuide)
    }
}

@Composable
fun SettingsScreen(
    vm: TripsViewModel,
    isEmulator: Boolean,
    demo: Boolean,
    demoDriving: Boolean,
    demoClock: Boolean,
    autoArrive: Boolean,
    server: String,
    onDemo: (Boolean) -> Unit,
    onDemoDriving: (Boolean) -> Unit,
    onDemoClock: (Boolean) -> Unit,
    onDemoArrive: () -> Unit,
    onAutoArrive: (Boolean) -> Unit,
    onBack: () -> Unit,
) {
    var confirm by remember { mutableStateOf(false) }
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    Screen {
        PleosHeader(stringResource(R.string.settings)) { PleosButton(stringResource(R.string.list), onBack, type = ButtonType.SECONDARY, size = ButtonSize.SMALL) }
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(24.dp)) {
            PleosCard {
                PleosText(stringResource(R.string.settings_guide_title), Pleos.type.titleSmall)
                PleosText(stringResource(R.string.settings_auto_arrive_body), Pleos.type.bodyMedium, secondary)
                PleosButton(stringResource(if (autoArrive) R.string.settings_auto_arrive_on else R.string.settings_auto_arrive_off), { onAutoArrive(!autoArrive) }, type = ButtonType.SECONDARY, tag = "autoArrive")
            }
            PleosCard {
                PleosText(stringResource(R.string.privacy), Pleos.type.titleSmall)
                PleosText(stringResource(R.string.privacy_body), Pleos.type.bodyMedium, secondary)
                PleosText(stringResource(R.string.privacy_rental), Pleos.type.bodyMedium, secondary)
                PleosButton(stringResource(R.string.delete_all), { confirm = true }, type = ButtonType.SECONDARY, tag = "deleteAll")
            }
            if (isEmulator) PleosCard {
                PleosText(stringResource(R.string.demo_title), Pleos.type.titleSmall)
                PleosText(stringResource(R.string.demo_body), Pleos.type.bodyMedium, secondary)
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    PleosButton(stringResource(if (demo) R.string.demo_off else R.string.demo_on), { onDemo(!demo) }, type = ButtonType.SECONDARY, tag = "demo")
                    if (demo) PleosButton(stringResource(if (demoDriving) R.string.demo_driving_off else R.string.demo_driving_on), { onDemoDriving(!demoDriving) }, type = ButtonType.SECONDARY, tag = "demoDriving")
                }
                // The demo clock and the demo arrival only exist with the demo store, so real trips never get demo timestamps.
                if (demo) {
                    PleosText(stringResource(R.string.demo_time_body), Pleos.type.bodyMedium, secondary)
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        PleosButton(stringResource(if (demoClock) R.string.demo_clock_off else R.string.demo_clock_on), { onDemoClock(!demoClock) }, type = ButtonType.SECONDARY, tag = "demoClock")
                        PleosButton(stringResource(R.string.demo_arrive), onDemoArrive, type = ButtonType.SECONDARY, tag = "demoArrive")
                    }
                }
            }
            PleosCard {
                PleosText(stringResource(R.string.about), Pleos.type.titleSmall)
                PleosText(stringResource(R.string.about_body, BuildConfig.VERSION_NAME, server.removePrefix("https://").removePrefix("http://")), Pleos.type.bodySmall, secondary)
            }
        }
    }
    if (confirm) PleosSystemPopup(
        stringResource(R.string.delete_all_title), stringResource(R.string.delete_all_body), stringResource(R.string.delete), { confirm = false; vm.deleteAll() },
        cancel = stringResource(R.string.cancel), onCancel = { confirm = false },
    )
}
