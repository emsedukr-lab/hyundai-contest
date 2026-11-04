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
import androidx.compose.ui.unit.dp
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
import io.tteonaljido.car.ui.theme.Pleos
import io.tteonaljido.trip.CarOverlay
import io.tteonaljido.trip.Endpoint
import io.tteonaljido.trip.LocalTrip
import io.tteonaljido.trip.NextDestination
import io.tteonaljido.trip.Severity
import io.tteonaljido.trip.Target
import io.tteonaljido.trip.TripValidator

@Composable
fun TripsScreen(vm: TripsViewModel, drive: DriveState, onImport: () -> Unit, onOpen: (String) -> Unit, onSettings: () -> Unit) {
    val trips by vm.trips.collectAsState()
    val unreadable by vm.unreadable.collectAsState()
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    Screen {
        PleosHeader("떠날지도", "휴대폰에서 만든 여행을 차에서 이어 가요") {
            PleosButton(if (drive.parked) "모바일 여행 불러오기" else "주차 중에만 사용", onImport, enabled = drive.parked, tag = "import")
            PleosButton("설정", onSettings, type = ButtonType.SECONDARY, tag = "settings")
        }
        if (unreadable > 0) StatusLine("읽을 수 없는 여행 파일 ${unreadable}개 · 원본은 그대로 두었어요", Tone.WARNING)
        if (trips.isEmpty()) {
            PleosCard {
                PleosText("저장된 여행이 없어요", Pleos.type.titleMedium)
                PleosText("주차한 뒤 '모바일 여행 불러오기'를 누르고, 휴대폰 카메라로 QR을 스캔하세요.", Pleos.type.bodyLarge, secondary)
            }
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(24.dp)) {
            items(trips, key = { it.localId }) { t ->
                val report = remember(t) { TripValidator.validate(t.plan, t.overlay) }
                val today = vm.todayIndex(t)
                PleosCard(onClick = { onOpen(t.localId) }) {
                    PleosText(t.plan.name, Pleos.type.titleMedium, maxLines = 1)
                    PleosText("${periodLabel(t.plan)} · ${nightsLabel(t.plan)}${today?.let { " · 오늘 ${it}일차" } ?: ""}", Pleos.type.bodyLarge, secondary, maxLines = 1)
                    PleosText("장소 ${t.plan.places.size}곳 · 충돌 ${report.conflicts}건 · 확인 필요 ${report.uncertain}건 · v${t.meta.revision}", Pleos.type.bodySmall, secondary, maxLines = 1)
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
        PleosHeader(t.plan.name, "${periodLabel(t.plan)} · ${nightsLabel(t.plan)} · v${t.meta.revision}") {
            PleosButton("목록", onBack, type = ButtonType.SECONDARY, size = ButtonSize.SMALL)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            t.plan.days.forEach { d ->
                PleosButton("${d.dayIndex}일차", { day = d.dayIndex }, type = if (d.dayIndex == day) ButtonType.PRIMARY else ButtonType.SECONDARY, size = ButtonSize.SMALL, tag = "day${d.dayIndex}")
            }
        }
        BoxWithConstraints(Modifier.fillMaxWidth().weight(1f)) {
            val wide = maxWidth >= 1000.dp
            val plan: @Composable () -> Unit = { DayPlan(t, day) }
            val side: @Composable () -> Unit = {
                Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    NextCard(vm, t, day, drive)
                    PleosCard {
                        PleosText("확인할 점", Pleos.type.titleSmall)
                        val shown = (report.forDay(day) + report.issues.filter { it.dayIndex == null }).filter { it.severity != Severity.INFO }.take(5)
                        if (shown.isEmpty()) PleosText("이 날은 확인할 점이 없어요", Pleos.type.bodyMedium, secondary)
                        shown.forEach { StatusLine(it.text, if (it.severity == Severity.CONFLICT) Tone.NEGATIVE else Tone.WARNING) }
                        if (t.plan.home == null && t.overlay.home == null && (t.plan.origin is Endpoint.Home || t.plan.finalDestination is Endpoint.Home)) {
                            PleosButton("내비 '집' 불러오기", { vm.loadNaviHome(localId) }, type = ButtonType.SECONDARY, enabled = drive.parked, tag = "naviHome")
                        }
                    }
                    PleosButton("이 여행 삭제", { confirmDelete = true }, type = ButtonType.SECONDARY, size = ButtonSize.SMALL, enabled = drive.parked)
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
            "이 여행을 삭제할까요?", "차량에서만 지워져요. 휴대폰에 저장된 여행은 그대로예요.", "삭제", { confirmDelete = false; vm.delete(localId); onBack() },
            cancel = "취소", onCancel = { confirmDelete = false },
        )
    }
}

@Composable
private fun DayPlan(t: LocalTrip, day: Int) {
    val d = t.plan.days[day - 1]
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    val times = remember(t, day) { TripValidator.timeline(t.plan, day).associateBy { it.visitId } }
    val start = if (day == 1) (if (t.plan.origin is Endpoint.Home) "집" else "출발지") else (t.plan.days[day - 2].lodgingPlaceRef?.let { TripValidator.placeName(t.plan, it) } ?: "숙소 미정")
    PleosCard {
        PleosText("${day}일차 · ${dateLabel(d.date)}", Pleos.type.titleSmall)
        PleosText("$start 출발 ${TripValidator.departure(t.plan, day)?.let(TripValidator::hhmm) ?: "시각 미정"}", Pleos.type.bodyMedium, secondary)
        d.visitOrder.forEachIndexed { k, id ->
            val v = t.plan.visits.first { it.visitId == id }
            val st = times[id]
            val time = st?.start?.let(TripValidator::hhmm) ?: "시각 확인 필요"
            val done = if (id in t.overlay.visited) " · 방문함" else ""
            PleosText("${k + 1}. $time  ${TripValidator.placeName(t.plan, v.placeRef)}${v.fixed?.let { " · 고정" } ?: ""}$done", Pleos.type.bodyLarge, maxLines = 1)
            d.legs.getOrNull(k + 1)?.let { PleosText("    ↓ 이동 ${it.minutes}분", Pleos.type.bodySmall, secondary, maxLines = 1) }
                ?: PleosText("    ↓ 이동시간 미확인", Pleos.type.bodySmall, secondary, maxLines = 1)
        }
        val last = day == t.plan.days.size
        val end = if (last) (if (t.plan.finalDestination is Endpoint.Home) "집" else (t.plan.finalDestination as Endpoint.AtPlace).let { TripValidator.placeName(t.plan, it.placeRef) })
        else d.lodgingPlaceRef?.let { TripValidator.placeName(t.plan, it) } ?: "숙소 미정"
        PleosText(if (last) "귀가: $end" else "묵을 곳: $end", Pleos.type.bodyLargeStrong, maxLines = 1)
    }
}

@Composable
private fun NextCard(vm: TripsViewModel, t: LocalTrip, day: Int, drive: DriveState) {
    val step = remember(t, day) { NextDestination.of(t.plan, t.overlay, day) }
    val secondary = colorResource(R.color.pleos_text_dark_secondary)
    PleosCard {
        PleosText("다음 목적지 · ${day}일차", Pleos.type.label, secondary)
        PleosText(step.target?.label ?: "없음", Pleos.type.titleMedium, maxLines = 1)
        if (step.note.isNotBlank()) PleosText(step.note, Pleos.type.bodyMedium, secondary, maxLines = 1)
        if (drive.parked) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                PleosButton("다음 목적지 안내", { vm.guideNext(t.localId, day) }, enabled = step.target != null, tag = "guide")
                (step.target as? Target.Stop)?.let { s -> PleosButton("도착 처리", { vm.markVisited(t.localId, s.visitId) }, type = ButtonType.SECONDARY, tag = "visited") }
            }
        } else {
            PleosText("주차하면 안내를 요청할 수 있어요", Pleos.type.bodyMedium, secondary)
        }
    }
}

@Composable
private fun GuideDialogs(vm: TripsViewModel, g: Guide) {
    when (g) {
        Guide.Idle -> Unit
        is Guide.Working -> PleosSystemPopup("잠시만요", g.text, "닫기", vm::dismissGuide)
        is Guide.ConfirmReplace -> PleosSystemPopup("현재 경로를 바꿀까요?", "지금 '${g.current}'(으)로 안내 중이에요. '${g.target}'(으)로 바꿀까요?", "바꾸기", { vm.confirmReplace() }, cancel = "그대로 두기", onCancel = vm::dismissGuide)
        is Guide.ConfirmPlace -> PleosSystemPopup(
            "이 장소가 맞나요?",
            "내비가 고른 곳은 '${g.found.name}'이에요. 계획한 '${g.wanted}'와 약 ${if (g.metres >= 1000) "%.1fkm".format(g.metres / 1000.0) else "${g.metres}m"} 떨어져 있어요.",
            "맞아요", vm::acceptPlace, cancel = "내비에서 다시 찾기", onCancel = vm::searchInNavi,
        )
        is Guide.ConfirmHome -> PleosSystemPopup("내비의 '집'을 사용할까요?", "${g.home.address.ifBlank { g.home.name }} · 이 차량의 여행 출발·귀가에만 사용해요.", "사용", vm::acceptHome, cancel = "취소", onCancel = vm::dismissGuide)
        is Guide.Done -> PleosSystemPopup("완료", g.text, "확인", vm::dismissGuide)
        is Guide.Failed -> if (g.canSearch) PleosSystemPopup("안내를 확인하지 못했어요", g.text, "내비에서 찾기", vm::searchInNavi, cancel = "닫기", onCancel = vm::dismissGuide)
        else PleosSystemPopup("안내할 수 없어요", g.text, "확인", vm::dismissGuide)
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
        PleosHeader("설정") { PleosButton("목록", onBack, type = ButtonType.SECONDARY, size = ButtonSize.SMALL) }
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(24.dp)) {
            PleosCard {
                PleosText("개인정보", Pleos.type.titleSmall)
                PleosText("불러온 여행은 이 차량에만 암호화해 저장해요. 계정 연결이나 휴대폰과의 계속 동기화는 없어요.", Pleos.type.bodyMedium, secondary)
                PleosText("렌터카·공용 차량을 반납하기 전에는 여행을 모두 삭제해 주세요.", Pleos.type.bodyMedium, secondary)
                PleosButton("모든 여행 삭제", { confirm = true }, type = ButtonType.SECONDARY, tag = "deleteAll")
            }
            if (isEmulator) PleosCard {
                PleosText("시연 (에뮬레이터 전용)", Pleos.type.titleSmall)
                PleosText("시연 데이터는 실제 데이터와 따로 저장해요.", Pleos.type.bodyMedium, secondary)
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    PleosButton(if (demo) "시연 모드 끄기" else "시연 모드 켜기", { onDemo(!demo) }, type = ButtonType.SECONDARY, tag = "demo")
                    if (demo) PleosButton(if (demoDriving) "주행 시연 끄기" else "주행 시연 켜기", { onDemoDriving(!demoDriving) }, type = ButtonType.SECONDARY, tag = "demoDriving")
                }
            }
            PleosCard {
                PleosText("정보", Pleos.type.titleSmall)
                PleosText("떠날지도 ${io.tteonaljido.car.BuildConfig.VERSION_NAME} · 연결 서버 ${server.removePrefix("https://").removePrefix("http://")}", Pleos.type.bodySmall, secondary)
            }
        }
    }
    if (confirm) PleosSystemPopup("모든 여행을 삭제할까요?", "이 차량에 저장된 여행과 방문 기록이 지워져요. 휴대폰의 여행은 그대로예요.", "삭제", { confirm = false; vm.deleteAll() }, cancel = "취소", onCancel = { confirm = false })
}

@Suppress("unused")
private fun overlayOf(t: LocalTrip): CarOverlay = t.overlay
