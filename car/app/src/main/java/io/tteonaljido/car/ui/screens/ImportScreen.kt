package io.tteonaljido.car.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.dimensionResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import io.tteonaljido.car.R
import io.tteonaljido.car.handoff.ImportViewModel
import io.tteonaljido.car.handoff.QrImage
import io.tteonaljido.car.handoff.ReviewData
import io.tteonaljido.car.safety.DriveState
import io.tteonaljido.car.safety.parked
import io.tteonaljido.car.ui.changeText
import io.tteonaljido.car.ui.components.ButtonSize
import io.tteonaljido.car.ui.components.ButtonType
import io.tteonaljido.car.ui.components.PleosButton
import io.tteonaljido.car.ui.components.PleosCard
import io.tteonaljido.car.ui.components.PleosHeader
import io.tteonaljido.car.ui.components.PleosText
import io.tteonaljido.car.ui.components.Screen
import io.tteonaljido.car.ui.components.StatusLine
import io.tteonaljido.car.ui.components.Tone
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
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    val hideable = state is HandoffState.ShowingQr || state is HandoffState.Claimed || state is HandoffState.Review

    Screen {
        PleosHeader(stringResource(R.string.import_title), stringResource(R.string.import_subtitle)) {
            PleosButton(stringResource(R.string.close), { vm.dismissIfFinished(); onClose() }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL)
        }
        if (offline && !CarHandoffMachine.isTerminal(state)) StatusLine(stringResource(R.string.reconnecting), Tone.WARNING)

        if (!drive.parked && hideable) {
            // QR display and import approval are parked-only (Pleos: "QR 로그인" is restricted while driving).
            PleosCard {
                PleosText(stringResource(R.string.driving_title), Pleos.type.titleMedium)
                PleosText(stringResource(R.string.driving_body), Pleos.type.bodyLarge, secondary)
            }
            return@Screen
        }

        when (val s = state) {
            HandoffState.Idle, HandoffState.Creating -> StatusLine(stringResource(R.string.creating_qr))
            is HandoffState.ShowingQr -> BoxWithConstraints(Modifier.fillMaxWidth().weight(1f)) {
                val wide = maxWidth >= 1000.dp
                val qr: @Composable () -> Unit = { QrImage(s.qrUrl, if (wide) minOf(maxHeight * 0.9f, 640.dp) else minOf(maxWidth * 0.7f, 560.dp)) }
                val info: @Composable () -> Unit = {
                    Column(verticalArrangement = Arrangement.spacedBy(dimensionResource(R.dimen.pleos_common_24))) {
                        PleosText(stringResource(R.string.qr_step1), Pleos.type.bodyLargeStrong)
                        PleosText(stringResource(R.string.qr_step2), Pleos.type.bodyLargeStrong)
                        PleosText(stringResource(R.string.qr_step3), Pleos.type.bodyLargeStrong)
                        PleosText(stringResource(R.string.time_left, countdown(s.deadline - now)), Pleos.type.titleMedium)
                        PleosText(stringResource(R.string.qr_note), Pleos.type.bodySmall, secondary)
                        PleosButton(stringResource(R.string.cancel), vm::cancel, type = ButtonType.SECONDARY)
                    }
                }
                if (wide) Row(horizontalArrangement = Arrangement.spacedBy(48.dp), verticalAlignment = Alignment.CenterVertically) { qr(); info() }
                else Column(verticalArrangement = Arrangement.spacedBy(32.dp), horizontalAlignment = Alignment.CenterHorizontally) { qr(); info() }
            }
            is HandoffState.Claimed -> PleosCard {
                StatusLine(stringResource(R.string.phone_connected), Tone.POSITIVE)
                PleosText(stringResource(R.string.confirm_code), Pleos.type.label, secondary)
                PleosText(codeLabel(s.code), Pleos.type.code, maxLines = 1)
                PleosText(stringResource(R.string.claimed_body), Pleos.type.bodyLarge, secondary)
                PleosText(stringResource(R.string.time_left, countdown(s.deadline - now)), Pleos.type.bodyMedium)
                PleosButton(stringResource(R.string.not_my_phone), vm::cancel, type = ButtonType.SECONDARY)
            }
            is HandoffState.Receiving -> StatusLine(stringResource(R.string.receiving))
            is HandoffState.Review -> review?.let { ReviewCard(it, s.code, vm) } ?: StatusLine(stringResource(R.string.checking))
            HandoffState.Applying -> StatusLine(stringResource(R.string.applying))
            is HandoffState.Done -> PleosCard {
                StatusLine(stringResource(RESULT_TEXT[s.resultCode] ?: R.string.result_done), if (s.resultCode == "USER_DECLINED") Tone.INFO else Tone.POSITIVE)
                if (drive.parked) Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    val id = s.localId
                    if (id != null && s.resultCode != "USER_DECLINED") PleosButton(stringResource(R.string.open_trip), { vm.dismissIfFinished(); onOpenTrip(id) })
                    PleosButton(stringResource(R.string.close), { vm.dismissIfFinished(); onClose() }, type = ButtonType.SECONDARY)
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
    PleosCard {
        StatusLine(text, Tone.WARNING)
        if (parked) Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            PleosButton(stringResource(R.string.new_qr), vm::start)
            PleosButton(stringResource(R.string.close), { vm.dismissIfFinished(); onClose() }, type = ButtonType.SECONDARY)
        }
    }
}

/** A finding with its severity spelled out in words, so meaning never depends on color alone. */
@Composable
fun SeverityLine(severity: Severity, text: String) {
    val label = stringResource(if (severity == Severity.CONFLICT) R.string.severity_conflict else R.string.severity_uncertain)
    StatusLine(stringResource(R.string.labeled, label, text), if (severity == Severity.CONFLICT) Tone.NEGATIVE else Tone.WARNING)
}

@Composable
private fun ReviewCard(r: ReviewData, code: String, vm: ImportViewModel) {
    val t = r.transfer.trip
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    val fixed = t.visits.count { it.fixed != null }
    val unassigned = t.visits.count { it.unassignedReason != null }
    val first = when (val f = t.firstDay) {
        is FirstDay.DepartOrigin -> f.departTime?.let { stringResource(R.string.first_depart, it) } ?: stringResource(R.string.first_depart_free)
        is FirstDay.ArriveFirstStop -> stringResource(R.string.first_arrive, f.arriveTime)
    }
    val origin = stringResource(if (t.origin is Endpoint.Home) R.string.home else R.string.place)
    val back = stringResource(if (t.finalDestination is Endpoint.Home) R.string.home else R.string.place)
    val existing = r.decision.existing?.meta?.revision ?: 0
    val caseText = when (r.decision.case) {
        ImportCase.NEW -> stringResource(R.string.case_new)
        ImportCase.SAME -> stringResource(R.string.case_same)
        ImportCase.NEWER -> stringResource(R.string.case_newer, existing)
        ImportCase.OLDER -> stringResource(R.string.case_older, existing)
        ImportCase.DIVERGED -> stringResource(R.string.case_diverged)
    }
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        PleosCard {
            PleosText(stringResource(R.string.review_header, codeLabel(code)), Pleos.type.label, secondary)
            PleosText(stringResource(R.string.review_name, t.name, t.revision), Pleos.type.titleMedium, maxLines = 2)
            PleosText(stringResource(R.string.labeled, periodLabel(t), nightsLabel(t)), Pleos.type.bodyLarge)
            PleosText(stringResource(R.string.review_counts, t.places.size, fixed, t.days.count { it.lodgingPlaceRef != null }, unassigned), Pleos.type.bodyMedium, secondary)
            PleosText(stringResource(R.string.review_settings, first, origin, back, stringResource(if (t.home != null) R.string.home_included else R.string.home_excluded)), Pleos.type.bodyMedium, secondary)
        }
        PleosCard {
            PleosText(stringResource(R.string.recheck_title), Pleos.type.titleSmall)
            PleosText(stringResource(R.string.recheck_summary, r.report.conflicts, r.report.uncertain), Pleos.type.bodyMedium)
            r.report.issues.filter { it.severity != Severity.INFO }.take(4).forEach { SeverityLine(it.severity, issueText(it)) }
        }
        PleosCard {
            PleosText(caseText, Pleos.type.bodyLargeStrong, maxLines = 2)
            r.decision.changes.take(3).forEach { PleosText("· ${changeText(it)}", Pleos.type.bodySmall, secondary, maxLines = 1) }
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.widthIn(max = 1200.dp)) {
                r.decision.choices.forEach { c ->
                    PleosButton(stringResource(CHOICE_LABEL.getValue(c)), { vm.choose(c) }, type = if (c == ImportChoice.CANCEL) ButtonType.SECONDARY else ButtonType.PRIMARY, tag = "choice_${c.name}")
                }
            }
        }
    }
}
