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
import androidx.compose.ui.unit.dp
import io.tteonaljido.car.R
import io.tteonaljido.car.handoff.ImportViewModel
import io.tteonaljido.car.handoff.QrImage
import io.tteonaljido.car.handoff.ReviewData
import io.tteonaljido.car.safety.DriveState
import io.tteonaljido.car.safety.parked
import io.tteonaljido.car.ui.components.ButtonSize
import io.tteonaljido.car.ui.components.ButtonType
import io.tteonaljido.car.ui.components.PleosButton
import io.tteonaljido.car.ui.components.PleosCard
import io.tteonaljido.car.ui.components.PleosHeader
import io.tteonaljido.car.ui.components.PleosText
import io.tteonaljido.car.ui.components.Screen
import io.tteonaljido.car.ui.components.StatusLine
import io.tteonaljido.car.ui.components.Tone
import io.tteonaljido.car.ui.theme.Pleos
import io.tteonaljido.pairing.FailKind
import io.tteonaljido.pairing.HandoffState
import io.tteonaljido.trip.Endpoint
import io.tteonaljido.trip.FirstDay
import io.tteonaljido.trip.ImportCase
import io.tteonaljido.trip.ImportChoice
import io.tteonaljido.trip.Severity

private val CHOICE_LABEL = mapOf(
    ImportChoice.IMPORT_NEW to "불러오기",
    ImportChoice.UPDATE to "최신 버전으로 업데이트",
    ImportChoice.SAVE_COPY to "새 여행으로 저장",
    ImportChoice.ACKNOWLEDGE_SAME to "확인",
    ImportChoice.CANCEL to "불러오지 않기",
)

private val RESULT_TEXT = mapOf(
    "IMPORTED_NEW" to "새 여행으로 불러왔어요",
    "UPDATED" to "같은 여행을 최신 버전으로 업데이트했어요",
    "SAVED_AS_COPY" to "새 여행(사본)으로 저장했어요",
    "ALREADY_IMPORTED" to "이미 같은 버전이 있어요 · 바뀐 것은 없어요",
    "USER_DECLINED" to "불러오지 않았어요 · 휴대폰에도 알렸어요",
)

private val EXPIRE_TEXT = mapOf(
    "QR" to "QR 유효시간이 지났어요",
    "UPLOAD" to "휴대폰에서 보내기 전에 시간이 지났어요",
    "RESULT" to "승인 시간이 지나 불러오지 않았어요",
    "UNCONFIRMED" to "승인 시간이 지났어요",
)

private val CANCEL_TEXT = mapOf(
    "CAR" to "연결을 취소했어요",
    "MOBILE" to "휴대폰에서 연결을 취소했어요",
    "SECURITY" to "잘못된 연결 시도가 반복되어 보안을 위해 중단했어요",
    "REISSUED" to "새 QR을 받아 이전 QR은 쓸 수 없어요",
)

