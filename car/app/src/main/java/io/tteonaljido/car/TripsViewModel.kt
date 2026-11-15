package io.tteonaljido.car

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.tteonaljido.car.guide.ArrivalNote
import io.tteonaljido.car.guide.GuidanceTracker
import io.tteonaljido.car.navi.NaviGateway
import io.tteonaljido.car.navi.NaviLive
import io.tteonaljido.car.navi.NaviStatus
import io.tteonaljido.car.navi.RouteOutcome
import io.tteonaljido.car.navi.RouteTarget
import io.tteonaljido.car.storage.TripRepository
import io.tteonaljido.car.ui.Msg
import io.tteonaljido.trip.Basis
import io.tteonaljido.trip.DeadlineKind
import io.tteonaljido.trip.DepartureCheck
import io.tteonaljido.trip.DepartureReport
import io.tteonaljido.trip.DriveSession
import io.tteonaljido.trip.DriveSessions
import io.tteonaljido.trip.DayStart
import io.tteonaljido.trip.Endpoint
import io.tteonaljido.trip.originFor
import io.tteonaljido.trip.GuidingTarget
import io.tteonaljido.trip.LegEstimate
import io.tteonaljido.trip.LegKeys
import io.tteonaljido.trip.NaviMeasure
import io.tteonaljido.trip.RouteOptimizer
import io.tteonaljido.car.navi.MeasureOutcome
import io.tteonaljido.trip.LiveProjection
import io.tteonaljido.trip.LocalTrip
import io.tteonaljido.trip.Match
import io.tteonaljido.trip.NaviBinding
import io.tteonaljido.trip.NextDestination
import io.tteonaljido.trip.TripValidator
import io.tteonaljido.trip.NextStep
import io.tteonaljido.trip.Place
import io.tteonaljido.trip.PlaceMatch
import io.tteonaljido.trip.Projection
import io.tteonaljido.trip.Punctuality
import io.tteonaljido.trip.RestAdvice
import io.tteonaljido.trip.RestAdvisor
import io.tteonaljido.trip.Target
import io.tteonaljido.trip.Visit
import io.tteonaljido.trip.TodayRoute
import io.tteonaljido.trip.VehicleKind
import io.tteonaljido.trip.VehicleSnapshot
import io.tteonaljido.trip.VisitHow
import io.tteonaljido.trip.VisitStamp
import io.tteonaljido.trip.metres
import io.tteonaljido.trip.zoneOrUtc
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
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
    /** Before a stop with a booking or a fixed time is skipped: it is named with its time, and nothing changes until the driver agrees. */
    data class ConfirmSkip(val name: String, val time: String, val booked: Boolean) : Guide
    /**
     * Before a measurement: the navigation comes to the front and shows `routes` routes one after another, and a
     * route it is guiding on (`current`) ends. Nothing is sent until the driver agrees.
     */
    data class ConfirmMeasure(val current: String?, val routes: Int) : Guide
    /** A measurement is running; closing it stops the measurement and clears the measuring route. */
    data class Measuring(val msg: Msg) : Guide
    /** A measurement that gave nothing, or an order that cannot be compared: said under its own title, not as failed guidance. */
    data class MeasureFailed(val msg: Msg) : Guide
    data class Done(val msg: Msg) : Guide
    data class Failed(val msg: Msg, val canSearch: Boolean) : Guide
}

/**
 * What '오늘 경로 전송' tells the driver once the navigation has answered: sent only when it settled on the last stop
 * (same POI or within 150 m); a route it settled somewhere else is named, never reported as sent.
 */
internal fun todayRouteGuide(r: RouteOutcome, stops: Int, acceptedWaypoints: Int? = null): Guide = when (r) {
    // The navigation's own waypoint list is the proof: fewer than sent is said, not hidden behind "sent".
    is RouteOutcome.Confirmed -> if (acceptedWaypoints != null && acceptedWaypoints < stops - 1) Guide.Done(Msg(R.string.guide_today_partial, stops.toString(), (acceptedWaypoints + 1).toString()))
    else Guide.Done(Msg(R.string.guide_today_done, stops.toString()))
    is RouteOutcome.Different -> Guide.Failed(Msg(R.string.live_navi_elsewhere, r.binding.name), false)
    RouteOutcome.NoAnswer -> Guide.Failed(Msg(R.string.guide_no_answer), false)
    is RouteOutcome.Unavailable -> Guide.Failed(Msg(r.reason), false)
}

/** A one-off `requestTrip` answer from where the car stood, kept for the screen (and the projection) for an hour. */
data class HereEstimate(val target: String, val targetKey: String, val minutes: Int, val metres: Int, val socAtDest: Int?, val at: Long)

/** The live view of today: the projection plus what the navigation is doing. `naviRemainMinutes` is the navigation's time to the next stop, when it is driving there. */
data class LiveView(val projection: Projection, val naviElsewhere: String?, val here: HereEstimate?, val naviRemainMinutes: Int? = null, val naviRemainMetres: Int? = null)

/** The car's current energy reading for charge/refuel advice (SOC for EV/PHEV, fuel % for ICE). Phase-1: demo-seeded; phase-2: from the Vehicle SDK. */
data class EnergyState(val kind: VehicleKind, val percent: Int?, val rangeKm: Int?)

/**
 * `homeLabel`/`bookmarkLabel` are the localized words for home, used as the navigation place name and in messages.
 * `update` is the app's single write path; `nowMs` is the app clock (shifted only by the emulator demo clock).
 */
