package io.tteonaljido.trip

import java.time.LocalDate

/**
 * Re-checks an imported plan in the car (spec 24-4). It reports; it never edits the user's plan.
 * Missing travel times are "cannot check", never "OK".
 */
enum class Severity { CONFLICT, UNCERTAIN, INFO }

/** `text` is Korean for logs and tests; apps localize from `code` + `args` (strings `issue_<code>`). */
data class Issue(val severity: Severity, val code: String, val text: String, val dayIndex: Int? = null, val args: List<String> = emptyList())

data class ValidationReport(val issues: List<Issue>) {
    val conflicts get() = issues.count { it.severity == Severity.CONFLICT }
    val uncertain get() = issues.count { it.severity == Severity.UNCERTAIN }
    fun forDay(day: Int) = issues.filter { it.dayIndex == day }
}

/** Planned times for one stop; null where an unknown travel time breaks the chain. */
data class StopTime(val visitId: String, val arrive: Int?, val start: Int?, val end: Int?)

enum class LegFrom { USER, NAVI }

/** A leg's travel time and where it came from: the phone's plan first, else the car navigation's estimate. */
data class LegValue(val minutes: Int, val from: LegFrom)

/** Keys for car-side leg estimates: "from>to", where each end is a placeRef, [HOME] or [ORIGIN]. */
object LegKeys {
    const val HOME = "@home"
    const val ORIGIN = "@origin"

    private fun endpoint(e: Endpoint) = when (e) {
        is Endpoint.Home -> HOME
        is Endpoint.AtPlace -> e.placeRef
    }

    fun dayStart(trip: Trip, overlay: CarOverlay, dayIndex: Int): String? =
        if (overlay.originFor(dayIndex) != null) ORIGIN
        else if (dayIndex == 1) endpoint(trip.origin)
        else trip.days[dayIndex - 2].lodgingPlaceRef

    fun dayEnd(trip: Trip, dayIndex: Int): String? =
        if (dayIndex == trip.days.size) endpoint(trip.finalDestination) else trip.days[dayIndex - 1].lodgingPlaceRef

    /** Key of leg k of a day (k = 0 leaves the day's start, k = stops leads to the night's lodging or the final destination). */
    fun of(trip: Trip, overlay: CarOverlay, dayIndex: Int, k: Int): String? {
        val order = trip.days[dayIndex - 1].visitOrder
        fun ref(i: Int) = trip.visits.first { it.visitId == order[i] }.placeRef
        val from = if (k == 0) dayStart(trip, overlay, dayIndex) else ref(k - 1)
        val to = if (k == order.size) dayEnd(trip, dayIndex) else ref(k)
        return if (from == null || to == null) null else "$from>$to"
    }

    /**
     * Key of the plan leg that starts where the car stands (the day's start, or the stop just visited) and ends at the
     * next stop in guidance order ([NextDestination.upcoming]: deferred stops last), or null. A 'from here' estimate is
     * measured to that next stop, so it is kept only when a plan leg runs exactly there.
     */
    fun startingAt(trip: Trip, overlay: CarOverlay, dayIndex: Int, latE7: Int, lonE7: Int): String? {
        val order = trip.days[dayIndex - 1].visitOrder
        val next = NextDestination.upcoming(trip, overlay, dayIndex).firstOrNull()
        // No stop left: the leg to the night's lodging or the final destination. A stop moved in from another day: no plan leg.
        val k = if (next == null) order.size else order.indexOf(next).takeIf { it >= 0 } ?: return null
        val fromRef: String? = if (k == 0) dayStart(trip, overlay, dayIndex) else order[k - 1].takeIf { it in overlay.visited }?.let { id -> trip.visits.first { it.visitId == id }.placeRef }
        val at: Pair<Int, Int>? = when (fromRef) {
            null -> null
            ORIGIN -> overlay.originFor(dayIndex)?.let { it.latE7 to it.lonE7 }
            HOME -> (overlay.home?.let { it.latE7 to it.lonE7 } ?: trip.home?.let { it.latE7 to it.lonE7 })
            else -> overlay.poiBindings[fromRef]?.let { it.latE7 to it.lonE7 } ?: trip.places.first { it.placeRef == fromRef }.let { p -> p.latE7?.let { la -> p.lonE7?.let { lo -> la to lo } } }
        }
        if (at == null || metres(at.first, at.second, latE7, lonE7) > PlaceMatch.SAME_METRES) return null
        return of(trip, overlay, dayIndex, k)
    }
}

