package io.tteonaljido.car.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import io.tteonaljido.car.R
import io.tteonaljido.car.handoff.ImportViewModel
import io.tteonaljido.car.handoff.QrImage
import io.tteonaljido.car.handoff.ReviewData
import io.tteonaljido.car.safety.DriveState
import io.tteonaljido.car.safety.parked
import io.tteonaljido.car.ui.changeText
import io.tteonaljido.car.ui.components.ButtonType
import io.tteonaljido.car.ui.components.Dot
import io.tteonaljido.car.ui.components.NumberedStep
import io.tteonaljido.car.ui.components.PleosButton
import io.tteonaljido.car.ui.components.PleosCard
import io.tteonaljido.car.ui.components.PleosText
import io.tteonaljido.car.ui.components.Radius
import io.tteonaljido.car.ui.components.Space
import io.tteonaljido.car.ui.components.Screen
import io.tteonaljido.car.ui.components.StatusLine
import io.tteonaljido.car.ui.components.StepHeader
import io.tteonaljido.car.ui.components.Tag
import io.tteonaljido.car.ui.components.Tone
import io.tteonaljido.car.ui.components.PleosHeader
import io.tteonaljido.car.ui.components.weakFace
import io.tteonaljido.car.ui.issueText
import io.tteonaljido.car.ui.theme.Pleos
import io.tteonaljido.pairing.CarHandoffMachine
import io.tteonaljido.pairing.FailKind
import io.tteonaljido.pairing.HandoffState
import io.tteonaljido.trip.Endpoint
import io.tteonaljido.trip.FirstDay
import io.tteonaljido.trip.ImportCase
import io.tteonaljido.trip.ImportChoice
import io.tteonaljido.trip.Severity

private val CHOICE_LABEL = mapOf(
    ImportChoice.IMPORT_NEW to R.string.choice_import,
    ImportChoice.UPDATE to R.string.choice_update,
    ImportChoice.SAVE_COPY to R.string.choice_copy,
    ImportChoice.ADD_HOME to R.string.choice_add_home,
    ImportChoice.ACKNOWLEDGE_SAME to R.string.choice_ack,
    ImportChoice.CANCEL to R.string.choice_cancel,
)

private val RESULT_TEXT = mapOf(
    "IMPORTED_NEW" to R.string.result_imported_new,
    "UPDATED" to R.string.result_updated,
    "SAVED_AS_COPY" to R.string.result_saved_as_copy,
    "HOME_ADDED" to R.string.result_home_added,
    "ALREADY_IMPORTED" to R.string.result_already_imported,
    "USER_DECLINED" to R.string.result_user_declined,
)

private val EXPIRE_TEXT = mapOf(
    "QR" to R.string.expired_qr,
    "UPLOAD" to R.string.expired_upload,
    "RESULT" to R.string.expired_result,
    "UNCONFIRMED" to R.string.expired_unconfirmed,
)

private val CANCEL_TEXT = mapOf(
    "CAR" to R.string.cancelled_car,
    "MOBILE" to R.string.cancelled_mobile,
    "SECURITY" to R.string.cancelled_security,
    "REISSUED" to R.string.cancelled_reissued,
)

private val FAIL_TEXT = mapOf(
    FailKind.NETWORK to R.string.fail_network,
    FailKind.SERVER to R.string.fail_server,
    FailKind.DECRYPT to R.string.fail_decrypt,
    FailKind.INVALID to R.string.fail_invalid,
    FailKind.UNSUPPORTED to R.string.fail_unsupported,
    FailKind.STORAGE to R.string.fail_storage,
    FailKind.SECURITY to R.string.fail_security,
)

