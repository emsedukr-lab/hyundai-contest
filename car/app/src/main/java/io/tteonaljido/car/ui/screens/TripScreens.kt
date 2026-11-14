package io.tteonaljido.car.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.produceState
import io.tteonaljido.trip.CarOrder
import io.tteonaljido.trip.NaviMeasure
import io.tteonaljido.trip.RouteOptimizer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.dimensionResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.tteonaljido.car.BuildConfig
import io.tteonaljido.car.Guide
import io.tteonaljido.car.HereEstimate
import io.tteonaljido.car.LiveView
import io.tteonaljido.car.R
import io.tteonaljido.car.TripsViewModel
import io.tteonaljido.car.guide.ArrivalNote
import io.tteonaljido.car.navi.NaviLive
import io.tteonaljido.car.safety.DriveState
import io.tteonaljido.car.safety.parked
import io.tteonaljido.car.ui.components.ActionGrid
import io.tteonaljido.car.ui.components.ButtonSize
import io.tteonaljido.car.ui.components.ButtonType
import io.tteonaljido.car.ui.components.MustTag
import io.tteonaljido.car.ui.components.Dot
import io.tteonaljido.car.ui.components.Icon
import io.tteonaljido.car.ui.components.ListRow
import io.tteonaljido.car.ui.components.PleosButton
import io.tteonaljido.car.ui.components.PleosCard
import io.tteonaljido.car.ui.components.PleosSystemPopup
import io.tteonaljido.car.ui.components.PleosText
import io.tteonaljido.car.ui.components.Radius
import io.tteonaljido.car.ui.components.Space
import io.tteonaljido.car.ui.components.RowDivider
import io.tteonaljido.car.ui.components.Screen
import io.tteonaljido.car.ui.components.SectionLabel
import io.tteonaljido.car.ui.components.StatusLine
import io.tteonaljido.car.ui.components.SwitchRow
import io.tteonaljido.car.ui.components.Tag
import io.tteonaljido.car.ui.components.Tone
import io.tteonaljido.car.ui.components.PleosHeader
import io.tteonaljido.trip.Issue
import io.tteonaljido.car.ui.badgeText
import io.tteonaljido.car.ui.components.PleosOverflowMenu
import io.tteonaljido.car.ui.components.MenuItem
import io.tteonaljido.car.ui.components.PleosIconButton
import io.tteonaljido.car.ui.components.SegmentedControl
import io.tteonaljido.car.ui.components.weakFace
import io.tteonaljido.car.ui.issueText
import io.tteonaljido.car.ui.noteText
import io.tteonaljido.car.ui.text
import io.tteonaljido.car.ui.theme.Pleos
import io.tteonaljido.trip.Basis
import io.tteonaljido.trip.DeadlineKind
import io.tteonaljido.trip.DriveMode
import io.tteonaljido.trip.Endpoint
import io.tteonaljido.trip.FluidLevel
import io.tteonaljido.trip.LocalTrip
import io.tteonaljido.trip.NextDestination
import io.tteonaljido.trip.Punctuality
import io.tteonaljido.trip.RestAdvice
import io.tteonaljido.trip.TripFindings
import io.tteonaljido.trip.Severity
import io.tteonaljido.trip.Target
import io.tteonaljido.trip.TripOverview
import io.tteonaljido.trip.TripValidator
import io.tteonaljido.trip.TripWhen
import io.tteonaljido.trip.VehicleSnapshot
import io.tteonaljido.trip.Visit
import io.tteonaljido.trip.originFor
import io.tteonaljido.trip.zoneOrUtc
import java.util.Locale

/* ---------- trip list: the next trip, then the others (phone M45 여행 tab) ---------- */

@Composable
fun TripsScreen(vm: TripsViewModel, drive: DriveState, demoClock: Boolean, onImport: () -> Unit, onOpen: (String) -> Unit, onSettings: () -> Unit) {
    val trips by vm.trips.collectAsState()
    val unreadable by vm.unreadable.collectAsState()
    val now by vm.now.collectAsState()
    val secondary = colorResource(R.color.tn_text_secondary)
    Screen(header = {
        PleosHeader(stringResource(R.string.app_name), stringResource(R.string.trips_subtitle)) {
            PleosButton(stringResource(if (drive.parked) R.string.import_button else R.string.parked_only), onImport, enabled = drive.parked, tag = "import")
            PleosButton(stringResource(R.string.settings), onSettings, type = ButtonType.BASIC, enabled = drive.parked, tag = "settings")
        }
    }) {
        if (demoClock) DemoClockLine(now)
        if (unreadable > 0) StatusLine(stringResource(R.string.unreadable_files, unreadable), Tone.CAUTION)
        if (trips.isEmpty()) {
            PleosCard {
                PleosText(stringResource(R.string.no_trips_title), Pleos.type.titleMedium)
                PleosText(stringResource(R.string.no_trips_body), Pleos.type.bodyLarge, secondary)
            }
            return@Screen
        }
        val today = { t: LocalTrip -> vm.today(t, now) }
        val next = remember(trips, now) { TripOverview.pickNext(trips, { it.view }, today) }
        val others = remember(trips, now, next) { TripOverview.sortOthers(trips.filter { it !== next }, { it.view }, today) }
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Space.x16)) {
            next?.let { t ->
                SectionLabel(stringResource(R.string.next_trip))
                NextTripCard(t, today(t)) { onOpen(t.localId) }
            }
            if (others.isNotEmpty()) {
                SectionLabel(stringResource(R.string.other_trips), Modifier.padding(top = Space.x16))
                PleosCard(padding = Space.x24, gap = 0.dp) {
                    others.forEachIndexed { i, t ->
                        if (i > 0) RowDivider()
                        ListRow(tripTitle(t), stringResource(R.string.labeled, periodLabel(t.view), nightsLabel(t.view)), onClick = { onOpen(t.localId) }) {
                            val w = TripOverview.tripWhen(t.view.startDate, t.view.endDate, today(t))
                            Tag(whenLabel(w))
                        }
                    }
                }
            }
            Spacer(Modifier.height(Space.x24))
        }
    }
}