object TripValidator {
    private val KOREA_LAT = 330_000_000..390_000_000
    private val KOREA_LON = 1_240_000_000..1_320_000_000

    fun minutes(hhmm: String) = hhmm.substring(0, 2).toInt() * 60 + hhmm.substring(3, 5).toInt()
    fun hhmm(m: Int): String = if (m < 0) "전날" else String.format(java.util.Locale.ROOT, "%02d:%02d", (m / 60) % 24, m % 60) + (if (m >= 1440) "(+1)" else "")

    fun placeName(trip: Trip, ref: String) = trip.places.firstOrNull { it.placeRef == ref }?.name ?: ref
    private fun visit(trip: Trip, id: String) = trip.visits.first { it.visitId == id }

    /**
     * Travel time of leg k: the plan's own value first, else the navigation's estimate. After "여기서 출발" the plan's
     * first-day leg (from home) no longer applies, so only an estimate from the new origin counts.
     */
    fun leg(trip: Trip, overlay: CarOverlay, dayIndex: Int, k: Int): LegValue? {
        val navi = LegKeys.of(trip, overlay, dayIndex, k)?.let(overlay.legEstimates::get)?.let { LegValue(it.minutes, LegFrom.NAVI) }
        // After "여기서 출발" on this day, the plan's first leg (from the lodging or origin) no longer applies.
        if (k == 0 && overlay.originFor(dayIndex) != null) return navi
        return trip.days[dayIndex - 1].legs.getOrNull(k)?.let { LegValue(it.minutes, LegFrom.USER) } ?: navi
    }

    /** Departure minute of a day, or null when it cannot be known. */
    fun departure(trip: Trip, dayIndex: Int, overlay: CarOverlay = CarOverlay()): Int? {
        val day = trip.days[dayIndex - 1]
        if (dayIndex > 1) return day.departTime?.let(::minutes)
        return when (val f = trip.firstDay) {
            is FirstDay.DepartOrigin -> minutes(f.departTime)
            is FirstDay.ArriveFirstStop -> {
                // Arrival basis: leave `leg` minutes before the target arrival; getting ready (prepMinutes) comes before that.
                val leg = leg(trip, overlay, 1, 0) ?: return null
                minutes(f.arriveTime) - leg.minutes
            }
        }
    }

    /**
     * Walks stops from `start`: arrival = clock + leg; a visit starts after prep (plus a measured parking buffer) and
     * not before its fixed time; a fixed time restores the chain even after an unknown leg. `bufferAt`/`stayMult`
     * default to no-op (0 / 1.0) so the plan check and cross-language fixtures are unchanged; only the car's live
     * projection passes measured values. Shared by the plan check and the live projection.
     */
    internal fun walk(start: Int?, items: List<Pair<Visit, Int?>>, bufferAt: (Int) -> Int = { 0 }, stayMult: Double = 1.0): List<StopTime> {
        var clock: Int? = start
        return items.mapIndexed { i, (v, leg) ->
            val arrive = if (clock != null && leg != null) clock!! + leg else null
            val fixed = v.fixed?.let { minutes(it.time) }
            val begin = when {
                arrive != null -> maxOf(arrive + v.prepMinutes + bufferAt(i), fixed ?: 0)
                fixed != null -> fixed
                else -> null
            }
            val end = begin?.plus(Math.round(v.stayMinutes * stayMult).toInt())
            clock = end
            StopTime(v.visitId, arrive, begin, end)
        }
    }

    /** Walks one day of the plan from its departure. */
    fun timeline(trip: Trip, dayIndex: Int, overlay: CarOverlay = CarOverlay()): List<StopTime> {
        val day = trip.days[dayIndex - 1]
        return walk(departure(trip, dayIndex, overlay), day.visitOrder.mapIndexed { k, id -> visit(trip, id) to leg(trip, overlay, dayIndex, k)?.minutes })
    }

    fun dayEnd(trip: Trip, dayIndex: Int, overlay: CarOverlay = CarOverlay()): Int? {
        val day = trip.days[dayIndex - 1]
        val last = if (day.visitOrder.isEmpty()) departure(trip, dayIndex, overlay) else timeline(trip, dayIndex, overlay).last().end
        val leg = leg(trip, overlay, dayIndex, day.visitOrder.size) ?: return null
        return last?.plus(leg.minutes)
    }

