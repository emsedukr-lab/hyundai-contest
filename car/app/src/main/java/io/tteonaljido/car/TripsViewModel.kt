package io.tteonaljido.car

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.tteonaljido.car.guide.ArrivalNote
import io.tteonaljido.car.guide.GuidanceTracker
import io.tteonaljido.car.navi.NaviGateway
import io.tteonaljido.car.navi.NaviLive
import io.tteonaljido.car.navi.RouteOutcome
import io.tteonaljido.car.navi.RouteTarget
import io.tteonaljido.car.storage.TripRepository
import io.tteonaljido.car.ui.Msg
import io.tteonaljido.trip.Endpoint
import io.tteonaljido.trip.GuidingTarget
import io.tteonaljido.trip.LegEstimate
import io.tteonaljido.trip.LegKeys
import io.tteonaljido.trip.LiveProjection
import io.tteonaljido.trip.LocalTrip
import io.tteonaljido.trip.Match
import io.tteonaljido.trip.NaviBinding
import io.tteonaljido.trip.NextDestination
import io.tteonaljido.trip.NextStep
import io.tteonaljido.trip.Place
import io.tteonaljido.trip.PlaceMatch
import io.tteonaljido.trip.Projection
import io.tteonaljido.trip.Target
import io.tteonaljido.trip.VisitHow
import io.tteonaljido.trip.VisitStamp
import io.tteonaljido.trip.metres
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale

/** Guidance dialogs; each asks before anything changes the real navigation or the stored trip. */
sealed interface Guide {
    data object Idle : Guide
    data class Working(val msg: Msg) : Guide
    data class ConfirmReplace(val current: String, val target: String) : Guide
    data class ConfirmPlace(val found: NaviBinding, val wanted: String, val metres: Int) : Guide
    data class ConfirmHome(val home: NaviBinding) : Guide
    data class Done(val msg: Msg) : Guide
    data class Failed(val msg: Msg, val canSearch: Boolean) : Guide
}

/** A one-off `requestTrip` answer from where the car stood, kept for the screen (and the projection) for an hour. */
data class HereEstimate(val target: String, val targetKey: String, val minutes: Int, val metres: Int, val socAtDest: Int?, val at: Long)

/** The live view of today: the projection plus what the navigation is doing. */
data class LiveView(val projection: Projection, val naviElsewhere: String?, val here: HereEstimate?)

/**
 * `homeLabel`/`bookmarkLabel` are the localized words for home, used as the navigation place name and in messages.
 * `update` is the app's single write path; `nowMs` is the app clock (shifted only by the emulator demo clock).
 */