class TripsViewModel(
    private val repo: () -> TripRepository,
    private val update: (String, (LocalTrip) -> LocalTrip) -> LocalTrip?,
    private val deleteOne: (String) -> Unit,
    private val deleteEvery: () -> Unit,
    private val navi: NaviGateway,
    private val tracker: GuidanceTracker,
    private val nowMs: () -> Long,
    clockOffset: StateFlow<Long>,
    private val homeLabel: String,
    private val bookmarkLabel: String,
    /** Real-car energy reading (Vehicle SDK adapter); null off-car (emulator demo seed drives it instead). */
    private val energyReader: (suspend () -> EnergyState?)? = null,
    /** Real-car vehicle snapshot (warning lamps, doors, seats, gear, …); null off-car. */
    private val snapshotReader: (suspend () -> VehicleSnapshot?)? = null,
    /** App-scoped continuous-driving stretch (owned by the Container so it outlives screens). */
    private val driveSession: MutableStateFlow<DriveSession> = MutableStateFlow(DriveSession()),
    private val isDriving: () -> Boolean = { false },
    private val noteOdometer: (Double?) -> Unit = {},
    /** on while the navigation measures legs — it comes to the front, and an app behind it is frozen unless this holds it. */
    private val keepRunning: (Boolean) -> Unit = {},
    /** Asks for this app's screen back after a measurement (the system may decline). */
    private val toFront: () -> Unit = {},
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
    /** Current energy reading driving charge/refuel advice. Null = unknown (no advisory). Phase-1 demo-seeded; phase-2 from the Vehicle SDK. */
    private val _energy = MutableStateFlow<EnergyState?>(null)
    val energy: StateFlow<EnergyState?> = _energy
    /** Latest read-only vehicle snapshot. Null = nothing reported (no departure check, no lamp-based advice). */
    private val _vehicle = MutableStateFlow<VehicleSnapshot?>(null)
    val vehicle: StateFlow<VehicleSnapshot?> = _vehicle
    val drive: StateFlow<DriveSession> = driveSession
    val naviStatus: StateFlow<NaviStatus> = navi.status
    private val _resumed = MutableStateFlow(0)
    /** Counts returns to the foreground, so a screen can look again at what may have changed while the app was away. */
    val resumed: StateFlow<Int> = _resumed
    /** Trips whose automatic first-leg measurement the driver undid: left alone for the rest of this session. */
    private val autoOff = mutableSetOf<String>()
    private var autoJob: Job? = null
    /** the running measurement with the navigation, what it was asked to do, and how many waypoints this navigation has kept per route. */
    private var measureJob: Job? = null
    private var measureAsk: Pair<String, Int?>? = null
    private var naviWaypoints = NaviMeasure.MAX_WAYPOINTS
    /** A measurement gives up after this long (the platform allows a short foreground service about three minutes). */
    private val MEASURE_BUDGET_MS = 150_000L

    private data class Pending(val localId: String, val placeRef: String?, val target: RouteTarget, val kind: Kind, val previous: NaviBinding? = null, val dayIndex: Int = 0, val visitId: String? = null)
    private enum class Kind { ROUTE, SEARCH, HOME }
    private var pending: Pending? = null

    @Volatile private var visible = true
    @Volatile private var seededEnergy = false
    @Volatile private var seededVehicle = false
    fun setVisible(v: Boolean) { visible = v }

    init {
        reload()
        viewModelScope.launch { tracker.changed.collect { reload() } }
        viewModelScope.launch { clockOffset.collect { _now.value = nowMs() } }
        viewModelScope.launch {
            while (true) {
                delay(30_000)
                if (!visible) continue // no polling while the app is in the background
                _now.value = nowMs()
                // Push events cover route start/stop; while guiding, refresh the remaining time as a fallback.
                if (navi.live.value?.guiding == true) navi.refreshLive()
            }
        }
        // Real-car only: poll the Vehicle SDK for energy (SOC/fuel/range) to drive charge/refuel advice. Off-car this is
        // null, so the emulator demo seed is left untouched.
        energyReader?.let { reader ->
            viewModelScope.launch {
                while (true) {
                    // A demo seed stays until demo mode is left: the Pleos emulator is automotive too, and a real reading would replace it.
                    if (visible && !seededEnergy) runCatching { setEnergy(reader()) }
                    delay(60_000)
                }
            }
        }
        // Same cadence for the vehicle snapshot. Its odometer also tells the drive session how far this stretch has gone.
        snapshotReader?.let { reader ->
            viewModelScope.launch {
                while (true) {
                    if (visible && !seededVehicle) refreshVehicle(reader)
                    // Parked, the departure check should follow the cabin (a belt just fastened); while driving a slow poll is enough.
                    delay(if (isDriving()) 60_000 else 20_000)
                }
            }
        }
    }

    private suspend fun refreshVehicle(reader: suspend () -> VehicleSnapshot?) {
        val s = runCatching { reader() }.getOrNull()
        _vehicle.value = s
        noteOdometer(s?.odometerKm)
    }

    fun reload() {
        val loaded = repo().load()
        _trips.value = loaded.trips
        _unreadable.value = loaded.unreadable.size
    }

    fun trip(id: String) = _trips.value.firstOrNull { it.localId == id }

    fun delete(id: String) { deleteOne(id); reload() }
    fun deleteAll() { deleteEvery(); reload() }

    private fun edit(id: String, f: (LocalTrip) -> LocalTrip) {
        update(id, f)
        reload()
    }

    fun markVisited(id: String, visitId: String) = edit(id) {
        val o = it.overlay
        // A stop marked by hand is no longer what the navigation's arrival event should match.
        it.copy(overlay = o.copy(visited = o.visited + visitId, visitedAt = o.visitedAt + (visitId to VisitStamp(nowMs(), VisitHow.MANUAL)), guiding = o.guiding?.takeIf { g -> g.visitId != visitId }))
    }

    fun undoVisited(id: String, visitId: String) {
        edit(id) { it.copy(overlay = it.overlay.copy(visited = it.overlay.visited - visitId, visitedAt = it.overlay.visitedAt - visitId)) }
        if (tracker.lastArrival.value?.visitId == visitId) tracker.dismiss()
    }

    fun skip(id: String, visitId: String) = edit(id) { it.copy(overlay = it.overlay.copy(skipped = it.overlay.skipped + visitId, guiding = it.overlay.guiding?.takeIf { g -> g.visitId != visitId })) }
    fun unskip(id: String, visitId: String) = edit(id) { it.copy(overlay = it.overlay.copy(skipped = it.overlay.skipped - visitId)) }

    /** The stop a skip is being asked about (trip, visit), while its popup is open. */
    private var skipAsk: Pair<String, String>? = null

    /** 이 장소 건너뛰기: straight away for an ordinary stop (it can be put back); a booking or a fixed time is asked about first. */
    fun requestSkip(localId: String, visitId: String) {
        val t = trip(localId) ?: return
        val v = t.view.visits.firstOrNull { it.visitId == visitId } ?: return
        val fixed = v.fixed ?: return skip(localId, visitId)
        skipAsk = localId to visitId
        _guide.value = Guide.ConfirmSkip(TripValidator.placeName(t.view, v.placeRef), fixed.time, fixed.kind == Visit.Fixed.Kind.RESERVATION)
    }

    fun confirmSkip() {
        val (localId, visitId) = skipAsk ?: return
        skipAsk = null
        _guide.value = Guide.Idle
        skip(localId, visitId)
    }
    /** Move an optional stop to later today (tail of the day); the plan is unchanged. If the car was guiding to it, that binding is cleared. */
    fun defer(id: String, visitId: String) = edit(id) { it.copy(overlay = it.overlay.copy(deferred = it.overlay.deferred + visitId, guiding = it.overlay.guiding?.takeIf { g -> g.visitId != visitId })) }
    fun undefer(id: String, visitId: String) = edit(id) { it.copy(overlay = it.overlay.copy(deferred = it.overlay.deferred - visitId)) }
    /** Move a stop to another day (visitId → target dayIndex); the plan is unchanged. Clears any same-day defer and a guiding binding to it. */
    fun deferToDay(id: String, visitId: String, day: Int) = edit(id) { it.copy(overlay = it.overlay.copy(deferredTo = it.overlay.deferredTo + (visitId to day), deferred = it.overlay.deferred - visitId, guiding = it.overlay.guiding?.takeIf { g -> g.visitId != visitId })) }
    fun undeferDay(id: String, visitId: String) = edit(id) { it.copy(overlay = it.overlay.copy(deferredTo = it.overlay.deferredTo - visitId)) }
    /** Emulator demo only: set a sample energy reading so the charge/refuel advisory is visible without real signals. */
    fun seedDemoEnergy(kind: VehicleKind, percent: Int?, rangeKm: Int?) { seededEnergy = true; _energy.value = EnergyState(kind, percent, rangeKm) }
    /** Phase-2 entry point: the Vehicle SDK adapter pushes real energy readings here (same shape as the demo seed). */
    fun setEnergy(state: EnergyState?) { _energy.value = state }
    /** Emulator demo only: a sample vehicle snapshot so the departure check is visible without real signals (null clears it). */
    fun seedDemoVehicle(s: VehicleSnapshot?) { seededVehicle = s != null; _vehicle.value = s }
    /** Emulator demo only: pretend this stretch of driving began `minutes` ago, so the rest advice is visible. */
    fun seedDemoDrive(minutes: Int) { driveSession.value = DriveSession(since = nowMs() - minutes * 60_000L) }

    fun dismissArrival() = tracker.dismiss()
    fun dismissGuide() {
        _guide.value = Guide.Idle
        pending = null
        measureAsk = null
        skipAsk = null
        // Closing the progress popup stops the measurement; the job itself clears its measuring route on the way out.
        measureJob?.takeIf { it.isActive }?.cancel()
    }
    fun openChargers() = navi.openNearbyChargers()
    /** ICE refuel: open the navigation's own station search (which shows the OEM fuel prices), near the route. */
    fun openFuelSearch() = navi.openSearch("주유소")
    /** Rest advice → the navigation's own search for rest areas near the route (parked only, like every screen request). */
    fun openRestAreas() = navi.openSearch("휴게소")

    /**
     * 출발 전 점검: the vehicle snapshot and the driving range against today's remaining route. Only for today (the
     * live view exists) — the car's state now says nothing about another day.
     */
    fun departure(live: LiveView?): DepartureReport? {
        live ?: return null
        return DepartureCheck.evaluate(_vehicle.value, _energy.value?.rangeKm, live.projection.remainKm)
    }

    /**
     * 쉬어 가기 권고: the continuous-driving stretch, with the navigation's time to the next stop, a rest area on the
     * route, and the spare minutes before the next fixed time.
     */
    fun rest(now: Long, live: LiveView?, naviLive: NaviLive?, session: DriveSession = driveSession.value): RestAdvice? {
        val s = DriveSessions.step(session, isDriving(), now)
        val p = live?.projection
        val slack = p?.deadlineSlack?.takeIf { p.deadlineKind != DeadlineKind.NONE }
        val restArea = naviLive?.restAreaMetres?.takeIf { naviLive.guiding }
        return RestAdvisor.advise(s, now, live?.naviRemainMinutes, slack, restArea)
    }

    fun today(t: LocalTrip, now: Long = _now.value): LocalDate = Instant.ofEpochMilli(now).atZone(t.view.zoneOrUtc()).toLocalDate()
    /** Which day of the trip "now" falls on. A 4-hour grace keeps it on the current day just past midnight (still driving to that night's lodging). */
    fun todayIndex(t: LocalTrip, now: Long = _now.value): Int? = moment(t, now)?.dayIndex
    /** That day and the minute counted from its midnight (past 1440 in the grace hours), so the live view compares like with like. */
    private fun moment(t: LocalTrip, now: Long) = runCatching { NextDestination.momentOf(t.view, now) }.getOrNull()

    private fun placeTarget(t: LocalTrip, p: Place): RouteTarget {
        val b = t.overlay.poiBindings[p.placeRef]
        return if (b != null) RouteTarget(b.name, b.address, b.latE7, b.lonE7, b.poiId, b.poiSubId, b.poiProvider)
        else RouteTarget(p.name, p.address, p.latE7, p.lonE7, p.naviPoi?.poiId, p.naviPoi?.poiSubId, p.naviPoi?.poiProvider)
    }

    private fun homeTarget(t: LocalTrip): RouteTarget? {
        t.overlay.home?.let { return RouteTarget(it.name, it.address, it.latE7, it.lonE7, it.poiId, it.poiSubId, it.poiProvider) }
        t.view.home?.let { return RouteTarget(homeLabel, it.address, it.latE7, it.lonE7, null, null, null) }
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
            is Endpoint.Current -> null // never a place to return to (the parser rejects it)
        }
    }

    private fun stepKey(step: NextStep) = (step.target as? Target.Stop)?.visitId ?: "end"
    private fun stepKey(day: Int, step: NextStep) = "$day:${stepKey(step)}"
    /** A 'from here' estimate is about this exact next step and only trusted for a short while. */
    private val HERE_TTL_MS = 15 * 60_000L
    private val FAST_ROUTE_WHEN = setOf(Punctuality.TIGHT, Punctuality.LATE)

    /**
     * Today's live view: the rest of the day re-timed from now. The navigation's remaining time counts only when it is
     * guiding to the same place as the next stop; otherwise a recent estimate from here, otherwise the plan's legs.
     */
    fun live(t: LocalTrip, day: Int, now: Long, live: NaviLive?, here: Map<String, HereEstimate>): LiveView? {
        val moment = moment(t, now)?.takeIf { it.dayIndex == day } ?: return null
        val step = NextDestination.of(t.view, t.overlay, day)
        val target = targetOf(t, step)?.first
        val guidingThere = live?.guiding == true && target != null && (
            (live.destLatE7 != null && live.destLonE7 != null && target.latE7 != null && PlaceMatch.classify(target.latE7, target.lonE7, target.poiId, live.destLatE7, live.destLonE7, null) == Match.SAME) ||
                (t.overlay.guiding?.let { g -> g.name == live.destName && (g.visitId ?: "end") == stepKey(step) } == true)
            )
        // '오늘 경로 전송': the navigation heads for the route's last stop, so the next stop's time is its first waypoint's.
        val onSentRoute = live?.guiding == true && TodayRoute.onRoute(t.overlay, live.destName, live.destLatE7, live.destLonE7)
        val viaLeg = if (onSentRoute && !guidingThere) TodayRoute.nextLeg(
            t.overlay, stepKey(step), live!!.destLatE7, live.destLonE7, TodayRoute.Waypoint(live.destName, live.remainSeconds, live.remainMetres),
            live.waypoints.map { TodayRoute.Waypoint(it.name, it.remainSeconds, it.remainMetres) },
        ) else null
        val viaWaypoint = viaLeg?.remainSeconds?.let { (it + 59) / 60 }
        val h = hereFor(t, day, now, here)
        // The navigation's remaining time is only trusted while it is fresh (it slides later each tick once pushes stop).
        val fresh = live != null && System.currentTimeMillis() - live.at < 120_000L
        val naviRemain = if (fresh) (if (guidingThere) live!!.remainMinutes else viaWaypoint) else null
        val e = _energy.value
        val p = LiveProjection.project(
            t.view, t.overlay, day, moment.minute,
            naviRemain, h?.minutes,
            vehicleKind = e?.kind ?: VehicleKind.UNKNOWN, energyPercent = e?.percent, rangeKm = e?.rangeKm,
            naviSocAtNext = h?.socAtDest, nextLegMetres = h?.metres, driveMode = _vehicle.value?.driveMode,
        )
        // A destination the car already reached (the navigation may keep it after arriving) is not "elsewhere".
        val stale = live?.destLatE7 != null && live.destLonE7 != null && t.view.days[day - 1].visitOrder.filter { it in t.overlay.visited }.any { id ->
            val ref = t.view.visits.first { it.visitId == id }.placeRef
            val b = t.overlay.poiBindings[ref]
            val p0 = t.view.places.first { it.placeRef == ref }
            val lat = b?.latE7 ?: p0.latE7
            val lon = b?.lonE7 ?: p0.lonE7
            lat != null && lon != null && metres(lat, lon, live.destLatE7, live.destLonE7) <= PlaceMatch.SAME_METRES
        }
        // Following the route this app sent is not "elsewhere", even though its destination is a later stop.
        val elsewhere = if (live?.guiding == true && !guidingThere && !onSentRoute && !stale) live.destName.ifBlank { null } else null
        val onLive = p.basis == Basis.NAVI_LIVE
        return LiveView(p, elsewhere, h, naviRemain.takeIf { onLive }, (if (guidingThere) live?.remainMetres else viaLeg?.remainMetres).takeIf { onLive })
    }

    /** The latest estimate from here, if it is still about the next step and less than an hour old. */
    fun hereFor(t: LocalTrip, day: Int, now: Long, here: Map<String, HereEstimate>): HereEstimate? {
        val step = NextDestination.of(t.view, t.overlay, day)
        return here[t.localId]?.takeIf { it.targetKey == stepKey(day, step) && now - it.at < HERE_TTL_MS }
    }

    /** Step 11 of the flow: hand the next destination to the real navigation, only on an explicit tap while parked. */
    fun guideNext(localId: String, dayIndex: Int) {
        val t = trip(localId) ?: return
        val step = NextDestination.of(t.view, t.overlay, dayIndex)
        val (target, placeRef) = when (step.target) {
            null -> return run { _guide.value = Guide.Failed(Msg(R.string.next_no_lodging, dayIndex.toString()), false) }
            else -> targetOf(t, step) ?: return run { _guide.value = Guide.Failed(Msg(R.string.guide_no_home), false) }
        }
        pending = Pending(localId, placeRef, target, Kind.ROUTE, dayIndex = dayIndex, visitId = (step.target as? Target.Stop)?.visitId)
        handToNavi(target, placeRef)
    }

    /**
     * 숙소로 길안내: straight to where the day ends (that night's lodging, or home on the last day), on an explicit tap
     * while parked. The stops still ahead are left as they are — skipping them is a separate, one-by-one choice.
     */
    fun guideDayEnd(localId: String, dayIndex: Int) {
        val t = trip(localId) ?: return
        val end = NextDestination.endOf(t.view, dayIndex) ?: return run { _guide.value = Guide.Failed(Msg(R.string.next_no_lodging, dayIndex.toString()), false) }
        val (target, placeRef) = targetOf(t, NextStep(dayIndex, end, "")) ?: return run { _guide.value = Guide.Failed(Msg(R.string.guide_no_home), false) }
        pending = Pending(localId, placeRef, target, Kind.ROUTE, dayIndex = dayIndex, visitId = null)
        handToNavi(target, placeRef)
    }

    /** The pending target goes to the navigation: by search when it has no coordinates, after asking when another route is running. */
    private fun handToNavi(target: RouteTarget, placeRef: String?) {
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

    /**
     * Load today's remaining route (every stop still ahead that has coordinates, up to ten) into the navigation in one request —
     * the planned route "sent" to the nav. Parked, explicit tap only. It does not touch arrival tracking or the live
     * projection; the per-stop '다음 목적지 안내' stays for precise ETA and auto-arrival. Fewer than two routable stops
     * fall back to the single-stop flow.
     */
    fun guideToday(localId: String, dayIndex: Int) {
        val t = trip(localId) ?: return
        val stops = NextDestination.upcoming(t.view, t.overlay, dayIndex).mapNotNull { id ->
            val v = t.view.visits.first { it.visitId == id }
            val p = t.view.places.first { it.placeRef == v.placeRef }
            if (p.latE7 == null) null else Triple(id, p.placeRef, placeTarget(t, p))
        }.take(NaviMeasure.MAX_WAYPOINTS + 1)
        val targets = stops.map { it.third }
        if (targets.size < 2) return guideNext(localId, dayIndex)
        val dest = targets.last()
        val waypoints = targets.dropLast(1)
        viewModelScope.launch {
            _guide.value = Guide.Working(Msg(R.string.guide_today_working, targets.size.toString()))
            // What the navigation was guiding to before, so its unchanged old route is not taken for the answer.
            val previous = navi.currentDestination()
            val r = navi.routeTrip(dest, waypoints, previous)
            var accepted: Int? = null
            if (r is RouteOutcome.Confirmed) {
                accepted = navi.waypointCount()
                // Remember the stops in driving order: a waypoint arrival then marks its stop, and the waypoint's
                // remaining time feeds 시간 지킴이. The last one is the navigation's destination (its confirmed name).
                val at = nowMs()
                val sent = stops.mapIndexed { i, (visitId, placeRef, tg) ->
                    val last = i == stops.lastIndex
                    GuidingTarget(dayIndex, visitId, placeRef, if (last) r.binding.latE7 else tg.latE7!!, if (last) r.binding.lonE7 else tg.lonE7!!, if (last) r.binding.name else tg.name, at)
                }
                edit(localId) { it.copy(overlay = it.overlay.copy(guiding = sent.last(), guidingStops = sent)) }
            }
            _guide.value = todayRouteGuide(r, targets.size, accepted)
        }
    }

    fun confirmReplace() = viewModelScope.launch { route() }

    private suspend fun route() {
        val p = pending ?: return
        _guide.value = Guide.Working(Msg(R.string.guide_requested, p.target.name))
        // 시간 지킴이 × route option: when the next fixed time is tight or already late, ask for the shortest-time route.
        val fastest = trip(p.localId)?.let { live(it, p.dayIndex, _now.value, navi.live.value, _here.value)?.projection?.status } in FAST_ROUTE_WHEN
        val r = navi.route(p.target, p.previous, fastest)
        if (pending !== p) return // the user closed the dialog (or started another) while the navigation was answering
        _guide.value = when (r) {
            is RouteOutcome.Confirmed -> { bind(p, r.binding, guiding = true); pending = null; Guide.Done(Msg(if (fastest) R.string.guide_started_fast else R.string.guide_started, r.binding.name)) }
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
            // A single-stop route replaces whatever multi-stop route was sent before.
            lt.copy(overlay = o.copy(poiBindings = bindings, guiding = g ?: o.guiding, guidingStops = if (g != null) emptyList() else o.guidingStops))
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
        val place = t.view.places.firstOrNull { it.placeRef == p.placeRef } ?: return
        pending = p.copy(kind = Kind.SEARCH)
        _guide.value = Guide.Working(if (p.target.latE7 == null) Msg(R.string.guide_search_name_only, place.name) else Msg(R.string.guide_search))
        navi.openSearch(PlaceMatch.keyword(place))
    }

    fun onResume() {
        _now.value = nowMs()
        _resumed.value += 1
        navi.refreshLive()
        // Back in front (e.g. after getting in the car): read the vehicle again right away, not at the next poll.
        snapshotReader?.let { r -> if (!seededVehicle) viewModelScope.launch { refreshVehicle(r) } }
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
        _guide.value = if (home != null) {
            Guide.ConfirmHome(home)
        } else {
            navi.openAddHome()
            pending = null // the user adds a home there and taps "내비 '집' 불러오기" again; don't reopen it on every resume
            Guide.Failed(Msg(R.string.guide_no_home_bookmark), false)
        }
    }

    fun acceptHome() {
        val p = pending ?: return
        val g = _guide.value as? Guide.ConfirmHome ?: return
        edit(p.localId) { it.copy(overlay = it.overlay.copy(home = g.home)) }
        pending = null
        _guide.value = Guide.Done(Msg(R.string.guide_home_linked, g.home.address.ifBlank { g.home.name }.ifBlank { bookmarkLabel }))
        measureFirstLeg(p.localId) // standing at home? then the first leg is asked from home, and a pin of ours goes
    }

    /**
     * "여기서 출발" (parked, on a tap): asks the navigation where the car is and how long the next leg takes from here
     * (`requestTrip`, a query that leaves any route untouched). On day 1 before the first stop the trip now starts here;
     * a later day still starts from the lodging of the night before ([DayStart]).
     * The estimate is saved as that leg's time only when the car stands at the leg's start (within 150 m); otherwise it
     * is shown and used for today's times without being stored.
     */
    fun departHere(localId: String, day: Int) {
        val t0 = trip(localId) ?: return
        viewModelScope.launch {
            _guide.value = Guide.Working(Msg(R.string.here_checking))
            val here = navi.currentLocation() ?: return@launch run { _guide.value = Guide.Failed(Msg(R.string.here_no_location), false) }
            // Re-setting the day's start point only makes sense before any of that day's stops are done — and only where
            // the plan leaves the start open: the first day, or a day after a night with no lodging. A later day
            // keeps starting from the lodging of the night before; there this only asks for the estimate from here.
            val fresh = DayStart.canDepartHere(t0.view, day) && t0.view.days[day - 1].visitOrder.none { it in t0.overlay.visited }
            val origin = NaviBinding("", "", "", here.latE7, here.lonE7, here.address, here.address)
            val t = if (fresh) update(localId) { it.copy(overlay = it.overlay.copy(originOverrides = it.overlay.originOverrides + (day to origin), originPinnedAuto = if (day == 1) false else it.overlay.originPinnedAuto)) } ?: t0 else t0
            val step = NextDestination.of(t.view, t.overlay, day)
            val target = targetOf(t, step)?.first
            if (target?.latE7 == null) {
                reload()
                _guide.value = Guide.Done(Msg(R.string.here_set, here.address))
                return@launch
            }
            val est = navi.estimate(target) ?: return@launch run { reload(); _guide.value = Guide.Failed(Msg(R.string.estimate_failed, target.name), false) }
            val now = nowMs()
            _here.value = _here.value + (localId to HereEstimate(target.name, stepKey(day, step), est.minutes, est.metres, est.socAtDest, now))
            LegKeys.startingAt(t.view, t.overlay, day, here.latE7, here.lonE7)?.let { key ->
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

    /** Undo "여기서 출발": the day starts from the plan again, and its from-here estimate is dropped. */
    fun undoDepartHere(localId: String, day: Int) {
        val t = trip(localId) ?: return
        if (t.overlay.originFor(t.view, day) == null) return
        // The leg key is "@origin>…" only while the override is still active, so read it before clearing.
        val key = LegKeys.of(t.view, t.overlay, day, 0)
        update(localId) {
            it.copy(overlay = it.overlay.copy(
                originOverrides = it.overlay.originOverrides - day,
                originOverride = if (day == 1) null else it.overlay.originOverride,
                originPinnedAuto = if (day == 1) false else it.overlay.originPinnedAuto,
                legEstimates = if (key != null) it.overlay.legEstimates - key else it.overlay.legEstimates,
            ))
        }
        _here.value = _here.value - localId
        if (day == 1) autoOff += localId // the driver put the start back: do not pin it again behind their back
        reload()
        _guide.value = Guide.Done(Msg(R.string.here_reset))
    }

    /**
     * The first day's first leg, without a tap. The phone cannot time a leg that starts "where the car is", nor
     * one from a home it has no address for, so the leg arrives empty and the whole first day reads as unknown. While
     * parked, before the trip or on its first day, the car asks the navigation where it is and how long the first stop
     * takes from there (`requestTrip`: a query, any route is untouched) and keeps that as the leg's time.
     * Standing at the plan's own start (home, a place) the leg stays the plan's. Anywhere else — or when the plan names
     * no place — the day's start is pinned to the car, as "여기서 출발" would, and follows it until the day begins: it is
     * asked again when the car has moved or the estimate is old ([DayStart]). A start the driver set by hand is left alone.
     */
    fun measureFirstLeg(localId: String) {
        val t0 = trip(localId) ?: return
        if (localId in autoOff || autoJob?.isActive == true || measureJob?.isActive == true) return
        if (today(t0).isAfter(LocalDate.parse(t0.view.startDate))) return // the first day is behind us
        if (!DayStart.untimed(t0.view, t0.overlay)) return
        if (t0.overlay.originFor(t0.view, 1) != null && !t0.overlay.originPinnedAuto) return
        autoJob = viewModelScope.launch {
            val here = navi.currentLocation() ?: return@launch
            var t = trip(localId) ?: return@launch
            if (!DayStart.untimed(t.view, t.overlay)) return@launch
            if (DayStart.atPlanStart(t.view, t.overlay, here.latE7, here.lonE7)) {
                // At the plan's own start: a pin of ours goes, and the leg is asked as the plan has it.
                if (t.overlay.originPinnedAuto) {
                    val pinnedKey = LegKeys.of(t.view, t.overlay, 1, 0)
                    t = update(localId) {
                        val o = it.overlay
                        it.copy(overlay = o.copy(originOverrides = o.originOverrides - 1, originOverride = null, originPinnedAuto = false, legEstimates = if (pinnedKey != null) o.legEstimates - pinnedKey else o.legEstimates))
                    } ?: return@launch
                }
                if (DayStart.estimateFresh(t.view, t.overlay, nowMs())) return@launch run { reload() }
            } else {
                if (!DayStart.needsMeasure(t.view, t.overlay, here.latE7, here.lonE7, nowMs())) return@launch
                val origin = NaviBinding("", "", "", here.latE7, here.lonE7, here.address, here.address)
                t = update(localId) { it.copy(overlay = it.overlay.copy(originOverrides = it.overlay.originOverrides + (1 to origin), originPinnedAuto = true)) } ?: return@launch
            }
            // Kept only when the car stands at the leg's start — which is where it now is, either way.
            val key = LegKeys.startingAt(t.view, t.overlay, 1, here.latE7, here.lonE7)
            val step = NextDestination.of(t.view, t.overlay, 1)
            val target = targetOf(t, step)?.first
            if (key != null && target?.latE7 != null) {
                navi.estimate(target)?.let { est ->
                    val now = nowMs()
                    update(localId) { it.copy(overlay = it.overlay.copy(legEstimates = it.overlay.legEstimates + (key to LegEstimate(est.minutes, est.metres, now)))) }
                    if (todayIndex(t) == 1) _here.value = _here.value + (localId to HereEstimate(target.name, stepKey(1, step), est.minutes, est.metres, est.socAtDest, now))
                }
            }
            reload()
        }
    }

    /* ---------- the Hyundai navigation times, measures and orders the trip ---------- */

    private fun pointTarget(t: LocalTrip, p: NaviMeasure.Point): RouteTarget = when (p.key) {
        LegKeys.HOME -> (homeTarget(t) ?: RouteTarget(homeLabel, "", null, null, null, null, null)).copy(latE7 = p.latE7, lonE7 = p.lonE7)
        LegKeys.ORIGIN -> RouteTarget(t.overlay.originOverrides.values.firstOrNull { it.latE7 == p.latE7 && it.lonE7 == p.lonE7 }?.name?.ifBlank { null } ?: "·", "", p.latE7, p.lonE7, null, null, null)
        else -> t.view.places.firstOrNull { it.placeRef == p.key }?.let { placeTarget(t, it) }?.copy(latE7 = p.latE7, lonE7 = p.lonE7) ?: RouteTarget(p.key, "", p.latE7, p.lonE7, null, null, null)
    }

    /** [전 구간 내비로 측정]: every leg of the trip from today on, in the order the car follows. */
    fun measureTrip(localId: String) = askMeasure(localId, null)

    /** [N일차 순서 최적화]: every leg some order of that day's stops could use; the screen then shows the fastest order. */
    fun measureDay(localId: String, day: Int) = askMeasure(localId, day)

    /** The legs a measurement would ask for: the trip's legs from today on, or what is still missing of one day's matrix. */
    private fun wantedLegs(t: LocalTrip, matrixDay: Int?): List<NaviMeasure.Edge> =
        if (matrixDay != null) {
            // Legs read off a route a moment ago are not asked again: only the rest of the day's matrix.
            val fresh = nowMs() - DayStart.FRESH_MS
            NaviMeasure.dayMatrix(t.view, t.overlay, matrixDay).filter { e -> t.overlay.legEstimates[e.key]?.let { it.source == NaviMeasure.SOURCE && it.at >= fresh } != true }
        } else NaviMeasure.tripLegs(t.view, t.overlay, todayIndex(t) ?: 1)

    /**
     * A tap on a measuring button: says what is about to happen and waits for a yes. Measuring is not a query — each
     * route really starts in the navigation, which comes to the front for it, and a route it was guiding on ends.
     */
    private fun askMeasure(localId: String, matrixDay: Int?) {
        val t = trip(localId) ?: return
        if (measureJob?.isActive == true || isDriving()) return
        if (navi.status.value != NaviStatus.CONNECTED) return run { _guide.value = Guide.Failed(Msg(R.string.navi_not_connected), false) }
        val wanted = wantedLegs(t, matrixDay)
        val routes = NaviMeasure.chains(wanted, naviWaypoints).size
        if (routes == 0) {
            // Nothing to drive: legs between two ends on one spot are zero as they are, and a day whose matrix is fresh is answered from it.
            val zero = NaviMeasure.zeroLegs(wanted, nowMs())
            if (zero.isNotEmpty()) edit(localId) { it.copy(overlay = it.overlay.copy(legEstimates = it.overlay.legEstimates + zero)) }
            _guide.value = if (matrixDay != null) orderGuide(localId, matrixDay) else Guide.MeasureFailed(Msg(R.string.measure_nothing))
            return
        }
        viewModelScope.launch {
            val current = navi.currentDestination()
            measureAsk = localId to matrixDay
            _guide.value = Guide.ConfirmMeasure(current?.name?.ifBlank { null }, routes)
        }
    }

    /** The driver agreed: the navigation may come to the front and its current route may end. */
    fun confirmMeasure() {
        val (localId, day) = measureAsk ?: return
        measureAsk = null
        measure(localId, day)
    }

    /**
     * Measures legs with the navigation's waypoint routes ([NaviMeasure]) — parked, after the driver's yes. Legs are
     * saved route by route, so stopping midway keeps what was read; the last measuring route is always cancelled.
     * A navigation that keeps fewer waypoints than sent gets shorter routes from then on. The app is held running
     * for the duration ([keepRunning]) because the navigation is in front the whole time.
     */
    private fun measure(localId: String, matrixDay: Int?) {
        val t0 = trip(localId) ?: return
        if (measureJob?.isActive == true || isDriving()) return
        measureJob = viewModelScope.launch {
            val wanted = wantedLegs(t0, matrixDay)
            val zero = NaviMeasure.zeroLegs(wanted, nowMs())
            var left = wanted.filterNot { it.sameSpot }.distinct()
            val total = left.size
            var read = 0
            var unsupported = false
            keepRunning(true)
            try {
                if (zero.isNotEmpty()) update(localId) { it.copy(overlay = it.overlay.copy(legEstimates = it.overlay.legEstimates + zero)) }
                val here = navi.currentLocation()
                val began = System.nanoTime()
                var failures = 0
                // The whole measurement stays inside the platform's limit for a short foreground service, and ends the
                // moment the car moves: a measuring route is not something to drive on.
                while (left.isNotEmpty() && failures < 2 && !isDriving() && (System.nanoTime() - began) / 1_000_000 < MEASURE_BUDGET_MS) {
                    _guide.value = Guide.Measuring(Msg(R.string.measure_working, (total - left.size).toString(), total.toString()))
                    fun standsAt(p: NaviMeasure.Point) = here != null && metres(here.latE7, here.lonE7, p.latE7, p.lonE7) <= PlaceMatch.SAME_METRES
                    val chain = NaviMeasure.chains(left, naviWaypoints, ::standsAt).first()
                    // A route cannot begin with a waypoint where the car already stands: that point is the car itself (nothing left to it).
                    val atCar = standsAt(chain[0])
                    val sent = if (atCar) chain.drop(1) else chain
                    // One leg that starts at the car needs no route at all: that is what the navigation's own query answers.
                    val outcome = if (sent.size == 1) navi.estimate(pointTarget(t0, sent[0]))?.let { MeasureOutcome.Read(listOf(NaviMeasure.Reading(it.seconds, it.metres))) } ?: MeasureOutcome.NoAnswer
                    else navi.measure(sent.map { pointTarget(t0, it) })
                    when (val r = outcome) {
                        is MeasureOutcome.Read -> {
                            val readings = if (atCar) listOf(NaviMeasure.Reading(0, 0)) + r.readings else r.readings
                            val legs = NaviMeasure.legs(chain, readings, nowMs())
                            // A route may hop between two wanted legs; only the legs that were asked for are counted.
                            read += legs.keys.count { key -> left.any { it.key == key } }
                            // The measuring route replaced whatever this app had sent before, so that guidance is over.
                            update(localId) { it.copy(overlay = it.overlay.copy(legEstimates = it.overlay.legEstimates + legs, guiding = null, guidingStops = emptyList())) }
                            // Every leg this route drove is done with, read or not: one whose numbers did not add up is not asked twice.
                            val driven = chain.zipWithNext().map { (a, b) -> "${a.key}>${b.key}" }.toSet()
                            left = left.filterNot { it.key in driven }
                            failures = 0
                        }
                        is MeasureOutcome.Fewer -> {
                            if (r.accepted < 1) { unsupported = true; break }
                            naviWaypoints = r.accepted // shorter routes from here on
                        }
                        MeasureOutcome.NoAnswer -> failures += 1
                    }
                }
            } finally {
                withContext(NonCancellable) {
                    navi.cancelRoute()
                    reload()
                }
                keepRunning(false)
            }
            _guide.value = when {
                unsupported -> Guide.MeasureFailed(Msg(R.string.measure_unsupported))
                read == 0 && zero.isEmpty() -> Guide.MeasureFailed(Msg(R.string.measure_failed))
                matrixDay != null && left.isEmpty() -> orderGuide(localId, matrixDay)
                left.isNotEmpty() -> Guide.Done(Msg(R.string.measure_partial, read.toString(), total.toString()))
                else -> Guide.Done(Msg(R.string.measure_done, read.toString()))
            }
            toFront()
        }
    }

    /** What the day's measured legs say about its order, as the message closing an order measurement. */
    private fun orderGuide(localId: String, day: Int): Guide {
        val t = trip(localId) ?: return Guide.Idle
        return when (val o = RouteOptimizer.suggest(t.plan, t.overlay, day)) {
            is RouteOptimizer.Outcome.Faster -> Guide.Done(Msg(R.string.order_found, day.toString()))
            is RouteOptimizer.Outcome.Best -> Guide.Done(Msg(R.string.order_best, day.toString()))
            is RouteOptimizer.Outcome.NeedsMeasure -> Guide.MeasureFailed(Msg(R.string.measure_failed))
            is RouteOptimizer.Outcome.NotApplicable -> Guide.MeasureFailed(Msg(R.string.order_not_applicable))
        }
    }

    /** Follow the navigation's faster order for that day in the car; the phone's plan is not changed and the order can be put back. */
    fun applyOrder(localId: String, day: Int, order: List<String>) {
        edit(localId) { it.copy(overlay = it.overlay.copy(orderOverrides = it.overlay.orderOverrides + (day to order))) }
        _guide.value = Guide.Done(Msg(R.string.order_applied, day.toString()))
    }

    fun resetOrder(localId: String, day: Int) {
        edit(localId) { it.copy(overlay = it.overlay.copy(orderOverrides = it.overlay.orderOverrides - day)) }
        _guide.value = Guide.Done(Msg(R.string.order_reset, day.toString()))
    }
}