@Composable
private fun whenLabel(w: TripWhen): String = when (w) {
    is TripWhen.Ahead -> if (w.days == 1) stringResource(R.string.when_tomorrow) else stringResource(R.string.when_in_days, w.days)
    TripWhen.StartsToday -> stringResource(R.string.when_today)
    is TripWhen.OnDay -> stringResource(R.string.when_on_day, w.day)
    TripWhen.Past -> stringResource(R.string.when_past)
}

/** 다음 여행: when it leaves, the name, the period, the whole route (the screen's one bright element), what to check, and the row that says it opens. */
@Composable
private fun NextTripCard(t: LocalTrip, today: java.time.LocalDate, onClick: () -> Unit) {
    val w = remember(t, today) { TripOverview.tripWhen(t.view.startDate, t.view.endDate, today) }
    val report = remember(t, today) { TripValidator.validate(t.view, t.overlay, today) }
    val found = remember(report) { TripFindings.of(report) }
    val sketch = remember(t) { TripOverview.sketch(t.view, 300.0, 240.0, 18.0) }
    val secondary = colorResource(R.color.tn_text_secondary)
    PleosCard(onClick = onClick, padding = Space.x32, gap = Space.x24) {
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val wide = maxWidth > dimensionResource(R.dimen.pleos_window_apps_portrait_width)
            val head: @Composable () -> Unit = {
                Column(verticalArrangement = Arrangement.spacedBy(Space.x8)) {
                    // When it leaves: weight carries the emphasis (no accent color), a past trip steps back to secondary.
                    PleosText(whenLabel(w), Pleos.type.bodyMedium, if (w is TripWhen.Past) secondary else colorResource(R.color.tn_text_primary), maxLines = 1)
                    PleosText(tripTitle(t), Pleos.type.titleLarge, maxLines = 2)
                    PleosText(stringResource(R.string.trip_summary, periodLabel(t.view), nightsLabel(t.view), t.view.places.size), Pleos.type.bodyMediumNormal, secondary, maxLines = 2)
                }
            }
            // Counted: only what a person has to settle; what the navigation fills in is not a warning (TripFindings).
            val foot: @Composable () -> Unit = {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.x12)) {
                    val past = report.issues.firstOrNull { it.code == "PAST_TRIP" }
                    when {
                        past != null -> Tag(issueText(past), Tone.CAUTION, Modifier.weight(1f, fill = false))
                        found.clear -> PleosText(stringResource(R.string.all_clear), Pleos.type.bodyMediumNormal, secondary, maxLines = 1)
                        else -> {
                            if (found.conflicts > 0) Tag(stringResource(R.string.count_conflicts, found.conflicts), Tone.ERROR)
                            if (found.toCheck > 0) Tag(stringResource(R.string.count_uncertain, found.toCheck), Tone.CAUTION)
                        }
                    }
                    Spacer(Modifier.weight(1f))
                    PleosText(stringResource(R.string.rev, t.meta.revision), Pleos.type.bodySmall, secondary, maxLines = 1)
                }
            }
            // The card's action, said out loud: a button-height row at the foot of the text. The whole card is the
            // touch target (one node for a screen reader), so this row is a face and a label, not a second button.
            val open: @Composable () -> Unit = {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = dimensionResource(R.dimen.pleos_buttons_basic_medium_height))
                        .clip(RoundedCornerShape(Radius.r24))
                        .background(weakFace())
                        .padding(start = Space.x32, end = Space.x20),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PleosText(stringResource(R.string.open_trip), Pleos.type.bodyLargeStrong, modifier = Modifier.weight(1f), maxLines = 1)
                    Icon(R.drawable.ic_chevron, Space.x40, colorResource(R.color.tn_text_secondary))
                }
            }
            val drawing: @Composable (Modifier) -> Unit = { m ->
                if (sketch.plotted >= 2) RouteSketch(sketch, w.focusDay, stringResource(R.string.sketch_desc, t.view.name), m)
                else Box(m.padding(vertical = Space.x24)) { PleosText(stringResource(R.string.no_route), Pleos.type.bodySmall, secondary, maxLines = 2) }
            }
            // Wide: the text starts level with the sketch's top and the open row ends level with its bottom.
            if (wide) Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(Space.x48)) {
                Column(Modifier.weight(0.45f).fillMaxHeight(), verticalArrangement = Arrangement.SpaceBetween) {
                    head()
                    Column(Modifier.padding(top = Space.x32), verticalArrangement = Arrangement.spacedBy(Space.x20)) { foot(); open() }
                }
                drawing(Modifier.weight(0.55f))
            } else Column(verticalArrangement = Arrangement.spacedBy(Space.x24)) { head(); drawing(Modifier.fillMaxWidth()); foot(); open() }
        }
    }
}