    fun validate(trip: Trip, overlay: CarOverlay = CarOverlay(), today: LocalDate? = null): ValidationReport {
        val out = mutableListOf<Issue>()
        fun add(s: Severity, code: String, text: String, day: Int? = null, vararg args: Any) { out += Issue(s, code, text, day, args.map(Any::toString)) }

        // Places
        trip.places.forEach { p ->
            val lat = p.latE7
            val lon = p.lonE7
            when {
                lat == null || lon == null ->
                    if (p.placeRef !in overlay.poiBindings) add(Severity.UNCERTAIN, "NAME_ONLY", "${p.name}: 이름만 있어요 · 안내할 때 내비에서 위치를 확인해요", null, p.name)
                lat == 0 && lon == 0 -> add(Severity.CONFLICT, "NO_COORDINATES", "${p.name}: 좌표가 없어요", null, p.name)
                lat !in KOREA_LAT || lon !in KOREA_LON -> add(Severity.UNCERTAIN, "OUTSIDE_KOREA", "${p.name}: 국내 범위 밖 좌표예요", null, p.name)
            }
        }
        val located = trip.places.filter { it.latE7 != null && it.lonE7 != null }
        located.forEachIndexed { i, a ->
            located.drop(i + 1).filter { it.name == a.name && metres(a.latE7!!, a.lonE7!!, it.latE7!!, it.lonE7!!) < 30 }.forEach {
                add(Severity.INFO, "DUPLICATE_PLACE", "${a.name}: 같은 장소가 두 번 있어요", null, a.name)
            }
        }

        // Assignment and fixed schedules
        val unassigned = trip.visits.filter { it.unassignedReason != null }
        unassigned.filter { it.fixed != null }.forEach { add(Severity.CONFLICT, "FIXED_UNASSIGNED", "고정 일정 '${placeName(trip, it.placeRef)}'이 어느 날에도 없어요", null, placeName(trip, it.placeRef)) }
        if (unassigned.isNotEmpty()) add(Severity.INFO, "UNASSIGNED", "배정 안 된 장소 ${unassigned.size}곳 (사유와 함께 보관)", null, unassigned.size)
        trip.visits.mapNotNull { v -> v.fixed?.takeIf { minutes(it.time) % 30 != 0 }?.let { v } }.forEach {
            add(Severity.UNCERTAIN, "FIXED_OFF_GRID", "'${placeName(trip, it.placeRef)}' 고정 시각이 30분 단위가 아니에요", null, placeName(trip, it.placeRef))
        }

        // Day by day timeline
        val start = LocalDate.parse(trip.startDate)
        trip.days.forEach { d ->
            val n = d.dayIndex
            if (departure(trip, n, overlay) == null) {
                if (n == 1) add(Severity.UNCERTAIN, "FIRST_DEPARTURE_UNKNOWN", "첫날 출발 시각을 계산할 수 없어요 (첫 구간 이동시간 없음)", n)
                else add(Severity.UNCERTAIN, "DEPARTURE_UNKNOWN", "${n}일차 출발 시각이 없어요", n, n)
            } else if (n == 1 && departure(trip, 1, overlay)!! < 0) {
                add(Severity.CONFLICT, "DEPART_PREVIOUS_DAY", "첫 장소 도착 시각을 맞추려면 전날 출발해야 해요", n)
            }
            val legs = (0..d.visitOrder.size).map { leg(trip, overlay, n, it) }
            val missing = legs.count { it == null }
            if (missing > 0) add(Severity.UNCERTAIN, "LEG_UNKNOWN", "${n}일차 이동시간 미확인 ${missing}구간 · 충돌 확인 불가", n, n, missing)
            val navi = legs.count { it?.from == LegFrom.NAVI }
            if (navi > 0) add(Severity.INFO, "LEG_NAVI", "${n}일차 ${navi}구간은 내비 예상 이동시간이에요", n, n, navi)
            val times = timeline(trip, n, overlay)
            val date = start.plusDays((n - 1).toLong())
            times.forEach { st ->
                val v = visit(trip, st.visitId)
                val name = placeName(trip, v.placeRef)
                val fixed = v.fixed?.let { minutes(it.time) }
                if (fixed != null && st.arrive != null && st.arrive + v.prepMinutes > fixed) {
                    add(Severity.CONFLICT, "LATE_FOR_FIXED", "${n}일차 '$name' 고정 ${v.fixed!!.time}에 늦어요 (예상 ${hhmm(st.arrive + v.prepMinutes)})", n, n, name, v.fixed!!.time, hhmm(st.arrive + v.prepMinutes))
                }
                if (fixed != null && st.arrive == null) add(Severity.UNCERTAIN, "FIXED_UNCHECKED", "${n}일차 '$name' 고정 ${v.fixed!!.time}: 이동시간이 없어 확인할 수 없어요", n, n, name, v.fixed!!.time)
                hoursIssue(trip, v.placeRef, date, st)?.let { add(Severity.CONFLICT, it.code, "${n}일차 '$name' ${it.text}", n, n, name, *it.extra.toTypedArray()) }
            }
            val end = dayEnd(trip, n, overlay)
            val endBy = d.endBy?.let(::minutes)
            if (endBy != null && end != null && end > endBy) add(Severity.CONFLICT, "PAST_END_BY", "${n}일차 도착 예상 ${hhmm(end)} · 목표 ${d.endBy}보다 늦어요", n, n, hhmm(end), d.endBy!!)
        }

        val unknownHours = trip.places.count { it.hours is OpeningHours.Unknown && it.category != PlaceCategory.LODGING }
        if (unknownHours > 0) add(Severity.UNCERTAIN, "HOURS_UNKNOWN", "영업정보 미확인 ${unknownHours}곳 · 방문 전 확인이 필요해요", null, unknownHours)

        // Lodging chain
        val last = trip.days.size
        trip.days.forEach { d ->
            if (d.dayIndex < last && d.lodgingPlaceRef == null) add(Severity.UNCERTAIN, "LODGING_MISSING", "${d.dayIndex}일차 숙소가 정해지지 않아 다음 날 출발지를 알 수 없어요", d.dayIndex, d.dayIndex)
            if (d.dayIndex == last && d.lodgingPlaceRef != null) add(Severity.INFO, "LAST_DAY_LODGING", "마지막 날은 숙소 대신 귀가지로 안내해요", d.dayIndex)
            d.lodgingPlaceRef?.let { ref ->
                if (trip.places.first { it.placeRef == ref }.category != PlaceCategory.LODGING) add(Severity.INFO, "LODGING_CATEGORY", "${d.dayIndex}일차 숙소 '${placeName(trip, ref)}'은 숙소 종류가 아니에요", d.dayIndex, d.dayIndex, placeName(trip, ref))
            }
        }

        // Origin and return
        val homeKnown = trip.home != null || overlay.home != null
        if (trip.origin is Endpoint.Home && overlay.originFor(1) == null && !homeKnown) add(Severity.UNCERTAIN, "ORIGIN_HOME_UNKNOWN", "첫날 출발지(집)를 차량 내비에서 확인해 주세요", 1)
        if (trip.finalDestination is Endpoint.Home && !homeKnown) add(Severity.UNCERTAIN, "RETURN_HOME_UNKNOWN", "마지막 날 귀가지(집)를 차량 내비에서 확인해 주세요", last)

        // Navigation scope
        val needResolve = trip.places.count { it.placeRef !in overlay.poiBindings }
        if (needResolve > 0) add(Severity.INFO, "NAVI_RESOLVE", "${needResolve}곳은 안내 시작 때 내비에서 장소를 확인해요", null, needResolve)

        today?.let {
            val end = LocalDate.parse(trip.endDate)
            if (it.isAfter(end)) add(Severity.INFO, "PAST_TRIP", "지난 여행이에요 · 렌터카나 공용 차량이면 삭제해 주세요")
        }
        return ValidationReport(out)
    }

    private data class HoursIssue(val code: String, val text: String, val extra: List<String> = emptyList())

    private fun hoursIssue(trip: Trip, ref: String, date: LocalDate, st: StopTime): HoursIssue? {
        val h = trip.places.first { it.placeRef == ref }.hours as? OpeningHours.UserEntered ?: return null
        if (date.toString() in h.closedDates) return HoursIssue("CLOSED_DATE", "휴무일이에요 (사용자 입력 기준)")
        val today = h.weekly.filter { it.weekday == date.dayOfWeek.value }
        if (today.isEmpty()) return HoursIssue("CLOSED_WEEKDAY", "이 요일은 영업하지 않아요 (사용자 입력 기준)")
        val s = st.start ?: return null
        val e = st.end ?: return null
        val fits = today.any { w ->
            val o = minutes(w.open)
            var c = minutes(w.close)
            if (c <= o) c += 1440
            s >= o && e <= c
        }
        return if (fits) null else HoursIssue("OUTSIDE_HOURS", "영업시간 밖이에요 (예상 ${hhmm(s)}~${hhmm(e)}, 사용자 입력 기준)", listOf(hhmm(s), hhmm(e)))
    }
}
