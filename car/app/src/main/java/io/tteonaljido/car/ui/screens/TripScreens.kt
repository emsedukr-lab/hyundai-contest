package io.tteonaljido.car.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.colorResource
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
import io.tteonaljido.car.ui.components.ButtonSize
import io.tteonaljido.car.ui.components.ButtonType
import io.tteonaljido.car.ui.components.Dot
import io.tteonaljido.car.ui.components.Icon
import io.tteonaljido.car.ui.components.ListRow
import io.tteonaljido.car.ui.components.PleosButton
import io.tteonaljido.car.ui.components.PleosCard
import io.tteonaljido.car.ui.components.PleosSystemPopup
import io.tteonaljido.car.ui.components.PleosText
import io.tteonaljido.car.ui.components.RowDivider
import io.tteonaljido.car.ui.components.Screen
import io.tteonaljido.car.ui.components.SectionLabel
import io.tteonaljido.car.ui.components.StatusLine
import io.tteonaljido.car.ui.components.SwitchRow
import io.tteonaljido.car.ui.components.Tag
import io.tteonaljido.car.ui.components.TagTone
import io.tteonaljido.car.ui.components.TextAction
import io.tteonaljido.car.ui.components.Tone
import io.tteonaljido.car.ui.components.TopBar
import io.tteonaljido.car.ui.components.DayChips
import io.tteonaljido.car.ui.components.tag
import io.tteonaljido.car.ui.components.tagFg
import io.tteonaljido.car.ui.issueText
import io.tteonaljido.car.ui.noteText
import io.tteonaljido.car.ui.text
import io.tteonaljido.car.ui.theme.Pleos
import io.tteonaljido.trip.Basis
import io.tteonaljido.trip.DeadlineKind
import io.tteonaljido.trip.Endpoint
import io.tteonaljido.trip.LocalTrip
import io.tteonaljido.trip.NextDestination
import io.tteonaljido.trip.Punctuality
import io.tteonaljido.trip.Severity
import io.tteonaljido.trip.Target
import io.tteonaljido.trip.TripOverview
import io.tteonaljido.trip.TripValidator
import io.tteonaljido.trip.TripWhen
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
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    Screen {
        TopBar(stringResource(R.string.app_name), stringResource(R.string.trips_subtitle)) {
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
            return@Screen
        }
        val today = { t: LocalTrip -> vm.today(t, now) }
        val next = remember(trips, now) { TripOverview.pickNext(trips, { it.plan }, today) }
        val others = remember(trips, now, next) { TripOverview.sortOthers(trips.filter { it !== next }, { it.plan }, today) }
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            next?.let { t ->
                SectionLabel(stringResource(R.string.next_trip))
                NextTripCard(t, today(t)) { onOpen(t.localId) }
            }
            if (others.isNotEmpty()) {
                SectionLabel(stringResource(R.string.other_trips), Modifier.padding(top = 16.dp))
                PleosCard(padding = 24.dp, gap = 0.dp) {
                    others.forEachIndexed { i, t ->
                        if (i > 0) RowDivider()
                        ListRow(tripTitle(t), stringResource(R.string.labeled, periodLabel(t.plan), nightsLabel(t.plan)), onClick = { onOpen(t.localId) }) {
                            val w = TripOverview.tripWhen(t.plan.startDate, t.plan.endDate, today(t))
                            Tag(whenLabel(w), if (w is TripWhen.Past) TagTone.NEUTRAL else TagTone.ACCENT)
                        }
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
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

/** 다음 여행: when it leaves, the name, the period, the whole route (the screen's one bright element), what to check. */
@Composable
private fun NextTripCard(t: LocalTrip, today: java.time.LocalDate, onClick: () -> Unit) {
    val w = remember(t, today) { TripOverview.tripWhen(t.plan.startDate, t.plan.endDate, today) }
    val report = remember(t, today) { TripValidator.validate(t.plan, t.overlay, today) }
    val sketch = remember(t) { TripOverview.sketch(t.plan, 300.0, 240.0, 18.0) }
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    PleosCard(onClick = onClick, padding = 32.dp, gap = 24.dp) {
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val wide = maxWidth >= 1100.dp
            val head: @Composable () -> Unit = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    PleosText(whenLabel(w), Pleos.type.bodyMedium, if (w is TripWhen.Past) secondary else tagFg(TagTone.ACCENT), maxLines = 1)
                    PleosText(tripTitle(t), Pleos.type.titleLarge, maxLines = 2)
                    PleosText(stringResource(R.string.trip_summary, periodLabel(t.plan), nightsLabel(t.plan), t.plan.places.size), Pleos.type.bodyMedium.copy(fontWeight = FontWeight.Normal), secondary, maxLines = 2)
                }
            }
            val foot: @Composable () -> Unit = {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    val past = report.issues.firstOrNull { it.code == "PAST_TRIP" }
                    when {
                        past != null -> Tag(issueText(past), TagTone.WARN, Modifier.weight(1f, fill = false))
                        report.conflicts == 0 && report.uncertain == 0 -> PleosText(stringResource(R.string.all_clear), Pleos.type.bodyMedium.copy(fontWeight = FontWeight.Normal), secondary, maxLines = 1)
                        else -> {
                            if (report.conflicts > 0) Tag(stringResource(R.string.count_conflicts, report.conflicts), TagTone.ERROR)
                            if (report.uncertain > 0) Tag(stringResource(R.string.count_uncertain, report.uncertain), TagTone.WARN)
                        }
                    }
                    Spacer(Modifier.weight(1f))
                    PleosText(stringResource(R.string.rev, t.meta.revision), Pleos.type.bodySmall, secondary, maxLines = 1)
                    Icon(R.drawable.ic_chevron, 36.dp, colorResource(R.color.pleos_text_dark_tertiary))
                }
            }
            val drawing: @Composable (Modifier) -> Unit = { m ->
                if (sketch.plotted >= 2) RouteSketch(sketch, w.focusDay, stringResource(R.string.sketch_desc, t.plan.name), m)
                else Box(m.padding(vertical = 24.dp)) { PleosText(stringResource(R.string.no_route), Pleos.type.bodySmall, secondary, maxLines = 2) }
            }
            if (wide) Row(horizontalArrangement = Arrangement.spacedBy(48.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(0.45f), verticalArrangement = Arrangement.spacedBy(32.dp)) { head(); foot() }
                drawing(Modifier.weight(0.55f))
            } else Column(verticalArrangement = Arrangement.spacedBy(24.dp)) { head(); drawing(Modifier.fillMaxWidth()); foot() }
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
    Tag(stringResource(R.string.demo_clock_banner, label), TagTone.NEUTRAL)
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
    val t = trips.firstOrNull { it.localId == localId } ?: return onBack()
    var day by remember(localId) { mutableIntStateOf(vm.todayIndex(t) ?: 1) }
    var confirmDelete by remember { mutableStateOf(false) }
    val todayDate = vm.today(t, now)
    val report = remember(t, todayDate) { TripValidator.validate(t.plan, t.overlay, todayDate) }
    val live = remember(t, day, now, naviLive, here, energy) { vm.live(t, day, now, naviLive, here) }

    Screen {
        // While driving the card below is the whole screen; Back still works, there is nothing to tap.
        TopBar(
            tripTitle(t),
            stringResource(R.string.detail_subtitle, periodLabel(t.plan), nightsLabel(t.plan), t.meta.revision),
            onBack = if (drive.parked) onBack else null,
        )
        if (demoClock) DemoClockLine(now)
        if (!drive.parked) {
            // Driving: one glanceable card, no scrolling, no buttons; it changes only as text.
            DrivingTripView(t, vm.todayIndex(t, now) ?: day, live, naviLive)
            return@Screen
        }
        report.issues.firstOrNull { it.code == "PAST_TRIP" }?.let { past ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Tag(issueText(past), TagTone.WARN, large = true)
                TextAction(stringResource(R.string.delete_trip), { confirmDelete = true }, tone = TagTone.ERROR, tag = "pastDelete")
            }
        }
        val chipLabels = t.plan.days.associate { it.dayIndex to stringResource(R.string.day_n, it.dayIndex) }
        DayChips(t.plan.days.map { it.dayIndex }, day, { chipLabels.getValue(it) }) { day = it }
        BoxWithConstraints(Modifier.fillMaxWidth().weight(1f)) {
            val wide = maxWidth >= 1000.dp
            val route: @Composable () -> Unit = {
                Column(Modifier.fillMaxWidth()) {
                    DayHeading(t, day)
                    DayTimeline(t, day, live)
                }
            }
            val side: @Composable () -> Unit = {
                Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    NextPanel(vm, t, day, live, vm.hereFor(t, day, now, here), arrival?.takeIf { it.localId == t.localId })
                    ToCheck(vm, t, day, report)
                    TextAction(stringResource(R.string.delete_trip), { confirmDelete = true }, tone = TagTone.ERROR)
                }
            }
            if (wide) Row(horizontalArrangement = Arrangement.spacedBy(40.dp)) {
                Column(Modifier.weight(0.55f).verticalScroll(rememberScrollState())) { route(); Spacer(Modifier.height(32.dp)) }
                Column(Modifier.weight(0.45f).verticalScroll(rememberScrollState())) { side(); Spacer(Modifier.height(32.dp)) }
            } else Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(32.dp)) {
                // Half screen (840dp): what to do next first, then the day.
                NextPanel(vm, t, day, live, vm.hereFor(t, day, now, here), arrival?.takeIf { it.localId == t.localId })
                route()
                ToCheck(vm, t, day, report)
                TextAction(stringResource(R.string.delete_trip), { confirmDelete = true }, tone = TagTone.ERROR)
                Spacer(Modifier.height(32.dp))
            }
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

/** 확인할 점: the day's conflicts and open questions, each with its severity in words and a colored dot. */
@Composable
private fun ToCheck(vm: TripsViewModel, t: LocalTrip, day: Int, report: io.tteonaljido.trip.ValidationReport) {
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    PleosCard(gap = 16.dp) {
        PleosText(stringResource(R.string.to_check), Pleos.type.titleSmall)
        val shown = (report.forDay(day) + report.issues.filter { it.dayIndex == null && it.code != "PAST_TRIP" }).filter { it.severity != Severity.INFO }.take(5)
        if (shown.isEmpty()) PleosText(stringResource(R.string.nothing_to_check), Pleos.type.bodyMedium.copy(fontWeight = FontWeight.Normal), secondary)
        shown.forEach { SeverityLine(it.severity, issueText(it)) }
        if (t.plan.home == null && t.overlay.home == null && (t.plan.origin is Endpoint.Home || t.plan.finalDestination is Endpoint.Home)) {
            PleosButton(stringResource(R.string.load_navi_home), { vm.loadNaviHome(t.localId) }, type = ButtonType.SECONDARY, tag = "naviHome")
        }
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
    if (head == null && tail == null) return null
    val tone = when (p.status) {
        Punctuality.ON_TIME -> Tone.POSITIVE
        Punctuality.TIGHT, Punctuality.UNKNOWN -> Tone.WARNING
        Punctuality.LATE -> Tone.NEGATIVE
        Punctuality.NO_DEADLINE -> Tone.INFO
    }
    return if (head != null) LiveLine(head + approx, tail, tone) else LiveLine(null, tail + approx, tone)
}

@Composable
private fun LiveLines(l: LiveLine, large: Boolean) {
    l.head?.let { PleosText(it, if (large) Pleos.type.titleSmall else Pleos.type.bodyLarge, maxLines = 2) }
    l.tail?.let { Tag(it, l.tone.tag(), large = true, maxLines = 2) }
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
    PleosCard(padding = 48.dp, gap = 20.dp) {
        PleosText(stringResource(R.string.next_destination_day, day), Pleos.type.bodyMedium, secondary, maxLines = 1)
        PleosText(label, Pleos.type.headline, maxLines = 1)
        if (mustKeep) Tag(stringResource(R.string.drive_must), TagTone.INK, large = true)
        remainMetres?.let { PleosText(stringResource(R.string.drive_remain, String.format(Locale.ROOT, "%.1f", it / 1000.0)), Pleos.type.titleMedium) }
        live?.let { v -> liveStatus(t, v)?.let { LiveLines(it, large = true) } }
        PleosText(stringResource(R.string.guide_when_parked), Pleos.type.bodyMedium.copy(fontWeight = FontWeight.Normal), secondary, maxLines = 1)
    }
}

/** 다음 목적지: the name, how it goes against the next fixed time, and what can be done about it here. */
@Composable
private fun NextPanel(vm: TripsViewModel, t: LocalTrip, day: Int, live: LiveView?, here: HereEstimate?, arrival: ArrivalNote?) {
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
    PleosCard(gap = 16.dp) {
        PleosText(stringResource(R.string.next_destination_day, day), Pleos.type.bodyMedium, secondary, maxLines = 1)
        PleosText(label, Pleos.type.titleLarge, maxLines = 2)
        val note = noteText(step)
        if (note.isNotBlank()) PleosText(note, Pleos.type.bodyMedium.copy(fontWeight = FontWeight.Normal), secondary, maxLines = 1)
        live?.let { v ->
            liveStatus(t, v)?.let { LiveLines(it, large = false) }
            v.naviElsewhere?.let { StatusLine(stringResource(R.string.live_navi_elsewhere, it), Tone.INFO) }
        }
        here?.socAtDest?.let { soc -> StatusLine(stringResource(if (soc < LOW_SOC) R.string.soc_low else R.string.soc_at_dest, soc), if (soc < LOW_SOC) Tone.WARNING else Tone.INFO) }
        val lowSoc = (here?.socAtDest?.let { it < LOW_SOC } == true) || vm.naviLive.collectAsState().value?.lowBattery == true
        arrival?.let { a -> StatusLine(stringResource(if (a.demo) R.string.auto_arrived_demo else R.string.auto_arrived, a.name, clock(a.at)), Tone.POSITIVE) }
        val skip = live?.projection?.skip
        val defer = live?.projection?.defer
        // Skip and defer point at the same optional stop; show one line naming it, then offer both choices.
        skip?.let { s -> StatusLine(stringResource(R.string.skip_suggest, TripValidator.placeName(t.plan, t.plan.visits.first { it.visitId == s.visitId }.placeRef)), Tone.WARNING) }
        // 충전·주유 권장 (EV fast/slow, ICE refuel) from the car's energy reading; the nav screen shows prices/types.
        val energy = live?.projection?.energy
        energy?.let { e ->
            val pct = e.energyPercent ?: 0
            StatusLine(
                when (e.action) {
                    io.tteonaljido.trip.EnergyAction.FAST_CHARGE -> stringResource(R.string.energy_fast, pct)
                    io.tteonaljido.trip.EnergyAction.SLOW_CHARGE -> stringResource(R.string.energy_slow, pct)
                    io.tteonaljido.trip.EnergyAction.REFUEL -> stringResource(R.string.energy_refuel, pct)
                },
                Tone.WARNING,
            )
        }
        val skippedToday = t.plan.days[day - 1].visitOrder.filter { it in t.overlay.skipped }
        val deferredToday = t.plan.days[day - 1].visitOrder.filter { it in t.overlay.deferred }
        val deferredAway = t.plan.days[day - 1].visitOrder.filter { it in t.overlay.deferredTo }
        val nextDay = if (day < t.plan.days.size) day + 1 else null
        // Marking an arrival or starting from here only makes sense for the day you are on.
        val isToday = vm.todayIndex(t) == day
        Spacer(Modifier.height(4.dp))
        PleosButton(stringResource(R.string.guide_next), { vm.guideNext(t.localId, day) }, Modifier.fillMaxWidth(), enabled = step.target != null, tag = "guide")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (canBundle) PleosButton(stringResource(R.string.guide_today), { vm.guideToday(t.localId, day) }, type = ButtonType.SECONDARY, tag = "guideToday")
            (step.target as? Target.Stop)?.let { s -> PleosButton(stringResource(R.string.mark_arrived), { vm.markVisited(t.localId, s.visitId) }, type = ButtonType.SECONDARY, enabled = isToday, tag = "visited") }
            PleosButton(stringResource(R.string.depart_here), { vm.departHere(t.localId, day) }, type = ButtonType.SECONDARY, enabled = isToday, tag = "departHere")
            if (t.overlay.originFor(day) != null) PleosButton(stringResource(R.string.undo_depart), { vm.undoDepartHere(t.localId, day) }, type = ButtonType.SECONDARY, tag = "undoDepart")
        }
        if (skip != null || defer != null || energy != null || arrival?.visitId != null || skippedToday.isNotEmpty() || deferredToday.isNotEmpty() || deferredAway.isNotEmpty() || lowSoc) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                skip?.let { s -> PleosButton(stringResource(R.string.skip), { vm.skip(t.localId, s.visitId) }, size = ButtonSize.SMALL, tag = "skip") }
                defer?.let { s -> PleosButton(stringResource(R.string.defer_back), { vm.defer(t.localId, s.visitId) }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "defer") }
                if (defer != null && nextDay != null) PleosButton(stringResource(R.string.defer_to_day, nextDay.toString()), { vm.deferToDay(t.localId, defer.visitId, nextDay) }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "deferDay")
                arrival?.visitId?.let { id -> PleosButton(stringResource(R.string.undo_arrival), { vm.undoVisited(t.localId, id) }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "undoArrival") }
                skippedToday.lastOrNull()?.let { PleosButton(stringResource(R.string.unskip_last), { vm.unskip(t.localId, it) }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "unskip") }
                deferredToday.lastOrNull()?.let { PleosButton(stringResource(R.string.undefer_last), { vm.undefer(t.localId, it) }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "undefer") }
                deferredAway.lastOrNull()?.let { PleosButton(stringResource(R.string.undefer_day), { vm.undeferDay(t.localId, it) }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "undeferDay") }
                energy?.let { e ->
                    val refuel = e.action == io.tteonaljido.trip.EnergyAction.REFUEL
                    PleosButton(stringResource(if (refuel) R.string.find_fuel else R.string.nearby_chargers), { if (refuel) vm.openFuelSearch() else vm.openChargers() }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "energy")
                }
                if (lowSoc && energy == null) PleosButton(stringResource(R.string.nearby_chargers), vm::openChargers, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "chargers")
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
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    val on = stringResource(R.string.state_on)
    val off = stringResource(R.string.state_off)
    val body = Pleos.type.bodyMedium.copy(fontWeight = FontWeight.Normal)
    Screen {
        TopBar(stringResource(R.string.settings), onBack = onBack)
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            SectionLabel(stringResource(R.string.settings_guide_title))
            PleosCard(padding = 24.dp, gap = 0.dp) {
                SwitchRow(stringResource(R.string.auto_arrive), stringResource(R.string.settings_auto_arrive_body), autoArrive, { onAutoArrive(!autoArrive) }, "autoArrive", on, off)
            }
            SectionLabel(stringResource(R.string.privacy), Modifier.padding(top = 16.dp))
            PleosCard(gap = 12.dp) {
                PleosText(stringResource(R.string.privacy_body), body, secondary)
                PleosText(stringResource(R.string.privacy_rental), body, secondary)
                TextAction(stringResource(R.string.delete_all), { confirm = true }, tone = TagTone.ERROR, tag = "deleteAll")
            }
            if (isEmulator) {
                SectionLabel(stringResource(R.string.demo_title), Modifier.padding(top = 16.dp))
                PleosCard(padding = 24.dp, gap = 0.dp) {
                    SwitchRow(stringResource(R.string.demo_mode), stringResource(R.string.demo_body), demo, { onDemo(!demo) }, "demo", on, off)
                    // The demo clock and the demo arrival only exist with the demo store, so real trips never get demo timestamps.
                    if (demo) {
                        RowDivider()
                        SwitchRow(stringResource(R.string.demo_driving), null, demoDriving, { onDemoDriving(!demoDriving) }, "demoDriving", on, off)
                        RowDivider()
                        SwitchRow(stringResource(R.string.demo_clock), stringResource(R.string.demo_clock_body), demoClock, { onDemoClock(!demoClock) }, "demoClock", on, off)
                        RowDivider()
                        Column(Modifier.padding(vertical = 20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            PleosText(stringResource(R.string.demo_time_body), Pleos.type.bodySmall, secondary)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                PleosButton(stringResource(R.string.demo_arrive), onDemoArrive, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "demoArrive")
                                PleosButton(stringResource(R.string.presend_demo), { presend = true }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "presend")
                                PleosButton(stringResource(R.string.demo_energy_ev, 18), { vm.seedDemoEnergy(io.tteonaljido.trip.VehicleKind.EV, 18, 250) }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "seedEvEnergy")
                                PleosButton(stringResource(R.string.demo_energy_ice, 25), { vm.seedDemoEnergy(io.tteonaljido.trip.VehicleKind.ICE, 25, null) }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "seedIceEnergy")
                            }
                        }
                    }
                }
            }
            SectionLabel(stringResource(R.string.about), Modifier.padding(top = 16.dp))
            PleosCard {
                PleosText(stringResource(R.string.about_body, BuildConfig.VERSION_NAME, server.removePrefix("https://").removePrefix("http://")), body, secondary)
            }
            Spacer(Modifier.height(32.dp))
        }
    }
    if (confirm) PleosSystemPopup(
        stringResource(R.string.delete_all_title), stringResource(R.string.delete_all_body), stringResource(R.string.delete), { confirm = false; vm.deleteAll() },
        cancel = stringResource(R.string.cancel), onCancel = { confirm = false },
    )
    if (presend) PleosSystemPopup(
        stringResource(R.string.presend_demo_title), stringResource(R.string.presend_demo_body), stringResource(R.string.confirm), { presend = false },
    )
}