/** Car screens of spec 24-6. The QR and the review exist only while parked; the session keeps running when hidden. */
@Composable
fun ImportScreen(vm: ImportViewModel, drive: DriveState, onClose: () -> Unit, onOpenTrip: (String) -> Unit) {
    val state by vm.state.collectAsState()
    val review by vm.review.collectAsState()
    val now by vm.now.collectAsState()
    val offline by vm.offline.collectAsState()
    val secondary = colorResource(R.color.tn_text_secondary)
    val hideable = state is HandoffState.ShowingQr || state is HandoffState.Claimed || state is HandoffState.Review
    // The phone's connect steps (QR → code → approve → done). An ended session keeps the step it stopped at.
    var lastStep by remember { mutableIntStateOf(1) }
    val step = when (state) {
        HandoffState.Idle, HandoffState.Creating, is HandoffState.ShowingQr -> 1
        is HandoffState.Claimed -> 2
        is HandoffState.Receiving, is HandoffState.Review, HandoffState.Applying -> 3
        is HandoffState.Done -> 4
        else -> lastStep
    }
    SideEffect { lastStep = step }

    Screen(header = {
        PleosHeader(stringResource(R.string.import_title), stringResource(R.string.import_subtitle)) {
            PleosButton(stringResource(R.string.close), { vm.dismissIfFinished(); onClose() }, type = ButtonType.BASIC)
        }
    }) {
        if (offline && !CarHandoffMachine.isTerminal(state)) StatusLine(stringResource(R.string.reconnecting), Tone.CAUTION)

        if (!drive.parked && hideable) {
            // QR display and import approval are parked-only (Pleos: "QR 로그인" is restricted while driving).
            PleosCard {
                PleosText(stringResource(R.string.driving_title), Pleos.type.titleMedium)
                PleosText(stringResource(R.string.driving_body), Pleos.type.bodyLarge, secondary)
            }
            return@Screen
        }
        StepHeader(stringResource(listOf(R.string.step_qr, R.string.step_code, R.string.step_review, R.string.step_done)[step - 1]), step, 4)

        when (val s = state) {
            HandoffState.Idle, HandoffState.Creating -> StatusLine(stringResource(R.string.creating_qr))
            is HandoffState.ShowingQr -> BoxWithConstraints(Modifier.fillMaxWidth().weight(1f)) {
                val wide = maxWidth > dimensionResource(R.dimen.pleos_window_apps_portrait_width)
                // QR size is the handoff spec's (24-7), not a design-system dimension: as large as the window allows, capped.
                val side = if (wide) minOf(maxHeight * 0.85f, 600.dp) else minOf(maxWidth * 0.7f, 520.dp)
                val qr: @Composable () -> Unit = {
                    // QR on a white container like the phone's connect screen (no intrinsic sizing: QrImage subcomposes).
                    Box(Modifier.clip(RoundedCornerShape(Radius.r24)).background(colorResource(R.color.tn_qr_background)).padding(Space.x24)) {
                        QrImage(s.qrUrl, side, Modifier.size(side))
                    }
                }
                val info: @Composable () -> Unit = {
                    Column(verticalArrangement = Arrangement.spacedBy(Space.x24)) {
                        NumberedStep(1, stringResource(R.string.qr_scan))
                        NumberedStep(2, stringResource(R.string.qr_compare))
                        NumberedStep(3, stringResource(R.string.qr_approve))
                        Column(verticalArrangement = Arrangement.spacedBy(Space.x8)) {
                            PleosText(stringResource(R.string.time_left, countdown(s.deadline - now)), Pleos.type.titleMedium, maxLines = 1)
                            PleosText(stringResource(R.string.qr_note), Pleos.type.bodySmall, secondary)
                        }
                        PleosButton(stringResource(R.string.cancel), vm::cancel, type = ButtonType.BASIC)
                    }
                }
                if (wide) Row(horizontalArrangement = Arrangement.spacedBy(Space.x48), verticalAlignment = Alignment.CenterVertically) { qr(); info() }
                else Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Space.x32), horizontalAlignment = Alignment.CenterHorizontally) { qr(); info() }
            }
            is HandoffState.Claimed -> PleosCard(Modifier.widthIn(max = dimensionResource(R.dimen.pleos_popup_system_large_width)), padding = Space.x40, gap = Space.x24) {
                Tag(stringResource(R.string.phone_connected), Tone.OK, large = true)
                // The phone's grey code box: label over the big code.
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.r24)).background(weakFace()).padding(horizontal = Space.x40, vertical = Space.x32),
                    verticalArrangement = Arrangement.spacedBy(Space.x8),
                ) {
                    PleosText(stringResource(R.string.confirm_code), Pleos.type.bodyMedium, secondary, maxLines = 1)
                    PleosText(codeLabel(s.code), Pleos.type.code, maxLines = 1)
                }
                PleosText(stringResource(R.string.claimed_body), Pleos.type.bodyLarge)
                PleosText(stringResource(R.string.time_left, countdown(s.deadline - now)), Pleos.type.bodyMedium, secondary)
                PleosButton(stringResource(R.string.not_my_phone), vm::cancel, type = ButtonType.BASIC)
            }
            is HandoffState.Receiving -> StatusLine(stringResource(R.string.receiving))
            is HandoffState.Review -> review?.let { ReviewCard(it, s.code, vm) } ?: StatusLine(stringResource(R.string.checking))
            HandoffState.Applying -> StatusLine(stringResource(R.string.applying))
            is HandoffState.Done -> PleosCard(Modifier.widthIn(max = dimensionResource(R.dimen.pleos_popup_system_large_width)), padding = Space.x40, gap = Space.x24) {
                val declined = s.resultCode == "USER_DECLINED"
                Tag(stringResource(RESULT_TEXT[s.resultCode] ?: R.string.result_done), if (declined) Tone.NEUTRAL else Tone.OK, large = true)
                if (drive.parked) Row(horizontalArrangement = Arrangement.spacedBy(Space.x16)) {
                    val id = s.localId
                    if (id != null && !declined) PleosButton(stringResource(R.string.open_trip), { vm.dismissIfFinished(); onOpenTrip(id) })
                    PleosButton(stringResource(R.string.close), { vm.dismissIfFinished(); onClose() }, type = ButtonType.BASIC)
                }
            }
            is HandoffState.Expired -> Ended(stringResource(EXPIRE_TEXT[s.reason] ?: R.string.expired_generic), vm, drive.parked, onClose)
            is HandoffState.Cancelled -> Ended(stringResource(CANCEL_TEXT[s.by] ?: R.string.cancelled_generic), vm, drive.parked, onClose)
            is HandoffState.Failed -> Ended(stringResource(FAIL_TEXT.getValue(s.kind)), vm, drive.parked, onClose)
        }
    }
}