class TripsViewModel(
    private val repo: () -> TripRepository,
    private val update: (String, (LocalTrip) -> LocalTrip) -> LocalTrip?,
    private val navi: NaviGateway,
    private val tracker: GuidanceTracker,
    private val nowMs: () -> Long,
    clockOffset: StateFlow<Long>,
    private val homeLabel: String,
    private val bookmarkLabel: String,
) : ViewModel() {
    private val _trips = MutableStateFlow<List<LocalTrip>>(emptyList())
    val trips: StateFlow<List<LocalTrip>> = _trips
    private val _unreadable = MutableStateFlow(0)
    val unreadable: StateFlow<Int> = _unreadable
    private val _guide = MutableStateFlow<Guide>(Guide.Idle)
    val guide: StateFlow<Guide> = _guide
    private val _now = MutableStateFlow(nowMs())
    /** Ticks every 30 s (and when the demo clock moves) so times on screen stay current. */
    val now: StateFlow<Long> = _now
    val naviLive: StateFlow<NaviLive?> = navi.live
    val lastArrival: StateFlow<ArrivalNote?> = tracker.lastArrival
    private val _here = MutableStateFlow<Map<String, HereEstimate>>(emptyMap())
    val here: StateFlow<Map<String, HereEstimate>> = _here

    private data class Pending(val localId: String, val placeRef: String?, val target: RouteTarget, val kind: Kind, val previous: NaviBinding? = null, val dayIndex: Int = 0, val visitId: String? = null)
    private enum class Kind { ROUTE, SEARCH, HOME }
    private var pending: Pending? = null

    init {
        reload()
        viewModelScope.launch { tracker.changed.collect { reload() } }
        viewModelScope.launch { clockOffset.collect { _now.value = nowMs() } }
        viewModelScope.launch {
            while (true) {
                delay(30_000)
                _now.value = nowMs()
                // Push events cover route start/stop; while guiding, refresh the remaining time as a fallback.
                if (navi.live.value?.guiding == true) navi.refreshLive()
            }
        }
    }

    fun reload() {
        val loaded = repo().load()
        _trips.value = loaded.trips
        _unreadable.value = loaded.unreadable.size
    }

    fun trip(id: String) = _trips.value.firstOrNull { it.localId == id }

    fun delete(id: String) { repo().delete(id); reload() }
    fun deleteAll() { repo().deleteAll(); reload() }

    private fun edit(id: String, f: (LocalTrip) -> LocalTrip) {
        update(id, f)
        reload()
    }

    fun markVisited(id: String, visitId: String) = edit(id) {
        val o = it.overlay
        it.copy(overlay = o.copy(visited = o.visited + visitId, visitedAt = o.visitedAt + (visitId to VisitStamp(nowMs(), VisitHow.MANUAL))))
    }

    fun undoVisited(id: String, visitId: String) {
        edit(id) { it.copy(overlay = it.overlay.copy(visited = it.overlay.visited - visitId, visitedAt = it.overlay.visitedAt - visitId)) }
        if (tracker.lastArrival.value?.visitId == visitId) tracker.dismiss()
    }

    fun skip(id: String, visitId: String) = edit(id) { it.copy(overlay = it.overlay.copy(skipped = it.overlay.skipped + visitId)) }
    fun unskip(id: String, visitId: String) = edit(id) { it.copy(overlay = it.overlay.copy(skipped = it.overlay.skipped - visitId)) }
    fun dismissArrival() = tracker.dismiss()
    fun dismissGuide() { _guide.value = Guide.Idle; pending = null }
    fun openChargers() = navi.openNearbyChargers()

    fun today(t: LocalTrip, now: Long = _now.value): LocalDate = Instant.ofEpochMilli(now).atZone(ZoneId.of(t.plan.timezone)).toLocalDate()
    fun todayIndex(t: LocalTrip, now: Long = _now.value): Int? = runCatching { NextDestination.dayIndexFor(t.plan, today(t, now)) }.getOrNull()
    private fun minuteOfDay(t: LocalTrip, now: Long) = Instant.ofEpochMilli(now).atZone(ZoneId.of(t.plan.timezone)).toLocalTime().let { it.hour * 60 + it.minute }

    private fun placeTarget(t: LocalTrip, p: Place): RouteTarget {
        val b = t.overlay.poiBindings[p.placeRef]
        return if (b != null) RouteTarget(b.name, b.address, b.latE7, b.lonE7, b.poiId, b.poiSubId, b.poiProvider)
        else RouteTarget(p.name, p.address, p.latE7, p.lonE7, p.naviPoi?.poiId, p.naviPoi?.poiSubId, p.naviPoi?.poiProvider)
    }

    private fun homeTarget(t: LocalTrip): RouteTarget? {
        t.overlay.home?.let { return RouteTarget(it.name, it.address, it.latE7, it.lonE7, it.poiId, it.poiSubId, it.poiProvider) }
        t.plan.home?.let { return RouteTarget(homeLabel, it.address, it.latE7, it.lonE7, null, null, null) }
        return null
    }

    /** The next step as a navigation target, with the placeRef it belongs to (null for home). */
    private fun targetOf(t: LocalTrip, step: NextStep): Pair<RouteTarget, String?>? = when (val tg = step.target) {
        null -> null
        is Target.Stop -> placeTarget(t, tg.place) to tg.place.placeRef
        is Target.Lodging -> placeTarget(t, tg.place) to tg.place.placeRef
        is Target.Final -> when (tg.endpoint) {
            is Endpoint.Home -> homeTarget(t)?.let { it to null }
            is Endpoint.AtPlace -> tg.place?.let { placeTarget(t, it) to it.placeRef }
        }
    }

    private fun stepKey(step: NextStep) = (step.target as? Target.Stop)?.visitId ?: "end"

    /**
     * Today's live view: the rest of the day re-timed from now. The navigation's remaining time counts only when it is
     * guiding to the same place as the next stop; otherwise a recent estimate from here, otherwise the plan's legs.
     */
    fun live(t: LocalTrip, day: Int, now: Long, live: NaviLive?, here: Map<String, HereEstimate>): LiveView? {
        if (todayIndex(t, now) != day) return null
        val step = NextDestination.of(t.plan, t.overlay, day)
        val target = targetOf(t, step)?.first
        val guidingThere = live?.guiding == true && target != null && (
            (live.destLatE7 != null && live.destLonE7 != null && target.latE7 != null && PlaceMatch.classify(target.latE7, target.lonE7, target.poiId, live.destLatE7, live.destLonE7, null) == Match.SAME) ||
                (t.overlay.guiding?.let { g -> g.name == live.destName && (g.visitId ?: "end") == stepKey(step) } == true)
            )
        val h = hereFor(t, day, now, here)
        val p = LiveProjection.project(t.plan, t.overlay, day, minuteOfDay(t, now), if (guidingThere) live!!.remainMinutes else null, h?.minutes)
        // A destination the car already reached (the navigation may keep it after arriving) is not "elsewhere".
        val stale = live?.destLatE7 != null && live.destLonE7 != null && t.plan.days[day - 1].visitOrder.filter { it in t.overlay.visited }.any { id ->
            val ref = t.plan.visits.first { it.visitId == id }.placeRef
            val b = t.overlay.poiBindings[ref]
            val p0 = t.plan.places.first { it.placeRef == ref }
            val lat = b?.latE7 ?: p0.latE7
            val lon = b?.lonE7 ?: p0.lonE7
            lat != null && lon != null && metres(lat, lon, live.destLatE7, live.destLonE7) <= PlaceMatch.SAME_METRES
        }
        val elsewhere = if (live?.guiding == true && !guidingThere && !stale) live.destName.ifBlank { null } else null
        return LiveView(p, elsewhere, h)
    }

    /** The latest estimate from here, if it is still about the next step and less than an hour old. */
    fun hereFor(t: LocalTrip, day: Int, now: Long, here: Map<String, HereEstimate>): HereEstimate? {
        val step = NextDestination.of(t.plan, t.overlay, day)
        return here[t.localId]?.takeIf { it.targetKey == stepKey(step) && now - it.at < 60 * 60_000 }
    }

    /** Step 11 of the flow: hand the next destination to the real navigation, only on an explicit tap while parked. */
    fun guideNext(localId: String, dayIndex: Int) {
        val t = trip(localId) ?: return
        val step = NextDestination.of(t.plan, t.overlay, dayIndex)
        val (target, placeRef) = when (step.target) {
            null -> return run { _guide.value = Guide.Failed(Msg(R.string.next_no_lodging, dayIndex.toString()), false) }
            else -> targetOf(t, step) ?: return run { _guide.value = Guide.Failed(Msg(R.string.guide_no_home), false) }
        }
        pending = Pending(localId, placeRef, target, Kind.ROUTE, dayIndex = dayIndex, visitId = (step.target as? Target.Stop)?.visitId)
        // Added by name only: no coordinates to route to, so go straight to the navigation's own search.
        if (target.latE7 == null && placeRef != null) return searchInNavi()
        viewModelScope.launch {
            _guide.value = Guide.Working(Msg(R.string.guide_checking))
            val current = navi.currentDestination()
            pending = pending?.copy(previous = current)
            if (current != null && PlaceMatch.classify(target.latE7, target.lonE7, target.poiId, current.latE7, current.lonE7, current.poiId) != Match.SAME) {
                _guide.value = Guide.ConfirmReplace(current.name, target.name)
            } else route()
        }
    }

    fun confirmReplace() = viewModelScope.launch { route() }

    private suspend fun route() {
        val p = pending ?: return
        _guide.value = Guide.Working(Msg(R.string.guide_requested, p.target.name))
        _guide.value = when (val r = navi.route(p.target, p.previous)) {
            is RouteOutcome.Confirmed -> { bind(p, r.binding, guiding = true); pending = null; Guide.Done(Msg(R.string.guide_started, r.binding.name)) }
            is RouteOutcome.Different -> Guide.ConfirmPlace(r.binding, p.target.name, p.target.latE7?.let { lat -> metres(lat, p.target.lonE7!!, r.binding.latE7, r.binding.lonE7).toInt() } ?: -1)
            RouteOutcome.NoAnswer -> Guide.Failed(Msg(R.string.guide_no_answer), canSearch = p.placeRef != null)
            is RouteOutcome.Unavailable -> Guide.Failed(Msg(r.reason), false)
        }
    }

    /** Saves the navigation's place for this stop; after a confirmed route also what the navigation is now guiding to. */
    private fun bind(p: Pending, b: NaviBinding, guiding: Boolean = false) {
        val g = if (guiding) GuidingTarget(p.dayIndex, p.visitId, p.placeRef, b.latE7, b.lonE7, b.name, nowMs()) else null
        edit(p.localId) { lt ->
            val o = lt.overlay
            val bindings = p.placeRef?.let { o.poiBindings + (it to b) } ?: o.poiBindings
            lt.copy(overlay = o.copy(poiBindings = bindings, guiding = g ?: o.guiding))
        }
    }

    /** The user accepts the place the navigation picked (it differed from the plan's coordinates). */
    fun acceptPlace() {
        val p = pending ?: return
        val g = _guide.value as? Guide.ConfirmPlace ?: return
        bind(p, g.found, guiding = p.kind == Kind.ROUTE)
        pending = null
        _guide.value = Guide.Done(Msg(if (p.kind == Kind.SEARCH) R.string.guide_bound_retry else R.string.guide_started, g.found.name))
    }

    /** Officially supported fallback: open the navigation's own search with the place name; the result is checked on return. */
    fun searchInNavi() {
        val p = pending ?: return
        val t = trip(p.localId) ?: return
        val place = t.plan.places.firstOrNull { it.placeRef == p.placeRef } ?: return
        pending = p.copy(kind = Kind.SEARCH)
        _guide.value = Guide.Working(if (p.target.latE7 == null) Msg(R.string.guide_search_name_only, place.name) else Msg(R.string.guide_search))
        navi.openSearch(PlaceMatch.keyword(place))
    }

    fun onResume() {
        _now.value = nowMs()
        navi.refreshLive()
        val p = pending ?: return
        if (p.kind == Kind.ROUTE) return
        viewModelScope.launch {
            if (p.kind == Kind.HOME) return@launch checkHome()
            val got = navi.currentDestination() ?: return@launch run { _guide.value = Guide.Failed(Msg(R.string.guide_nothing_picked), true) }
            val tLat = p.target.latE7
            val tLon = p.target.lonE7
            val d = if (tLat == null || tLon == null) -1 else metres(tLat, tLon, got.latE7, got.lonE7).toInt()
            _guide.value = when (PlaceMatch.classify(p.target.latE7, p.target.lonE7, p.target.poiId, got.latE7, got.lonE7, got.poiId)) {
                Match.SAME -> { bind(p, got); pending = null; Guide.Done(Msg(R.string.guide_bound, got.name)) }
                Match.NEAR, Match.FAR -> Guide.ConfirmPlace(got, p.target.name, d)
            }
        }
    }

    /** Uses the navigation's HOME favorite (with confirmation) when the phone did not share a home address. */
    fun loadNaviHome(localId: String) {
        pending = Pending(localId, null, RouteTarget(homeLabel, "", 0, 0, null, null, null), Kind.HOME)
        viewModelScope.launch { checkHome() }
    }

    private suspend fun checkHome() {
        val home = navi.homeBookmark()
        _guide.value = if (home != null) Guide.ConfirmHome(home) else {
            navi.openAddHome()
            Guide.Failed(Msg(R.string.guide_no_home_bookmark), false)
        }
    }

    fun acceptHome() {
        val p = pending ?: return
        val g = _guide.value as? Guide.ConfirmHome ?: return
        edit(p.localId) { it.copy(overlay = it.overlay.copy(home = g.home)) }
        pending = null
        _guide.value = Guide.Done(Msg(R.string.guide_home_linked, g.home.address.ifBlank { g.home.name }.ifBlank { bookmarkLabel }))
    }

    /**
     * "여기서 출발" (parked, on a tap): asks the navigation where the car is and how long the next leg takes from here
     * (`requestTrip`, a query that leaves any route untouched). On day 1 before the first stop the trip now starts here.
     * The estimate is saved as that leg's time only when the car stands at the leg's start (within 150 m); otherwise it
     * is shown and used for today's times without being stored.
     */
    fun departHere(localId: String, day: Int) {
        val t0 = trip(localId) ?: return
        viewModelScope.launch {
            _guide.value = Guide.Working(Msg(R.string.here_checking))
            val here = navi.currentLocation() ?: return@launch run { _guide.value = Guide.Failed(Msg(R.string.here_no_location), false) }
            val dayOne = day == 1 && t0.plan.days[0].visitOrder.none { it in t0.overlay.visited }
            val origin = NaviBinding("", "", "", here.latE7, here.lonE7, here.address, here.address)
            val t = if (dayOne) update(localId) { it.copy(overlay = it.overlay.copy(originOverride = origin)) } ?: t0 else t0
            val step = NextDestination.of(t.plan, t.overlay, day)
            val target = targetOf(t, step)?.first
            if (target?.latE7 == null) {
                reload()
                _guide.value = Guide.Done(Msg(R.string.here_set, here.address))
                return@launch
            }
            val est = navi.estimate(target) ?: return@launch run { reload(); _guide.value = Guide.Failed(Msg(R.string.estimate_failed, target.name), false) }
            val now = nowMs()
            _here.value = _here.value + (localId to HereEstimate(target.name, stepKey(step), est.minutes, est.metres, est.socAtDest, now))
            legStartingHere(t, day, here.latE7, here.lonE7)?.let { key ->
                update(localId) { it.copy(overlay = it.overlay.copy(legEstimates = it.overlay.legEstimates + (key to LegEstimate(est.minutes, est.metres, now)))) }
            }
            reload()
            val km = String.format(Locale.ROOT, "%.1f", est.metres / 1000.0)
            _guide.value = Guide.Done(
                if (est.minutes >= 60) Msg(R.string.here_estimate_hm, target.name, est.minutes / 60, est.minutes % 60, km)
                else Msg(R.string.here_estimate_m, target.name, est.minutes, km),
            )
        }
    }

    /** Key of the plan leg that starts where the car stands (the day's start, or the stop just visited), or null. */
    private fun legStartingHere(t: LocalTrip, day: Int, lat: Int, lon: Int): String? {
        val order = t.plan.days[day - 1].visitOrder
        val k = order.indices.firstOrNull { order[it] !in t.overlay.visited && order[it] !in t.overlay.skipped } ?: order.size
        val fromRef: String? = if (k == 0) LegKeys.dayStart(t.plan, t.overlay, day) else order[k - 1].takeIf { it in t.overlay.visited }?.let { id -> t.plan.visits.first { it.visitId == id }.placeRef }
        val at: Pair<Int, Int>? = when (fromRef) {
            null -> null
            LegKeys.ORIGIN -> t.overlay.originOverride?.let { it.latE7 to it.lonE7 }
            LegKeys.HOME -> (t.overlay.home?.let { it.latE7 to it.lonE7 } ?: t.plan.home?.let { it.latE7 to it.lonE7 })
            else -> t.overlay.poiBindings[fromRef]?.let { it.latE7 to it.lonE7 } ?: t.plan.places.first { it.placeRef == fromRef }.let { p -> p.latE7?.let { la -> p.lonE7?.let { lo -> la to lo } } }
        }
        if (at == null || metres(at.first, at.second, lat, lon) > PlaceMatch.SAME_METRES) return null
        return LegKeys.of(t.plan, t.overlay, day, k)
    }
}