private val FAIL_TEXT = mapOf(
    FailKind.NETWORK to "인터넷에 연결할 수 없어요 · 연결을 확인해 주세요",
    FailKind.SERVER to "연결 서버가 응답하지 않았어요",
    FailKind.DECRYPT to "받은 내용을 열 수 없어 불러오지 않았어요",
    FailKind.INVALID to "여행 형식이 올바르지 않아 불러오지 않았어요",
    FailKind.UNSUPPORTED to "휴대폰의 여행 형식이 더 새 버전이에요 · 차량 앱 업데이트가 필요해요",
    FailKind.STORAGE to "차량에 저장하지 못했어요 · 원래 여행은 그대로예요",
    FailKind.SECURITY to "연결 확인에 실패해 중단했어요",
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
        PleosHeader("모바일 여행 불러오기", "휴대폰에서 만든 여행 하나를 한 번 가져와요") {
            PleosButton("닫기", { vm.dismissIfFinished(); onClose() }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL)
        }
        if (offline && !CarHandoffEnded(state)) StatusLine("인터넷 연결을 다시 시도하는 중이에요", Tone.WARNING)

        if (!drive.parked && hideable) {
            // QR display and import approval are parked-only (Pleos: "QR 로그인" is restricted while driving).
            PleosCard {
                PleosText("주행 중에는 사용할 수 없어요", Pleos.type.titleMedium)
                PleosText("주차하면 이어서 진행해요. 운전 중에는 휴대폰을 조작하지 마세요.", Pleos.type.bodyLarge, secondary)
            }
            return@Screen
        }

        when (val s = state) {
            HandoffState.Idle, HandoffState.Creating -> StatusLine("QR을 만드는 중이에요")
            is HandoffState.ShowingQr -> BoxWithConstraints(Modifier.fillMaxWidth().weight(1f)) {
                val wide = maxWidth >= 1000.dp
                val qr: @Composable () -> Unit = { QrImage(s.qrUrl, if (wide) minOf(maxHeight * 0.9f, 640.dp) else minOf(maxWidth * 0.7f, 560.dp)) }
                val info: @Composable () -> Unit = {
                    Column(verticalArrangement = Arrangement.spacedBy(dimensionResource(R.dimen.pleos_common_24))) {
                        PleosText("1. 휴대폰 카메라로 QR을 스캔하세요", Pleos.type.bodyLargeStrong)
                        PleosText("2. 휴대폰에 뜨는 6자리 코드를 이 화면과 비교하세요", Pleos.type.bodyLargeStrong)
                        PleosText("3. 휴대폰에서 여행을 골라 보내면, 여기서 한 번 더 승인해요", Pleos.type.bodyLargeStrong)
                        PleosText("남은 시간 ${countdown(s.deadline - now)}", Pleos.type.titleMedium)
                        PleosText("QR에는 여행·개인정보가 없어요 · 5분 동안 한 번만 쓸 수 있어요", Pleos.type.bodySmall, secondary)
                        PleosButton("취소", vm::cancel, type = ButtonType.SECONDARY)
                    }
                }
                if (wide) Row(horizontalArrangement = Arrangement.spacedBy(48.dp), verticalAlignment = Alignment.CenterVertically) { qr(); info() }
                else Column(verticalArrangement = Arrangement.spacedBy(32.dp), horizontalAlignment = Alignment.CenterHorizontally) { qr(); info() }
            }
            is HandoffState.Claimed -> PleosCard {
                StatusLine("휴대폰이 연결됐어요", Tone.POSITIVE)
                PleosText("확인 코드", Pleos.type.label, secondary)
                PleosText(codeLabel(s.code), Pleos.type.code, maxLines = 1)
                PleosText("휴대폰 화면의 코드와 같은지 확인하고, 휴대폰에서 여행을 골라 보내 주세요", Pleos.type.bodyLarge, secondary)
                PleosText("남은 시간 ${countdown(s.deadline - now)}", Pleos.type.bodyMedium)
                PleosButton("내 휴대폰이 아니에요 · 취소", vm::cancel, type = ButtonType.SECONDARY)
            }
            is HandoffState.Receiving -> StatusLine("휴대폰에서 보낸 여행을 받는 중이에요")
            is HandoffState.Review -> review?.let { ReviewCard(it, s.code, vm) } ?: StatusLine("내용을 확인하는 중이에요")
            HandoffState.Applying -> StatusLine("차량에 저장하는 중이에요")
            is HandoffState.Done -> PleosCard {
                StatusLine(RESULT_TEXT[s.resultCode] ?: "완료했어요", if (s.resultCode == "USER_DECLINED") Tone.INFO else Tone.POSITIVE)
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    val id = s.localId
                    if (id != null && s.resultCode != "USER_DECLINED") PleosButton("여행 보기", { vm.dismissIfFinished(); onOpenTrip(id) })
                    PleosButton("닫기", { vm.dismissIfFinished(); onClose() }, type = ButtonType.SECONDARY)
                }
            }
            is HandoffState.Expired -> Ended(EXPIRE_TEXT[s.reason] ?: "시간이 지났어요", vm, onClose)
            is HandoffState.Cancelled -> Ended(CANCEL_TEXT[s.by] ?: "연결이 끝났어요", vm, onClose)
            is HandoffState.Failed -> Ended(FAIL_TEXT[s.kind] ?: "문제가 생겼어요", vm, onClose)
        }
    }
}