/** A detached copy keeps the plan's own name; the "(사본)" marker is metadata, added here in the UI language. */
@Composable
private fun tripTitle(t: LocalTrip): String = if (t.meta.copy) t.view.name + stringResource(R.string.copy_suffix) else t.view.name

/** Emulator demo clock: always visible while on, so a recorded demo never passes for real time. */
@Composable
private fun DemoClockLine(now: Long) {
    // Shown in the demo's own zone (Asia/Seoul, the sample trip's zone), not the host's, so the banner matches the demo time.
    val label = java.time.Instant.ofEpochMilli(now).atZone(java.time.ZoneId.of("Asia/Seoul")).let { String.format(Locale.ROOT, "%d/%d %02d:%02d", it.monthValue, it.dayOfMonth, it.hour, it.minute) }
    Tag(stringResource(R.string.demo_clock_banner, label), Tone.NEUTRAL)
}

/* ---------- trip detail: the day's route on the left, the next destination on the right ---------- */

@Composable
fun TripDetailScreen(vm: TripsViewModel, localId: String, drive: DriveState, demoClock: Boolean, onBack: () -> Unit) {
    val trips by vm.trips.collectAsState()
    val guide by vm.guide.collectAsState()
    val now by vm.now.collectAsState()
    val naviLive by vm.naviLive.collectAsState()
    val here by vm.here.collectAsState()
    val arrival by vm.lastArrival.collectAsState()
    val energy by vm.energy.collectAsState()
    val vehicle by vm.vehicle.collectAsState()
    val session by vm.drive.collectAsState()
    // M60: a first leg nobody could time (the trip starts "where the car is") is asked from the navigation while parked.
    val naviStatus by vm.naviStatus.collectAsState()
    val resumed by vm.resumed.collectAsState()
    LaunchedEffect(localId, drive.parked, naviStatus, resumed) { if (drive.parked) vm.measureFirstLeg(localId) }
    val t = trips.firstOrNull { it.localId == localId } ?: return onBack()
    var day by remember(localId) { mutableIntStateOf(vm.todayIndex(t) ?: 1) }
    // The schedule follows the calendar: on the trip's 2nd date it shows day 2, and moves on by itself when midnight passes while the screen is open.
    val calendarDay = vm.todayIndex(t, now)
    LaunchedEffect(calendarDay) { if (calendarDay != null) day = calendarDay }
    var confirmDelete by remember { mutableStateOf(false) }
    val todayDate = vm.today(t, now)
    val report = remember(t, todayDate) { TripValidator.validate(t.view, t.overlay, todayDate) }
    val live = remember(t, day, now, naviLive, here, energy, vehicle) { vm.live(t, day, now, naviLive, here) }
    // M57: what the car reported, read against today's plan. Both exist only for the day the car is actually on.
    val isToday = vm.todayIndex(t, now) == day
    val rest = remember(now, live, naviLive, vehicle, session) { vm.rest(now, live, naviLive, session) }
    val departure = remember(live, vehicle, energy) { if (isToday) vm.departure(live) else null }

    // The day switch sits in the header only when the window has room for it beside the title and the menu; a narrower window
    // (half screen, more days) puts it on its own row under the header instead of cutting its last day off.
    BoxWithConstraints(Modifier.fillMaxSize()) {
    val narrowHeader = t.view.days.size > 1 && maxWidth < (800 + 125 * t.view.days.size).dp
    Screen(header = {
        // While driving the card below is the whole screen; Back still works, there is nothing to tap.
        PleosHeader(
            tripTitle(t),
            // The period only: the nights are in the title, and a revision is named from the second import on.
            if (t.meta.revision > 1) stringResource(R.string.detail_subtitle_rev, periodLabel(t.view), t.meta.revision) else periodLabel(t.view),
            onBack = if (drive.parked) onBack else null,
        ) {
            // The day switch sits at the top right of the header; one day has nothing to switch between.
            if (drive.parked && t.view.days.size > 1 && !narrowHeader) {
                val chipLabels = t.view.days.associate { it.dayIndex to stringResource(R.string.day_n, it.dayIndex) }
                SegmentedControl(t.view.days.map { it.dayIndex }, day, { chipLabels.getValue(it) }, { "day$it" }, Modifier, scroll = false) { day = it }
            }
            // 더보기: what is rarely needed sits in a menu at the far right, apart from the day switch — putting the start or
            // the visit order back, and removing the trip (the popup that follows asks before anything is deleted).
            if (drive.parked) {
                Spacer(Modifier.width(Space.x16))
                val undoDepart = stringResource(R.string.undo_depart)
                val resetOrder = stringResource(R.string.order_reset_btn)
                val deleteTrip = stringResource(R.string.delete_trip)
                val hasCarOrder = remember(t, day) { CarOrder.of(t.plan, t.overlay, day) != null }
                PleosOverflowMenu(stringResource(R.string.more), buildList {
                    if (t.overlay.originFor(t.view, day) != null) add(MenuItem(undoDepart, "undoDepart") { vm.undoDepartHere(t.localId, day) })
                    if (hasCarOrder) add(MenuItem(resetOrder, "resetOrder") { vm.resetOrder(t.localId, day) })
                    add(MenuItem(deleteTrip, deleteTrip, destructive = true) { confirmDelete = true })
                })
                // Keep clear of the window's right edge, so the day switch and the menu are never cut off there.
                Spacer(Modifier.width(80.dp))
            }
        }
    }) {
        if (demoClock) DemoClockLine(now)
        if (!drive.parked) {
            // Driving: one glanceable card, no scrolling, no buttons; it changes only as text.
            DrivingTripView(t, vm.todayIndex(t, now) ?: day, live, naviLive, rest)
            return@Screen
        }
        report.issues.firstOrNull { it.code == "PAST_TRIP" }?.let { past ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.x16)) {
                Tag(issueText(past), Tone.CAUTION, large = true)
                PleosButton(stringResource(R.string.delete_trip), { confirmDelete = true }, type = ButtonType.BASIC, size = ButtonSize.SMALL, tag = "pastDelete")
            }
        }
        if (drive.parked && narrowHeader) {
            val chipLabels = t.view.days.associate { it.dayIndex to stringResource(R.string.day_n, it.dayIndex) }
            SegmentedControl(t.view.days.map { it.dayIndex }, day, { chipLabels.getValue(it) }, { "day$it" }) { day = it }
        }
        val found = remember(report, day) { TripFindings.of(report, day) }
        BoxWithConstraints(Modifier.fillMaxWidth().weight(1f)) {
            val wide = maxWidth > dimensionResource(R.dimen.pleos_window_apps_portrait_width)
            val route: @Composable () -> Unit = {
                Column(Modifier.fillMaxWidth()) {
                    DayHeading(t, day)
                    // Findings tied to no single stop (a missing lodging, a late finish) sit under the heading as badges; stop-level ones are on the stop cards.
                    found.person.filter { it.visitId == null }.take(4).forEach {
                        Tag(issueText(it), if (it.severity == Severity.CONFLICT) Tone.ERROR else Tone.CAUTION, Modifier.padding(bottom = Space.x8), maxLines = 2)
                    }
                    DayTimeline(t, day, live, found.person)
                }
            }
            val side: @Composable () -> Unit = {
                Column(verticalArrangement = Arrangement.spacedBy(Space.x24)) {
                    NextPanel(vm, t, day, live, vm.hereFor(t, day, now, here), arrival?.takeIf { it.localId == t.localId }, naviLive, rest.takeIf { isToday }, found.person)
                    departure?.let { DepartureCard(it) }
                }
            }
            if (wide) Row(horizontalArrangement = Arrangement.spacedBy(Space.x40)) {
                Column(Modifier.weight(2f).verticalScroll(rememberScrollState())) { route(); Spacer(Modifier.height(Space.x32)) }
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) { side(); Spacer(Modifier.height(Space.x32)) }
            } else Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Space.x32)) {
                // Half screen (840dp): what to do next first, then the day.
                NextPanel(vm, t, day, live, vm.hereFor(t, day, now, here), arrival?.takeIf { it.localId == t.localId }, naviLive, rest.takeIf { isToday }, found.person)
                departure?.let { DepartureCard(it) }
                route()
                Spacer(Modifier.height(Space.x32))
            }
        }
    }

    }
    // No popups while driving: a pending one waits until the car is parked again.
    if (drive.parked) GuideDialogs(vm, guide)
    if (confirmDelete && drive.parked) {
        PleosSystemPopup(
            stringResource(R.string.delete_trip_title), stringResource(R.string.delete_trip_body), stringResource(R.string.delete), { confirmDelete = false; vm.delete(localId); onBack() },
            cancel = stringResource(R.string.cancel), onCancel = { confirmDelete = false }, destructive = true,
        )
    }
}