@Composable
private fun Ended(text: String, vm: ImportViewModel, parked: Boolean, onClose: () -> Unit) {
    PleosCard(Modifier.widthIn(max = dimensionResource(R.dimen.pleos_popup_system_large_width)), padding = Space.x40, gap = Space.x24) {
        Tag(text, Tone.CAUTION, large = true, maxLines = 2)
        if (parked) Row(horizontalArrangement = Arrangement.spacedBy(Space.x16)) {
            PleosButton(stringResource(R.string.new_qr), vm::start)
            PleosButton(stringResource(R.string.close), { vm.dismissIfFinished(); onClose() }, type = ButtonType.BASIC)
        }
    }
}

/** A finding with its severity spelled out in words, so meaning never depends on color alone. */
@Composable
fun SeverityLine(severity: Severity, text: String) {
    val label = stringResource(if (severity == Severity.CONFLICT) R.string.severity_conflict else R.string.severity_uncertain)
    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(Space.x16)) {
        Box(Modifier.padding(top = Space.x12)) { Dot(if (severity == Severity.CONFLICT) Tone.ERROR else Tone.CAUTION) }
        PleosText(stringResource(R.string.labeled, label, text), Pleos.type.bodyMediumNormal, maxLines = 2)
    }
}

@Composable
private fun ReviewCard(r: ReviewData, code: String, vm: ImportViewModel) {
    val t = r.transfer.trip
    val secondary = colorResource(R.color.tn_text_secondary)
    val body = Pleos.type.bodyMediumNormal
    val fixed = t.visits.count { it.fixed != null }
    val unassigned = t.visits.count { it.unassignedReason != null }
    val first = when (val f = t.firstDay) {
        is FirstDay.DepartOrigin -> f.departTime?.let { stringResource(R.string.first_depart, it) } ?: stringResource(R.string.first_depart_free)
        is FirstDay.ArriveFirstStop -> stringResource(R.string.first_arrive, f.arriveTime)
    }
    val origin = stringResource(when (t.origin) { is Endpoint.Home -> R.string.home; is Endpoint.Current -> R.string.origin_here; is Endpoint.AtPlace -> R.string.place })
    val back = stringResource(if (t.finalDestination is Endpoint.Home) R.string.home else R.string.place)
    val existing = r.decision.existing?.meta?.revision ?: 0
    val caseText = when (r.decision.case) {
        ImportCase.NEW -> stringResource(R.string.case_new)
        ImportCase.SAME -> stringResource(R.string.case_same)
        ImportCase.NEWER -> stringResource(R.string.case_newer, existing)
        ImportCase.OLDER -> stringResource(R.string.case_older, existing)
        ImportCase.DIVERGED -> stringResource(R.string.case_diverged)
    }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val wide = maxWidth > dimensionResource(R.dimen.pleos_window_apps_portrait_width)
        val summary: @Composable () -> Unit = {
            PleosCard(gap = Space.x16) {
                PleosText(stringResource(R.string.review_header, codeLabel(code)), Pleos.type.bodyMedium, secondary, maxLines = 1)
                PleosText(stringResource(R.string.review_name, t.name, t.revision), Pleos.type.titleLarge, maxLines = 2)
                PleosText(stringResource(R.string.labeled, periodLabel(t), nightsLabel(t)), Pleos.type.bodyLarge)
                PleosText(stringResource(R.string.review_counts, t.places.size, fixed, t.days.count { it.lodgingPlaceRef != null }, unassigned), body, secondary)
                PleosText(stringResource(R.string.review_settings, first, origin, back, stringResource(if (t.home != null) R.string.home_included else R.string.home_excluded)), body, secondary)
            }
        }
        val recheck: @Composable () -> Unit = {
            PleosCard(gap = Space.x16) {
                PleosText(stringResource(R.string.recheck_title), Pleos.type.titleSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(Space.x12)) {
                    Tag(stringResource(R.string.count_conflicts, r.report.conflicts), if (r.report.conflicts > 0) Tone.ERROR else Tone.NEUTRAL)
                    Tag(stringResource(R.string.count_uncertain, r.report.uncertain), if (r.report.uncertain > 0) Tone.CAUTION else Tone.NEUTRAL)
                }
                PleosText(stringResource(R.string.recheck_unchanged), body, secondary, maxLines = 1)
                r.report.issues.filter { it.severity != Severity.INFO }.take(4).forEach { SeverityLine(it.severity, issueText(it)) }
            }
        }
        val decide: @Composable () -> Unit = {
            PleosCard(gap = Space.x16) {
                PleosText(caseText, Pleos.type.titleSmall, maxLines = 2)
                r.decision.changes.take(3).forEach { PleosText("· ${changeText(it)}", body, secondary, maxLines = 1) }
                Row(horizontalArrangement = Arrangement.spacedBy(Space.x16), modifier = Modifier.padding(top = Space.x8)) {
                    r.decision.choices.forEach { c ->
                        PleosButton(stringResource(CHOICE_LABEL.getValue(c)), { vm.choose(c) }, type = if (c == ImportChoice.CANCEL) ButtonType.BASIC else ButtonType.FILLED, tag = "choice_${c.name}")
                    }
                }
            }
        }
        if (wide) Row(horizontalArrangement = Arrangement.spacedBy(Space.x32)) {
            Column(Modifier.weight(0.5f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Space.x24)) { summary(); decide() }
            Column(Modifier.weight(0.5f).verticalScroll(rememberScrollState())) { recheck() }
        } else Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Space.x24)) { summary(); recheck(); decide() }
    }
}