private fun CarHandoffEnded(s: HandoffState) = io.tteonaljido.pairing.CarHandoffMachine.isTerminal(s)

@Composable
private fun Ended(text: String, vm: ImportViewModel, onClose: () -> Unit) {
    PleosCard {
        StatusLine(text, Tone.WARNING)
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            PleosButton("새 QR 받기", vm::start)
            PleosButton("닫기", { vm.dismissIfFinished(); onClose() }, type = ButtonType.SECONDARY)
        }
    }
}

@Composable
private fun ReviewCard(r: ReviewData, code: String, vm: ImportViewModel) {
    val t = r.transfer.trip
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    val fixed = t.visits.count { it.fixed != null }
    val unassigned = t.visits.count { it.unassignedReason != null }
    val first = when (val f = t.firstDay) {
        is FirstDay.DepartOrigin -> "첫날 ${f.departTime} 출발"
        is FirstDay.ArriveFirstStop -> "첫날 첫 장소 ${f.arriveTime} 도착 기준"
    }
    val origin = if (t.origin is Endpoint.Home) "집" else "지정 장소"
    val back = if (t.finalDestination is Endpoint.Home) "집" else "지정 장소"
    val caseText = when (r.decision.case) {
        ImportCase.NEW -> "새 여행이에요"
        ImportCase.SAME -> "이미 불러온 여행과 같아요 · 바뀐 것은 없어요"
        ImportCase.NEWER -> "차량에 있는 같은 여행(v${r.decision.existing?.meta?.revision})의 새 버전이에요"
        ImportCase.OLDER -> "차량에 더 최신 버전(v${r.decision.existing?.meta?.revision})이 있어요 · 덮어쓰지 않아요"
        ImportCase.DIVERGED -> "같은 버전 번호인데 내용이 달라요 · 덮어쓰지 않아요"
    }
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        PleosCard {
            PleosText("받은 여행 확인 · 코드 ${codeLabel(code)}", Pleos.type.label, secondary)
            PleosText("${t.name} (v${t.revision})", Pleos.type.titleMedium, maxLines = 2)
            PleosText("${periodLabel(t)} · ${nightsLabel(t)}", Pleos.type.bodyLarge)
            PleosText("장소 ${t.places.size}곳 · 고정 일정 ${fixed}개 · 숙박 ${t.days.count { it.lodgingPlaceRef != null }}박 · 미배정 ${unassigned}곳", Pleos.type.bodyMedium, secondary)
            PleosText("$first · 출발 $origin · 귀가 $back · 집 주소 ${if (t.home != null) "포함" else "미포함(내비 '집' 사용)"}", Pleos.type.bodyMedium, secondary)
        }
        PleosCard {
            PleosText("다시 확인한 결과", Pleos.type.titleSmall)
            PleosText("충돌 ${r.report.conflicts}건 · 확인 필요 ${r.report.uncertain}건 · 원래 계획은 바꾸지 않아요", Pleos.type.bodyMedium)
            r.report.issues.filter { it.severity != Severity.INFO }.take(4).forEach {
                StatusLine("${if (it.severity == Severity.CONFLICT) "충돌" else "확인 필요"} · ${it.text}", if (it.severity == Severity.CONFLICT) Tone.NEGATIVE else Tone.WARNING)
            }
        }
        PleosCard {
            PleosText(caseText, Pleos.type.bodyLargeStrong, maxLines = 2)
            r.decision.changes.take(3).forEach { PleosText("· $it", Pleos.type.bodySmall, secondary, maxLines = 1) }
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.widthIn(max = 1200.dp)) {
                r.decision.choices.forEach { c ->
                    PleosButton(CHOICE_LABEL.getValue(c), { vm.choose(c) }, type = if (c == ImportChoice.CANCEL) ButtonType.SECONDARY else ButtonType.PRIMARY, tag = "choice_${c.name}")
                }
            }
        }
    }
}