/** The live status: how it goes now ([head]) and against the binding deadline ([tail], shown as a tag). */
private data class LiveLine(val head: String?, val tail: String?, val tone: Tone)

@Composable
private fun liveStatus(t: LocalTrip, v: LiveView): LiveLine? {
    val p = v.projection
    val approx = if (p.approximate) stringResource(R.string.live_approx) else ""
    val head = when (p.basis) {
        Basis.NAVI_LIVE -> p.arriveNext?.let { stringResource(R.string.live_eta, TripValidator.hhmm(it)) }
        Basis.PLAN, Basis.FROM_HERE -> p.arriveNext?.let { stringResource(R.string.live_depart_now, TripValidator.hhmm(it)) }
        Basis.NONE -> null
    }
    // The binding deadline the projection chose (the more urgent of the fixed stop and the return-by time).
    val deadline = when (p.deadlineKind) {
        DeadlineKind.FIXED -> p.fixed?.let { f ->
            val fixed = t.view.visits.first { it.visitId == f.visitId }.fixed!!
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
    if (head == null && tail == null) return null
    val tone = when (p.status) {
        Punctuality.ON_TIME -> Tone.OK
        Punctuality.TIGHT, Punctuality.UNKNOWN -> Tone.CAUTION
        Punctuality.LATE -> Tone.ERROR
        Punctuality.NO_DEADLINE -> Tone.NEUTRAL
    }
    return if (head != null) LiveLine(head + approx, tail, tone) else LiveLine(null, tail + approx, tone)
}

@Composable
private fun LiveLines(l: LiveLine, large: Boolean) {
    l.head?.let { PleosText(it, if (large) Pleos.type.titleSmall else Pleos.type.bodyLarge, maxLines = 2) }
    l.tail?.let { Tag(it, l.tone, large = true, maxLines = 2) }
}

@Composable
private fun DrivingTripView(t: LocalTrip, day: Int, live: LiveView?, naviLive: NaviLive?, rest: RestAdvice?) {
    val step = remember(t, day) { NextDestination.of(t.view, t.overlay, day) }
    val secondary = colorResource(R.color.tn_text_secondary)
    val label = when (val tg = step.target) {
        null -> stringResource(R.string.none)
        is Target.Final -> tg.place?.name ?: stringResource(R.string.home)
        else -> tg.label
    }
    // '꼭': the next stop has a fixed reservation time, so it must not be dropped.
    val mustKeep = (step.target as? Target.Stop)?.let { s -> t.view.visits.first { it.visitId == s.visitId }.fixed != null } == true
    // The navigation's live remaining distance to this stop: its destination's, or on a multi-stop route the waypoint's.
    val remainMetres = live?.naviRemainMetres
    PleosCard(padding = Space.x48, gap = Space.x20) {
        PleosText(stringResource(R.string.next_destination_day, day), Pleos.type.bodyMedium, secondary, maxLines = 1)
        PleosText(label, Pleos.type.headline, maxLines = 1)
        if (mustKeep) MustTag(stringResource(R.string.drive_must), large = true)
        remainMetres?.let { PleosText(stringResource(R.string.drive_remain, String.format(Locale.ROOT, "%.1f", it / 1000.0)), Pleos.type.titleMedium) }
        live?.let { v -> liveStatus(t, v)?.let { LiveLines(it, large = true) } }
        // Still text only: congestion on the route, and a break when one is due (no buttons while driving).
        if (live?.naviElsewhere == null) trafficText(naviLive)?.let { PleosText(it, Pleos.type.bodyLarge, secondary, maxLines = 1) }
        rest?.let { r ->
            val (why, what) = restTexts(r)
            Tag(why, Tone.CAUTION, large = true)
            PleosText(what, Pleos.type.bodyLarge, maxLines = 2)
        }
        PleosText(stringResource(R.string.guide_when_parked), Pleos.type.bodyMediumNormal, secondary, maxLines = 1)
    }
}

/** 다음 목적지: the name, how it goes against the next fixed time, and what can be done about it here. */
@Composable
private fun NextPanel(vm: TripsViewModel, t: LocalTrip, day: Int, live: LiveView?, here: HereEstimate?, arrival: ArrivalNote?, naviLive: NaviLive?, rest: RestAdvice?, issues: List<Issue> = emptyList()) {
    val step = remember(t, day) { NextDestination.of(t.view, t.overlay, day) }
    // "오늘 경로 전송" needs at least two upcoming stops with coordinates (destination + ≥1 waypoint).
    val canBundle = remember(t, day) {
        NextDestination.upcoming(t.view, t.overlay, day).count { id ->
            t.view.visits.firstOrNull { it.visitId == id }?.placeRef?.let { ref -> t.view.places.firstOrNull { it.placeRef == ref }?.latE7 } != null
        } >= 2
    }
    val secondary = colorResource(R.color.tn_text_secondary)
    val home = stringResource(R.string.home)
    val label = when (val tg = step.target) {
        null -> stringResource(R.string.none)
        is Target.Final -> tg.place?.name ?: home
        else -> tg.label
    }
    val zone = remember(t) { t.view.zoneOrUtc() }
    fun clock(ms: Long) = java.time.Instant.ofEpochMilli(ms).atZone(zone).let { String.format(Locale.ROOT, "%02d:%02d", it.hour, it.minute) }
    PleosCard(gap = Space.x16) {
        PleosText(stringResource(R.string.next_destination), Pleos.type.bodyMedium, secondary, maxLines = 1)
        PleosText(label, Pleos.type.titleLarge, maxLines = 2)
        // What the timeline flags on this stop (closed, late for a fixed time) is said here too, before guidance starts.
        (step.target as? Target.Stop)?.let { stop ->
            issues.filter { it.visitId == stop.visitId }.forEach { Tag(badgeText(it), if (it.severity == Severity.CONFLICT) Tone.ERROR else Tone.CAUTION, maxLines = 2) }
        }
        val note = noteText(step)
        if (note.isNotBlank()) PleosText(note, Pleos.type.bodyMediumNormal, secondary, maxLines = 1)
        live?.let { v ->
            liveStatus(t, v)?.let { LiveLines(it, large = false) }
            v.naviElsewhere?.let { StatusLine(stringResource(R.string.live_navi_elsewhere, it), Tone.NEUTRAL) }
            // What the navigation knows about the route it is driving for us: congestion, incidents, toll.
            if (v.naviElsewhere == null) {
                trafficText(naviLive)?.let { StatusLine(it, Tone.CAUTION) }
                tollText(naviLive)?.let { StatusLine(it, Tone.NEUTRAL) }
            }
        }
        rest?.let { r ->
            val (why, what) = restTexts(r)
            StatusLine(why, Tone.CAUTION)
            StatusLine(what, Tone.NEUTRAL)
        }
        here?.socAtDest?.let { soc -> StatusLine(stringResource(if (soc < LOW_SOC) R.string.soc_low else R.string.soc_at_dest, soc), if (soc < LOW_SOC) Tone.CAUTION else Tone.NEUTRAL) }
        val lowSoc = (here?.socAtDest?.let { it < LOW_SOC } == true) || vm.naviLive.collectAsState().value?.lowBattery == true
        arrival?.let { a -> StatusLine(stringResource(if (a.demo) R.string.auto_arrived_demo else R.string.auto_arrived, a.name, clock(a.at)), Tone.OK) }
        val skip = live?.projection?.skip
        val defer = live?.projection?.defer
        // Skip and defer point at the same optional stop; show one line naming it, then offer both choices.
        skip?.let { s -> StatusLine(stringResource(R.string.skip_suggest, TripValidator.placeName(t.view, t.view.visits.first { it.visitId == s.visitId }.placeRef)), Tone.CAUTION) }
        // 충전·주유 권장 (EV fast/slow, ICE refuel) from the car's energy reading; the nav screen shows prices/types.
        val energy = live?.projection?.energy
        energy?.let { e ->
            val pct = e.energyPercent ?: 0
            StatusLine(
                when (e.action) {
                    io.tteonaljido.trip.EnergyAction.FAST_CHARGE -> stringResource(R.string.energy_fast, pct)
                    io.tteonaljido.trip.EnergyAction.SLOW_CHARGE -> stringResource(R.string.energy_slow, pct)
                    io.tteonaljido.trip.EnergyAction.REFUEL -> if (e.reasonCode == "refuel_range") stringResource(R.string.energy_refuel_range) else stringResource(R.string.energy_refuel, pct)
                },
                Tone.CAUTION,
            )
            // The outlook behind the advice (SOC + range + the navigation's estimate), and a drive-mode hint when it applies.
            e.socAtDayEnd?.let { StatusLine(stringResource(R.string.energy_day_end, it), if (it <= io.tteonaljido.trip.EnergyPolicy.EV_LOW_SOC) Tone.CAUTION else Tone.NEUTRAL) }
            if (e.ecoHint) StatusLine(stringResource(R.string.energy_eco_hint), Tone.NEUTRAL)
        }
        val skippedToday = t.view.days[day - 1].visitOrder.filter { it in t.overlay.skipped }
        val deferredToday = t.view.days[day - 1].visitOrder.filter { it in t.overlay.deferred }
        val deferredAway = t.view.days[day - 1].visitOrder.filter { it in t.overlay.deferredTo }
        val nextDay = if (day < t.view.days.size) day + 1 else null
        // Marking an arrival or starting from here only makes sense for the day you are on.
        val isToday = vm.todayIndex(t) == day
        Spacer(Modifier.height(Space.x4))
        PleosButton(stringResource(R.string.guide_next), { vm.guideNext(t.localId, day) }, Modifier.fillMaxWidth(), enabled = step.target != null, tag = "guide")
        // The navigation's part of the plan, as actions only: its fastest order for the day (weighed off the main thread, null while it runs),
        // the car's own order put back, and the timing of legs it has yet to measure. What measuring does is said by the popup that asks first.
        val cover = remember(t) { NaviMeasure.coverage(t.view, t.overlay, vm.todayIndex(t) ?: 1) }
        val advice by produceState<RouteOptimizer.Outcome?>(null, t, day) { value = withContext(Dispatchers.Default) { RouteOptimizer.suggest(t.plan, t.overlay, day) } }
        val carOrder = remember(t, day) { CarOrder.of(t.plan, t.overlay, day) }
        val faster = advice as? RouteOptimizer.Outcome.Faster
        val canOrder = advice.let { it != null && it !is RouteOptimizer.Outcome.NotApplicable }
        val needsHome = t.view.home == null && t.overlay.home == null && (t.view.origin is Endpoint.Home || t.view.finalDestination is Endpoint.Home)
        ActionGrid {
            if (canBundle) add { m -> PleosButton(stringResource(R.string.guide_today), { vm.guideToday(t.localId, day) }, type = ButtonType.BASIC, modifier = m, tag = "guideToday") }
            if (isToday) (step.target as? Target.Stop)?.let { s -> add { m -> PleosButton(stringResource(R.string.mark_arrived), { vm.markVisited(t.localId, s.visitId) }, type = ButtonType.BASIC, modifier = m, tag = "visited") } }
            if (isToday) add { m -> PleosButton(stringResource(R.string.depart_here), { vm.departHere(t.localId, day) }, type = ButtonType.BASIC, modifier = m, tag = "departHere") }
        }
        // What the navigation can settle (a faster order, timing, home): small, and only while it applies. Putting things back is in the header's 더보기.
        ActionGrid {
            if (faster != null) add { m -> PleosButton(stringResource(R.string.order_apply_saves, durationLabel(faster.savedMinutes)), { vm.applyOrder(t.localId, day, faster.order) }, type = ButtonType.WEAK, size = ButtonSize.SMALL, modifier = m, tag = "applyOrder") }
            if (cover.total > 0 && cover.measured < cover.total) add { m -> PleosButton(stringResource(R.string.navi_measure_all), { vm.measureTrip(t.localId) }, type = ButtonType.BASIC, size = ButtonSize.SMALL, modifier = m, tag = "naviMeasure") }
            else if (faster == null && carOrder == null && canOrder) add { m -> PleosButton(stringResource(R.string.navi_optimize_day, day), { vm.measureDay(t.localId, day) }, type = ButtonType.BASIC, size = ButtonSize.SMALL, modifier = m, tag = "naviOptimize") }
            if (needsHome) add { m -> PleosButton(stringResource(R.string.load_navi_home), { vm.loadNaviHome(t.localId) }, type = ButtonType.BASIC, size = ButtonSize.SMALL, modifier = m, tag = "naviHome") }
        }
        // Guidance needs a stop to go to; say so in one quiet line when there is none.
        val why = if (step.target == null) stringResource(R.string.why_no_target) else null
        why?.let { PleosText(it, Pleos.type.bodySmall, secondary, maxLines = 2) }
        if (skip != null || defer != null || energy != null || rest != null || arrival?.visitId != null || skippedToday.isNotEmpty() || deferredToday.isNotEmpty() || deferredAway.isNotEmpty() || lowSoc) {
            ActionGrid {
                skip?.let { s -> add { m -> PleosButton(stringResource(R.string.skip), { vm.skip(t.localId, s.visitId) }, size = ButtonSize.SMALL, modifier = m, tag = "skip") } }
                defer?.let { s -> add { m -> PleosButton(stringResource(R.string.defer_back), { vm.defer(t.localId, s.visitId) }, type = ButtonType.BASIC, size = ButtonSize.SMALL, modifier = m, tag = "defer") } }
                if (defer != null && nextDay != null) add { m -> PleosButton(stringResource(R.string.defer_to_day, nextDay.toString()), { vm.deferToDay(t.localId, defer.visitId, nextDay) }, type = ButtonType.BASIC, size = ButtonSize.SMALL, modifier = m, tag = "deferDay") }
                arrival?.visitId?.let { id -> add { m -> PleosButton(stringResource(R.string.undo_arrival), { vm.undoVisited(t.localId, id) }, type = ButtonType.BASIC, size = ButtonSize.SMALL, modifier = m, tag = "undoArrival") } }
                skippedToday.lastOrNull()?.let { add { m -> PleosButton(stringResource(R.string.unskip_last), { vm.unskip(t.localId, it) }, type = ButtonType.BASIC, size = ButtonSize.SMALL, modifier = m, tag = "unskip") } }
                deferredToday.lastOrNull()?.let { add { m -> PleosButton(stringResource(R.string.undefer_last), { vm.undefer(t.localId, it) }, type = ButtonType.BASIC, size = ButtonSize.SMALL, modifier = m, tag = "undefer") } }
                deferredAway.lastOrNull()?.let { add { m -> PleosButton(stringResource(R.string.undefer_day), { vm.undeferDay(t.localId, it) }, type = ButtonType.BASIC, size = ButtonSize.SMALL, modifier = m, tag = "undeferDay") } }
                energy?.let { e ->
                    val refuel = e.action == io.tteonaljido.trip.EnergyAction.REFUEL
                    add { m -> PleosButton(stringResource(if (refuel) R.string.find_fuel else R.string.nearby_chargers), { if (refuel) vm.openFuelSearch() else vm.openChargers() }, type = ButtonType.BASIC, size = ButtonSize.SMALL, modifier = m, tag = "energy") }
                }
                if (lowSoc && energy == null) add { m -> PleosButton(stringResource(R.string.nearby_chargers), vm::openChargers, type = ButtonType.BASIC, size = ButtonSize.SMALL, modifier = m, tag = "chargers") }
                if (rest != null) add { m -> PleosButton(stringResource(R.string.find_rest_area), vm::openRestAreas, type = ButtonType.BASIC, size = ButtonSize.SMALL, modifier = m, tag = "restArea") }
            }
        }
    }
}

/** Our own threshold for a low battery at the destination (the navigation's estimate), stated as such in the docs. */
private const val LOW_SOC = 20

/** Emulator demo samples for the departure check (M57): one with things to look at, one all clear. */
private val DEMO_VEHICLE = VehicleSnapshot(
    powerLimited = false, washerLow = true, brakeFluid = FluidLevel.OK,
    doorsOpen = 0, trunkOpen = true, chargePortOpen = true, occupants = 3, unbuckled = 1, gearPark = true, driveMode = DriveMode.SPORT,
)
private val DEMO_VEHICLE_OK = VehicleSnapshot(
    powerLimited = false, washerLow = false, brakeFluid = FluidLevel.OK,
    doorsOpen = 0, trunkOpen = false, chargePortOpen = false, occupants = 2, unbuckled = 0, gearPark = true, driveMode = DriveMode.NORMAL,
)

@Composable
private fun GuideDialogs(vm: TripsViewModel, g: Guide) {
    when (g) {
        Guide.Idle -> Unit
        is Guide.Working -> PleosSystemPopup(stringResource(R.string.wait_title), text(g.msg), stringResource(R.string.close), vm::dismissGuide)
        is Guide.MeasureFailed -> PleosSystemPopup(stringResource(R.string.measure_failed_title), text(g.msg), stringResource(R.string.confirm), vm::dismissGuide)
        is Guide.Measuring -> PleosSystemPopup(stringResource(R.string.measure_title), text(g.msg), stringResource(R.string.measure_stop), vm::dismissGuide)
        is Guide.ConfirmMeasure -> PleosSystemPopup(
            stringResource(R.string.measure_confirm_title),
            // Three lines at most: what the navigation does, for how long, and how to come back (the system does not let this app return by itself).
            stringResource(if (g.current != null) R.string.measure_confirm_body_guiding else R.string.measure_confirm_body, g.routes, g.routes * 15),
            stringResource(R.string.measure_confirm_yes), { vm.confirmMeasure() },
            cancel = stringResource(R.string.cancel), onCancel = vm::dismissGuide,
        )
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

/* ---------- settings: grouped rows with switches (phone 설정 tab) ---------- */

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
    var presend by remember { mutableStateOf(false) }
    val secondary = colorResource(R.color.tn_text_secondary)
    val on = stringResource(R.string.state_on)
    val off = stringResource(R.string.state_off)
    val body = Pleos.type.bodyMediumNormal
    Screen(header = { PleosHeader(stringResource(R.string.settings), onBack = onBack) }) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Space.x16)) {
            SectionLabel(stringResource(R.string.settings_guide_title))
            PleosCard(padding = Space.x24, gap = 0.dp) {
                SwitchRow(stringResource(R.string.auto_arrive), stringResource(R.string.settings_auto_arrive_body), autoArrive, { onAutoArrive(!autoArrive) }, "autoArrive", on, off)
            }
            SectionLabel(stringResource(R.string.privacy), Modifier.padding(top = Space.x16))
            PleosCard(gap = Space.x12) {
                PleosText(stringResource(R.string.privacy_body), body, secondary)
                PleosText(stringResource(R.string.privacy_rental), body, secondary)
                PleosButton(stringResource(R.string.delete_all), { confirm = true }, type = ButtonType.BASIC, size = ButtonSize.SMALL, tag = "deleteAll")
            }
            if (isEmulator) {
                SectionLabel(stringResource(R.string.demo_title), Modifier.padding(top = Space.x16))
                PleosCard(padding = Space.x24, gap = 0.dp) {
                    SwitchRow(stringResource(R.string.demo_mode), stringResource(R.string.demo_body), demo, { onDemo(!demo) }, "demo", on, off)
                    // The demo clock and the demo arrival only exist with the demo store, so real trips never get demo timestamps.
                    if (demo) {
                        RowDivider()
                        SwitchRow(stringResource(R.string.demo_driving), null, demoDriving, { onDemoDriving(!demoDriving) }, "demoDriving", on, off)
                        RowDivider()
                        SwitchRow(stringResource(R.string.demo_clock), stringResource(R.string.demo_clock_body), demoClock, { onDemoClock(!demoClock) }, "demoClock", on, off)
                        RowDivider()
                        Column(Modifier.padding(vertical = Space.x20), verticalArrangement = Arrangement.spacedBy(Space.x16)) {
                            PleosText(stringResource(R.string.demo_time_body), Pleos.type.bodySmall, secondary)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.x12), verticalArrangement = Arrangement.spacedBy(Space.x12)) {
                                PleosButton(stringResource(R.string.demo_arrive), onDemoArrive, type = ButtonType.BASIC, size = ButtonSize.SMALL, tag = "demoArrive")
                                PleosButton(stringResource(R.string.presend_demo), { presend = true }, type = ButtonType.BASIC, size = ButtonSize.SMALL, tag = "presend")
                                PleosButton(stringResource(R.string.demo_energy_ev, 18), { vm.seedDemoEnergy(io.tteonaljido.trip.VehicleKind.EV, 18, 250) }, type = ButtonType.BASIC, size = ButtonSize.SMALL, tag = "seedEvEnergy")
                                PleosButton(stringResource(R.string.demo_energy_ice, 25), { vm.seedDemoEnergy(io.tteonaljido.trip.VehicleKind.ICE, 25, null) }, type = ButtonType.BASIC, size = ButtonSize.SMALL, tag = "seedIceEnergy")
                                // M57: the emulator cannot inject vehicle signals, so labelled samples stand in for the departure check and the rest advice.
                                PleosButton(stringResource(R.string.demo_vehicle), { vm.seedDemoVehicle(DEMO_VEHICLE) }, type = ButtonType.BASIC, size = ButtonSize.SMALL, tag = "seedVehicle")
                                PleosButton(stringResource(R.string.demo_vehicle_ok), { vm.seedDemoVehicle(DEMO_VEHICLE_OK) }, type = ButtonType.BASIC, size = ButtonSize.SMALL, tag = "seedVehicleOk")
                                PleosButton(stringResource(R.string.demo_drive), { vm.seedDemoDrive(130) }, type = ButtonType.BASIC, size = ButtonSize.SMALL, tag = "seedDrive")
                            }
                        }
                    }
                }
            }
            SectionLabel(stringResource(R.string.about), Modifier.padding(top = Space.x16))
            PleosCard {
                PleosText(stringResource(R.string.about_body, BuildConfig.VERSION_NAME, server.removePrefix("https://").removePrefix("http://")), body, secondary)
            }
            Spacer(Modifier.height(Space.x32))
        }
    }
    if (confirm) PleosSystemPopup(
        stringResource(R.string.delete_all_title), stringResource(R.string.delete_all_body), stringResource(R.string.delete), { confirm = false; vm.deleteAll() },
        cancel = stringResource(R.string.cancel), onCancel = { confirm = false }, destructive = true,
    )
    if (presend) PleosSystemPopup(
        stringResource(R.string.presend_demo_title), stringResource(R.string.presend_demo_body), stringResource(R.string.confirm), { presend = false },
    )
}
