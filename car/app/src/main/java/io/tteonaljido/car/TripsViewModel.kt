package io.tteonaljido.car

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.tteonaljido.car.navi.NaviGateway
import io.tteonaljido.car.ui.Msg
import io.tteonaljido.car.navi.RouteOutcome
import io.tteonaljido.car.navi.RouteTarget
import io.tteonaljido.car.storage.TripRepository
import io.tteonaljido.trip.Endpoint
import io.tteonaljido.trip.LocalTrip
import io.tteonaljido.trip.Match
import io.tteonaljido.trip.NaviBinding
import io.tteonaljido.trip.NextDestination
import io.tteonaljido.trip.Place
import io.tteonaljido.trip.PlaceMatch
import io.tteonaljido.trip.Target
import io.tteonaljido.trip.metres
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId

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

/** `homeLabel`/`bookmarkLabel` are the localized words for home, used as the navigation place name and in messages. */
class TripsViewModel(private val repo: () -> TripRepository, private val navi: NaviGateway, private val homeLabel: String, private val bookmarkLabel: String) : ViewModel() {
    private val _trips = MutableStateFlow<List<LocalTrip>>(emptyList())
    val trips: StateFlow<List<LocalTrip>> = _trips
    private val _unreadable = MutableStateFlow(0)
    val unreadable: StateFlow<Int> = _unreadable
    private val _guide = MutableStateFlow<Guide>(Guide.Idle)
    val guide: StateFlow<Guide> = _guide

    private data class Pending(val localId: String, val placeRef: String?, val target: RouteTarget, val kind: Kind, val previous: NaviBinding? = null)
    private enum class Kind { ROUTE, SEARCH, HOME }
    private var pending: Pending? = null

    init { reload() }

    fun reload() {
        val loaded = repo().load()
        _trips.value = loaded.trips
        _unreadable.value = loaded.unreadable.size
    }

    fun trip(id: String) = _trips.value.firstOrNull { it.localId == id }

    fun delete(id: String) { repo().delete(id); reload() }
    fun deleteAll() { repo().deleteAll(); reload() }

    private fun update(id: String, f: (LocalTrip) -> LocalTrip) {
        val t = trip(id) ?: return
        repo().save(f(t))
        reload()
    }

    fun markVisited(id: String, visitId: String) = update(id) { it.copy(overlay = it.overlay.copy(visited = it.overlay.visited + visitId)) }
    fun dismissGuide() { _guide.value = Guide.Idle; pending = null }

    fun todayIndex(t: LocalTrip): Int? = runCatching { NextDestination.dayIndexFor(t.plan, LocalDate.now(ZoneId.of(t.plan.timezone))) }.getOrNull()

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

    /** Step 11 of the flow: hand the next destination to the real navigation, only on an explicit tap while parked. */
    fun guideNext(localId: String, dayIndex: Int) {
        val t = trip(localId) ?: return
        val step = NextDestination.of(t.plan, t.overlay, dayIndex)
        val (target, placeRef) = when (val tg = step.target) {
            null -> return run { _guide.value = Guide.Failed(Msg(R.string.next_no_lodging, dayIndex.toString()), false) }
            is Target.Stop -> placeTarget(t, tg.place) to tg.place.placeRef
            is Target.Lodging -> placeTarget(t, tg.place) to tg.place.placeRef
            is Target.Final -> when (tg.endpoint) {
                is Endpoint.Home -> (homeTarget(t) ?: return run { _guide.value = Guide.Failed(Msg(R.string.guide_no_home), false) }) to null
                is Endpoint.AtPlace -> { val place = tg.place!!; placeTarget(t, place) to place.placeRef }
            }
        }
        pending = Pending(localId, placeRef, target, Kind.ROUTE)
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
            is RouteOutcome.Confirmed -> { bind(p, r.binding); pending = null; Guide.Done(Msg(R.string.guide_started, r.binding.name)) }
            is RouteOutcome.Different -> Guide.ConfirmPlace(r.binding, p.target.name, p.target.latE7?.let { lat -> metres(lat, p.target.lonE7!!, r.binding.latE7, r.binding.lonE7).toInt() } ?: -1)
            RouteOutcome.NoAnswer -> Guide.Failed(Msg(R.string.guide_no_answer), canSearch = p.placeRef != null)
            is RouteOutcome.Unavailable -> Guide.Failed(Msg(r.reason), false)
        }
    }

    private fun bind(p: Pending, b: NaviBinding) {
        val ref = p.placeRef ?: return
        update(p.localId) { it.copy(overlay = it.overlay.copy(poiBindings = it.overlay.poiBindings + (ref to b))) }
    }

    /** The user accepts the place the navigation picked (it differed from the plan's coordinates). */
    fun acceptPlace() {
        val p = pending ?: return
        val g = _guide.value as? Guide.ConfirmPlace ?: return
        bind(p, g.found)
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
        update(p.localId) { it.copy(overlay = it.overlay.copy(home = g.home)) }
        pending = null
        _guide.value = Guide.Done(Msg(R.string.guide_home_linked, g.home.address.ifBlank { g.home.name }.ifBlank { bookmarkLabel }))
    }
}
