package io.tteonaljido.car.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
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
import io.tteonaljido.car.R
import io.tteonaljido.car.TripsViewModel
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
import io.tteonaljido.trip.Endpoint
import io.tteonaljido.trip.LocalTrip
import io.tteonaljido.trip.NextDestination
import io.tteonaljido.trip.Severity
import io.tteonaljido.trip.Target
import io.tteonaljido.trip.TripValidator
import java.util.Locale

@Composable
fun TripsScreen(vm: TripsViewModel, drive: DriveState, onImport: () -> Unit, onOpen: (String) -> Unit, onSettings: () -> Unit) {
    val trips by vm.trips.collectAsState()
    val unreadable by vm.unreadable.collectAsState()
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    Screen {
        PleosHeader(stringResource(R.string.app_name), stringResource(R.string.trips_subtitle)) {
            PleosButton(stringResource(if (drive.parked) R.string.import_button else R.string.parked_only), onImport, enabled = drive.parked, tag = "import")
            PleosButton(stringResource(R.string.settings), onSettings, type = ButtonType.SECONDARY, tag = "settings")
        }
        if (unreadable > 0) StatusLine(stringResource(R.string.unreadable_files, unreadable), Tone.WARNING)
        if (trips.isEmpty()) {
            PleosCard {
                PleosText(stringResource(R.string.no_trips_title), Pleos.type.titleMedium)
                PleosText(stringResource(R.string.no_trips_body), Pleos.type.bodyLarge, secondary)
            }
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(24.dp)) {
            items(trips, key = { it.localId }) { t ->
                val report = remember(t) { TripValidator.validate(t.plan, t.overlay) }
                val today = vm.todayIndex(t)
                val period = stringResource(R.string.labeled, periodLabel(t.plan), nightsLabel(t.plan))
                PleosCard(onClick = { onOpen(t.localId) }) {
                    PleosText(t.plan.name, Pleos.type.titleMedium, maxLines = 1)
                    PleosText(if (today != null) stringResource(R.string.trip_card_today, period, today) else period, Pleos.type.bodyLarge, secondary, maxLines = 1)
                    PleosText(stringResource(R.string.trip_card_stats, t.plan.places.size, report.conflicts, report.uncertain, t.meta.revision), Pleos.type.bodySmall, secondary, maxLines = 1)
                }
            }
        }
    }
}

@Composable
fun TripDetailScreen(vm: TripsViewModel, localId: String, drive: DriveState, onBack: () -> Unit) {
    val trips by vm.trips.collectAsState()
    val guide by vm.guide.collectAsState()
    val t = trips.firstOrNull { it.localId == localId } ?: return onBack()
    var day by remember(localId) { mutableIntStateOf(vm.todayIndex(t) ?: 1) }
    var confirmDelete by remember { mutableStateOf(false) }
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    val report = remember(t) { TripValidator.validate(t.plan, t.overlay) }

    Screen {
        PleosHeader(t.plan.name, stringResource(R.string.detail_subtitle, periodLabel(t.plan), nightsLabel(t.plan), t.meta.revision)) {
            PleosButton(stringResource(R.string.list), onBack, type = ButtonType.SECONDARY, size = ButtonSize.SMALL)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            t.plan.days.forEach { d ->
                PleosButton(stringResource(R.string.day_n, d.dayIndex), { day = d.dayIndex }, type = if (d.dayIndex == day) ButtonType.PRIMARY else ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "day${d.dayIndex}")
            }
        }
        BoxWithConstraints(Modifier.fillMaxWidth().weight(1f)) {
            val wide = maxWidth >= 1000.dp
            val plan: @Composable () -> Unit = { DayPlan(t, day) }
            val side: @Composable () -> Unit = {
                Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    NextCard(vm, t, day, drive)
                    PleosCard {
                        PleosText(stringResource(R.string.to_check), Pleos.type.titleSmall)
                        val shown = (report.forDay(day) + report.issues.filter { it.dayIndex == null }).filter { it.severity != Severity.INFO }.take(5)
                        if (shown.isEmpty()) PleosText(stringResource(R.string.nothing_to_check), Pleos.type.bodyMedium, secondary)
                        shown.forEach { SeverityLine(it.severity, issueText(it)) }
                        if (t.plan.home == null && t.overlay.home == null && (t.plan.origin is Endpoint.Home || t.plan.finalDestination is Endpoint.Home)) {
                            PleosButton(stringResource(R.string.load_navi_home), { vm.loadNaviHome(localId) }, type = ButtonType.SECONDARY, enabled = drive.parked, tag = "naviHome")
                        }
                    }
                    PleosButton(stringResource(R.string.delete_trip), { confirmDelete = true }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, enabled = drive.parked)
                }
            }
            if (wide) Row(horizontalArrangement = Arrangement.spacedBy(32.dp)) {
                Column(Modifier.weight(0.55f).verticalScroll(rememberScrollState())) { plan() }
                Column(Modifier.weight(0.45f).verticalScroll(rememberScrollState())) { side() }
            } else Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(24.dp)) { side(); plan() }
        }
    }

    GuideDialogs(vm, guide)
    if (confirmDelete) {
        PleosSystemPopup(
            stringResource(R.string.delete_trip_title), stringResource(R.string.delete_trip_body), stringResource(R.string.delete), { confirmDelete = false; vm.delete(localId); onBack() },
            cancel = stringResource(R.string.cancel), onCancel = { confirmDelete = false },
        )
    }
}

