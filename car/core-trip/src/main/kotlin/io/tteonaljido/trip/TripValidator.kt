package io.tteonaljido.trip

import java.time.LocalDate

/**
 * Re-checks an imported plan in the car (spec 24-4). It reports; it never edits the user's plan.
 * Missing travel times are "cannot check", never "OK".
 */
enum class Severity { CONFLICT, UNCERTAIN, INFO }

data class Issue(val severity: Severity, val code: String, val text: String, val dayIndex: Int? = null)

data class ValidationReport(val issues: List<Issue>) {
    val conflicts get() = issues.count { it.severity == Severity.CONFLICT }
    val uncertain get() = issues.count { it.severity == Severity.UNCERTAIN }
    fun forDay(day: Int) = issues.filter { it.dayIndex == day }
}

/** Planned times for one stop; null where an unknown travel time breaks the chain. */
data class StopTime(val visitId: String, val arrive: Int?, val start: Int?, val end: Int?)

object TripValidator {
    private val KOREA_LAT = 330_000_000..390_000_000
    private val KOREA_LON = 1_240_000_000..1_320_000_000

    fun minutes(hhmm: String) = hhmm.substring(0, 2).toInt() * 60 + hhmm.substring(3, 5).toInt()
    fun hhmm(m: Int): String = if (m < 0) "전날" else String.format(java.util.Locale.ROOT, "%02d:%02d", (m / 60) % 24, m % 60) + (if (m >= 1440) "(+1)" else "")

    fun placeName(trip: Trip, ref: String) = trip.places.firstOrNull { it.placeRef == ref }?.name ?: ref
    private fun visit(trip: Trip, id: String) = trip.visits.first { it.visitId == id }

    /** Departure minute of a day, or null when it cannot be known. */
    fun departure(trip: Trip, dayIndex: Int): Int? {
        val day = trip.days[dayIndex - 1]
        if (dayIndex > 1) return day.departTime?.let(::minutes)
        return when (val f = trip.firstDay) {
            is FirstDay.DepartOrigin -> minutes(f.departTime)
            is FirstDay.ArriveFirstStop -> {
                // Arrival basis: leave `leg` minutes before the target arrival; getting ready (prepMinutes) comes before that.
                val leg = day.legs.firstOrNull() ?: return null
                minutes(f.arriveTime) - leg.minutes
            }
        }
    }

    /** Walks one day: arrival = departure + leg; a visit starts after prep, and not before its fixed time. */
    fun timeline(trip: Trip, dayIndex: Int): List<StopTime> {
        val day = trip.days[dayIndex - 1]
        var clock: Int? = departure(trip, dayIndex)
        return day.visitOrder.mapIndexed { k, id ->
            val v = visit(trip, id)
            val leg = day.legs.getOrNull(k)
            val arrive = if (clock != null && leg != null) clock!! + leg.minutes else null
            val fixed = v.fixed?.let { minutes(it.time) }
            val start = when {
                arrive != null -> maxOf(arrive + v.prepMinutes, fixed ?: 0)
                fixed != null -> fixed // an anchor restores the chain even after an unknown leg
                else -> null
            }
            val end = start?.plus(v.stayMinutes)
            clock = end
            StopTime(id, arrive, start, end)
        }
    }

    fun dayEnd(trip: Trip, dayIndex: Int): Int? {
        val day = trip.days[dayIndex - 1]
        val last = if (day.visitOrder.isEmpty()) departure(trip, dayIndex) else timeline(trip, dayIndex).last().end
        val leg = day.legs.lastOrNull() ?: return null
        return last?.plus(leg.minutes)
    }

    fun validate(trip: Trip, overlay: CarOverlay = CarOverlay(), today: LocalDate? = null): ValidationReport {
        val out = mutableListOf<Issue>()
        fun add(s: Severity, code: String, text: String, day: Int? = null) { out += Issue(s, code, text, day) }

        // Places
        trip.places.forEach { p ->
            val lat = p.latE7
            val lon = p.lonE7
            when {
                lat == null || lon == null ->
                    if (p.placeRef !in overlay.poiBindings) add(Severity.UNCERTAIN, "NAME_ONLY", "${p.name}: 이름만 있어요 · 안내할 때 내비에서 위치를 확인해요")
                lat == 0 && lon == 0 -> add(Severity.CONFLICT, "NO_COORDINATES", "${p.name}: 좌표가 없어요")
                lat !in KOREA_LAT || lon !in KOREA_LON -> add(Severity.UNCERTAIN, "OUTSIDE_KOREA", "${p.name}: 국내 범위 밖 좌표예요")
            }
        }
        val located = trip.places.filter { it.latE7 != null && it.lonE7 != null }
        located.forEachIndexed { i, a ->
            located.drop(i + 1).filter { it.name == a.name && metres(a.latE7!!, a.lonE7!!, it.latE7!!, it.lonE7!!) < 30 }.forEach {
                add(Severity.INFO, "DUPLICATE_PLACE", "${a.name}: 같은 장소가 두 번 있어요")
            }
        }

        // Assignment and fixed schedules
        val unassigned = trip.visits.filter { it.unassignedReason != null }
        unassigned.filter { it.fixed != null }.forEach { add(Severity.CONFLICT, "FIXED_UNASSIGNED", "고정 일정 '${placeName(trip, it.placeRef)}'이 어느 날에도 없어요") }
        if (unassigned.isNotEmpty()) add(Severity.INFO, "UNASSIGNED", "배정 안 된 장소 ${unassigned.size}곳 (사유와 함께 보관)")
        trip.visits.mapNotNull { v -> v.fixed?.takeIf { minutes(it.time) % 30 != 0 }?.let { v } }.forEach {
            add(Severity.UNCERTAIN, "FIXED_OFF_GRID", "'${placeName(trip, it.placeRef)}' 고정 시각이 30분 단위가 아니에요")
        }

        // Day by day timeline
        val start = LocalDate.parse(trip.startDate)
        trip.days.forEach { d ->
            val n = d.dayIndex
            if (departure(trip, n) == null) {
                if (n == 1) add(Severity.UNCERTAIN, "FIRST_DEPARTURE_UNKNOWN", "첫날 출발 시각을 계산할 수 없어요 (첫 구간 이동시간 없음)", n)
                else add(Severity.UNCERTAIN, "DEPARTURE_UNKNOWN", "${n}일차 출발 시각이 없어요", n)
            } else if (n == 1 && departure(trip, 1)!! < 0) {
                add(Severity.CONFLICT, "DEPART_PREVIOUS_DAY", "첫 장소 도착 시각을 맞추려면 전날 출발해야 해요", n)
            }
            val missing = d.legs.count { it == null }
            if (missing > 0) add(Severity.UNCERTAIN, "LEG_UNKNOWN", "${n}일차 이동시간 미확인 ${missing}구간 · 충돌 확인 불가", n)
            val times = timeline(trip, n)
            val date = start.plusDays((n - 1).toLong())
            times.forEach { st ->
                val v = visit(trip, st.visitId)
                val name = placeName(trip, v.placeRef)
                val fixed = v.fixed?.let { minutes(it.time) }
                if (fixed != null && st.arrive != null && st.arrive + v.prepMinutes > fixed) {
                    add(Severity.CONFLICT, "LATE_FOR_FIXED", "${n}일차 '$name' 고정 ${v.fixed!!.time}에 늦어요 (예상 ${hhmm(st.arrive + v.prepMinutes)})", n)
                }
                if (fixed != null && st.arrive == null) add(Severity.UNCERTAIN, "FIXED_UNCHECKED", "${n}일차 '$name' 고정 ${v.fixed!!.time}: 이동시간이 없어 확인할 수 없어요", n)
                hoursIssue(trip, v.placeRef, date, st)?.let { add(Severity.CONFLICT, it.first, "${n}일차 '$name' ${it.second}", n) }
            }
            val end = dayEnd(trip, n)
            val endBy = d.endBy?.let(::minutes)
            if (endBy != null && end != null && end > endBy) add(Severity.CONFLICT, "PAST_END_BY", "${n}일차 도착 예상 ${hhmm(end)} · 목표 ${d.endBy}보다 늦어요", n)
        }

        val unknownHours = trip.places.count { it.hours is OpeningHours.Unknown && it.category != PlaceCategory.LODGING }
        if (unknownHours > 0) add(Severity.UNCERTAIN, "HOURS_UNKNOWN", "영업정보 미확인 ${unknownHours}곳 · 방문 전 확인이 필요해요")

        // Lodging chain
        val last = trip.days.size
        trip.days.forEach { d ->
            if (d.dayIndex < last && d.lodgingPlaceRef == null) add(Severity.UNCERTAIN, "LODGING_MISSING", "${d.dayIndex}일차 숙소가 정해지지 않아 다음 날 출발지를 알 수 없어요", d.dayIndex)
            if (d.dayIndex == last && d.lodgingPlaceRef != null) add(Severity.INFO, "LAST_DAY_LODGING", "마지막 날은 숙소 대신 귀가지로 안내해요", d.dayIndex)
            d.lodgingPlaceRef?.let { ref ->
                if (trip.places.first { it.placeRef == ref }.category != PlaceCategory.LODGING) add(Severity.INFO, "LODGING_CATEGORY", "${d.dayIndex}일차 숙소 '${placeName(trip, ref)}'은 숙소 종류가 아니에요", d.dayIndex)
            }
        }

        // Origin and return
        val homeKnown = trip.home != null || overlay.home != null
        if (trip.origin is Endpoint.Home && overlay.originOverride == null && !homeKnown) add(Severity.UNCERTAIN, "ORIGIN_HOME_UNKNOWN", "첫날 출발지(집)를 차량 내비에서 확인해 주세요", 1)
        if (trip.finalDestination is Endpoint.Home && !homeKnown) add(Severity.UNCERTAIN, "RETURN_HOME_UNKNOWN", "마지막 날 귀가지(집)를 차량 내비에서 확인해 주세요", last)

        // Navigation scope
        val needResolve = trip.places.count { it.placeRef !in overlay.poiBindings }
        if (needResolve > 0) add(Severity.INFO, "NAVI_RESOLVE", "${needResolve}곳은 안내 시작 때 내비에서 장소를 확인해요")

        today?.let {
            val end = LocalDate.parse(trip.endDate)
            if (it.isAfter(end)) add(Severity.INFO, "PAST_TRIP", "지난 여행이에요 · 렌터카나 공용 차량이면 삭제해 주세요")
        }
        return ValidationReport(out)
    }

    private fun hoursIssue(trip: Trip, ref: String, date: LocalDate, st: StopTime): Pair<String, String>? {
        val h = trip.places.first { it.placeRef == ref }.hours as? OpeningHours.UserEntered ?: return null
        if (date.toString() in h.closedDates) return "CLOSED_DATE" to "휴무일이에요 (사용자 입력 기준)"
        val today = h.weekly.filter { it.weekday == date.dayOfWeek.value }
        if (today.isEmpty()) return "CLOSED_WEEKDAY" to "이 요일은 영업하지 않아요 (사용자 입력 기준)"
        val s = st.start ?: return null
        val e = st.end ?: return null
        val fits = today.any { w ->
            val o = minutes(w.open)
            var c = minutes(w.close)
            if (c <= o) c += 1440
            s >= o && e <= c
        }
        return if (fits) null else "OUTSIDE_HOURS" to "영업시간 밖이에요 (예상 ${hhmm(s)}~${hhmm(e)}, 사용자 입력 기준)"
    }
}