@Composable
private fun DayPlan(t: LocalTrip, day: Int) {
    val d = t.plan.days[day - 1]
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    val times = remember(t, day) { TripValidator.timeline(t.plan, day).associateBy { it.visitId } }
    val home = stringResource(R.string.home)
    val start = if (day == 1) (if (t.plan.origin is Endpoint.Home) home else stringResource(R.string.origin_place))
    else t.plan.days[day - 2].lodgingPlaceRef?.let { TripValidator.placeName(t.plan, it) } ?: stringResource(R.string.lodging_undecided)
    PleosCard {
        PleosText(stringResource(R.string.day_header, day, dateLabel(d.date)), Pleos.type.titleSmall)
        PleosText(stringResource(R.string.depart_from, start, TripValidator.departure(t.plan, day)?.let(TripValidator::hhmm) ?: stringResource(R.string.time_unknown)), Pleos.type.bodyMedium, secondary)
        d.visitOrder.forEachIndexed { k, id ->
            val v = t.plan.visits.first { it.visitId == id }
            val time = times[id]?.start?.let(TripValidator::hhmm) ?: stringResource(R.string.time_check)
            val marks = (if (v.fixed != null) stringResource(R.string.stop_fixed) else "") + (if (id in t.overlay.visited) stringResource(R.string.stop_visited) else "")
            PleosText(stringResource(R.string.stop_line, k + 1, time, TripValidator.placeName(t.plan, v.placeRef)) + marks, Pleos.type.bodyLarge, maxLines = 1)
            val leg = d.legs.getOrNull(k + 1)
            PleosText(if (leg != null) stringResource(R.string.leg_minutes, leg.minutes) else stringResource(R.string.leg_unknown), Pleos.type.bodySmall, secondary, maxLines = 1)
        }
        val last = day == t.plan.days.size
        val end = if (last) (t.plan.finalDestination as? Endpoint.AtPlace)?.let { TripValidator.placeName(t.plan, it.placeRef) } ?: home
        else d.lodgingPlaceRef?.let { TripValidator.placeName(t.plan, it) } ?: stringResource(R.string.lodging_undecided)
        PleosText(stringResource(if (last) R.string.return_to else R.string.stay_at, end), Pleos.type.bodyLargeStrong, maxLines = 1)
    }
}

@Composable
private fun NextCard(vm: TripsViewModel, t: LocalTrip, day: Int, drive: DriveState) {
    val step = remember(t, day) { NextDestination.of(t.plan, t.overlay, day) }
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    val home = stringResource(R.string.home)
    val label = when (val tg = step.target) {
        null -> stringResource(R.string.none)
        is Target.Final -> tg.place?.name ?: home
        else -> tg.label
    }
    PleosCard {
        PleosText(stringResource(R.string.next_destination_day, day), Pleos.type.label, secondary)
        PleosText(label, Pleos.type.titleMedium, maxLines = 1)
        val note = noteText(step)
        if (note.isNotBlank()) PleosText(note, Pleos.type.bodyMedium, secondary, maxLines = 1)
        if (drive.parked) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                PleosButton(stringResource(R.string.guide_next), { vm.guideNext(t.localId, day) }, enabled = step.target != null, tag = "guide")
                (step.target as? Target.Stop)?.let { s -> PleosButton(stringResource(R.string.mark_arrived), { vm.markVisited(t.localId, s.visitId) }, type = ButtonType.SECONDARY, tag = "visited") }
            }
        } else {
            PleosText(stringResource(R.string.guide_when_parked), Pleos.type.bodyMedium, secondary)
        }
    }
}

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
    server: String,
    onDemo: (Boolean) -> Unit,
    onDemoDriving: (Boolean) -> Unit,
    onBack: () -> Unit,
) {
    var confirm by remember { mutableStateOf(false) }
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    Screen {
        PleosHeader(stringResource(R.string.settings)) { PleosButton(stringResource(R.string.list), onBack, type = ButtonType.SECONDARY, size = ButtonSize.SMALL) }
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(24.dp)) {
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
