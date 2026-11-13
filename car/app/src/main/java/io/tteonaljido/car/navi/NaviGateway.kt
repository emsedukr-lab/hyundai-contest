package io.tteonaljido.car.navi

import ai.pleos.playground.navi.constants.BookmarkType
import ai.pleos.playground.navi.constants.NaviErrorCode
import ai.pleos.playground.navi.constants.NavigationStatus
import ai.pleos.playground.navi.constants.RouteOption
import ai.pleos.playground.navi.constants.WaypointIndex
import ai.pleos.playground.navi.data.BookmarkInfo
import ai.pleos.playground.navi.data.CurrentLocationInfo
import ai.pleos.playground.navi.data.DestinationArrivedInfo
import ai.pleos.playground.navi.data.DestinationInfo
import ai.pleos.playground.navi.data.DrivingInfo
import ai.pleos.playground.navi.data.NavigationScreenRequest
import ai.pleos.playground.navi.data.RequestWaypointInfo
import ai.pleos.playground.navi.data.RouteInfo
import ai.pleos.playground.navi.data.RouteWithWaypointsRequest
import ai.pleos.playground.navi.data.RouteStartInfo
import ai.pleos.playground.navi.data.RouteStateInfo
import ai.pleos.playground.navi.data.TBTInfo
import ai.pleos.playground.navi.data.TripInfo
import ai.pleos.playground.navi.data.TripRequest
import ai.pleos.playground.navi.data.WaypointArrivedInfo
import ai.pleos.playground.navi.data.WaypointInfo
import ai.pleos.playground.navi.helper.NaviHelper
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener
import android.content.Context
import android.util.Log
import io.tteonaljido.car.BuildConfig
import io.tteonaljido.trip.Match
import io.tteonaljido.trip.NaviBinding
import io.tteonaljido.trip.NaviMeasure
import io.tteonaljido.trip.metres
import io.tteonaljido.trip.PlaceMatch
import io.tteonaljido.trip.RestAreas
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.math.roundToInt

enum class NaviStatus { CONNECTING, CONNECTED, UNAVAILABLE }

data class RouteTarget(val name: String, val address: String, val latE7: Int?, val lonE7: Int?, val poiId: String?, val poiSubId: String?, val poiProvider: String?)

sealed interface RouteOutcome {
    data class Confirmed(val binding: NaviBinding) : RouteOutcome
    data class Different(val binding: NaviBinding, val match: Match) : RouteOutcome
    data object NoAnswer : RouteOutcome
    data class Unavailable(@androidx.annotation.StringRes val reason: Int) : RouteOutcome
}

/**
 * What the navigation is doing right now (pushed by its callbacks, refreshed by `getDestinationInfo`).
 * Units checked on the emulator (docs/evidence/m9): seconds and metres.
 */
data class NaviLive(
    val guiding: Boolean,
    val destName: String,
    val destLatE7: Int?,
    val destLonE7: Int?,
    val remainSeconds: Int?,
    val remainMetres: Int?,
    val lowBattery: Boolean = false,
    val at: Long = System.currentTimeMillis(),
    /** The route's waypoints still ahead, in order (`onDrivingInfo.waypoints`); empty on a single-stop route. */
    val waypoints: List<NaviLeg> = emptyList(),
    /** Toll the navigation reported when the route started (won). On a route with waypoints it covers the first leg only. */
    val tollWon: Int? = null,
    /** Congestion and incidents on the route (`getRouteStateInfo().trafficStatus`). */
    val traffic: NaviTraffic? = null,
    /** Distance to the next rest area / service area on the route (`getTBTInfo`, see `RestAreas`), if one is ahead. */
    val restAreaMetres: Int? = null,
) {
    /** Remaining minutes, rounded up so "1 min left" never shows as 0. */
    val remainMinutes: Int? get() = remainSeconds?.let { (it + 59) / 60 }
}

/** One waypoint of the active route: its name and what is left to it (seconds, metres — same units as the destination). */
data class NaviLeg(val name: String, val remainSeconds: Int?, val remainMetres: Int?)

/**
 * Traffic on the active route: total congested length (metres, checked on the emulator against the route) and the
 * number of reported incidents (accident, road works, …). The summary's time value is not used: its meaning is not
 * documented and could not be pinned down.
 */
data class NaviTraffic(val congestionMetres: Int?, val incidents: Int)

/**
 * The navigation's arrival event (it carries a name, no coordinates); `demo` = the emulator-only demo signal;
 * `waypoint` = it reached a waypoint of the route (`onWayPointArrived`), not the final destination.
 */
data class NaviArrival(val name: String, val demo: Boolean = false, val waypoint: Boolean = false)

/** `requestTrip` answer: the navigation's own estimate from the car's position (a query; the route is untouched). */
data class NaviEstimate(val seconds: Int, val metres: Int, val socAtDest: Int?) {
    val minutes: Int get() = (seconds + 59) / 60
}

data class HereLocation(val latE7: Int, val lonE7: Int, val address: String)

/**
 * What a measuring route gave back (M63, [NaviGateway.measure]): the navigation's remaining time and distance to every
 * point sent, in order — or how many waypoints it kept when that was fewer than sent, so the caller can plan shorter routes.
 */
sealed interface MeasureOutcome {
    data class Read(val readings: List<NaviMeasure.Reading>) : MeasureOutcome
    data class Fewer(val accepted: Int) : MeasureOutcome
    data object NoAnswer : MeasureOutcome
}

/** The only door to the Hyundai navigation. `route` changes the real destination, so it runs only on an explicit tap. */
interface NaviGateway {
    val status: StateFlow<NaviStatus>
    val live: StateFlow<NaviLive?>
    val arrivals: SharedFlow<NaviArrival>
    suspend fun currentDestination(): NaviBinding?
    suspend fun homeBookmark(): NaviBinding?
    /**
     * `previous` is the destination before the request, so an unchanged old route is not mistaken for the answer.
     * `fastest` asks for the shortest-time route option instead of the navigation's default (used when 시간 지킴이 says the next fixed time is tight).
     */
    suspend fun route(target: RouteTarget, previous: NaviBinding? = null, fastest: Boolean = false): RouteOutcome
    /** Load the day's route in one request: the final stop is the destination, earlier stops are waypoints in order. Confirmation matches the final destination, like [route]. Explicit parked tap only. */
    suspend fun routeTrip(dest: RouteTarget, waypoints: List<RouteTarget>, previous: NaviBinding? = null): RouteOutcome
    /**
     * Measures the legs between `points` (M63): starts a route through them in order, reads what the navigation says is
     * left to each from the car, and leaves the route up — the caller sends the next one or ends with [cancelRoute].
     * This is a real route start (the navigation has no query for a leg the car is not on), so it replaces whatever
     * the navigation was guiding to: explicit parked tap only.
     */
    suspend fun measure(points: List<RouteTarget>): MeasureOutcome
    /** Ends the navigation's current route and waits until it reports no guidance. */
    suspend fun cancelRoute()
    suspend fun currentLocation(): HereLocation?
    suspend fun estimate(target: RouteTarget): NaviEstimate?
    /** How many waypoints the navigation's route now holds (`getWaypointInfo`); null when it did not answer. */
    suspend fun waypointCount(): Int?
    fun refreshLive()
    fun openSearch(keyword: String)
    fun openAddHome()
    fun openNearbyChargers()
    /** Emulator demo only: the emulator's navigation never moves, so a labelled signal stands in for its arrival event. */
    fun demoArrive()
    fun close()
}

private fun e7(v: Double) = (v * 1e7).roundToInt()

private fun DestinationInfo.binding() = NaviBinding(poiId.orEmpty(), poiSubId.orEmpty(), poiProvider.orEmpty(), e7(latitude), e7(longitude), name.orEmpty(), address.orEmpty())
private fun BookmarkInfo.binding() = NaviBinding(poiId.orEmpty(), poiSubId.orEmpty(), poiProvider.orEmpty(), e7(latitude), e7(longitude), name.orEmpty(), address.orEmpty())

private const val TAG = "TteonaljidoNavi"
/** A measuring route: how long the navigation gets to start it, then to report every point, and how far a point it reports may sit from the one sent. */
private const val MEASURE_START_MS = 40_000L
private const val MEASURE_READ_MS = 25_000L
private const val MEASURE_MATCH_METRES = 500.0

class PleosNaviGateway(context: Context) : NaviGateway {
    private val navi = NaviHelper(context)
    private val _status = MutableStateFlow(NaviStatus.CONNECTING)
    override val status: StateFlow<NaviStatus> = _status
    private val _live = MutableStateFlow<NaviLive?>(null)
    override val live: StateFlow<NaviLive?> = _live
    private val _arrivals = MutableSharedFlow<NaviArrival>(extraBufferCapacity = 4)
    override val arrivals: SharedFlow<NaviArrival> = _arrivals
    // Set on the main thread, completed on SDK callback threads: @Volatile so the callback sees the latest waiter.
    @Volatile private var destinationWaiter: CompletableDeferred<DestinationInfo?>? = null
    @Volatile private var bookmarkWaiter: CompletableDeferred<List<BookmarkInfo>>? = null
    @Volatile private var locationWaiter: CompletableDeferred<CurrentLocationInfo?>? = null
    @Volatile private var tripWaiter: CompletableDeferred<TripInfo?>? = null
    @Volatile private var waypointWaiter: CompletableDeferred<List<WaypointInfo>>? = null
    @Volatile private var startWaiter: CompletableDeferred<Unit>? = null
    /** Debug builds only: logs every navigation callback and runs single queries (see NaviProbe). */
    val probe: NaviProbe? = if (BuildConfig.DEBUG) NaviProbe(navi) else null

    // The route is gone: what belonged to it (waypoints, toll, traffic, rest area) goes with it.
    private fun stopped() { _live.value = _live.value?.copy(guiding = false, remainSeconds = null, remainMetres = null, at = System.currentTimeMillis(), waypoints = emptyList(), tollWon = null, traffic = null, restAreaMetres = null) }
    private fun DrivingInfo.legs() = waypoints.map { NaviLeg(it.name, it.duration.takeIf { s -> s > 0 }, it.distance.takeIf { m -> m > 0 }) }
    /**
     * Route extras (traffic, rest areas, waypoints) follow the route: ask again whenever it starts or changes, and on
     * the 30 s refresh. The waypoint list is asked too because `onDrivingInfo` is not pushed while the car stands
     * still (and not at all right after this app restarts mid-route).
     */
    private fun askRouteExtras() { runCatching { navi.getRouteStateInfo() }; runCatching { navi.getTBTInfo() }; runCatching { navi.getWaypointInfo() } }

    private val listener = object : NaviHelperEventListener {
        override fun onDestinationInfo(info: DestinationInfo) {
            if (BuildConfig.DEBUG) Log.d(TAG, "destination name=${info.name.isNotBlank()} poi=${!info.poiId.isNullOrEmpty()} provider=${info.poiProvider} remain=${info.remainTime}")
            if (info.name.isBlank()) stopped()
            else {
                // The route's extras were reset when it started (onRouteStarted builds a clean state), so they carry over here.
                val prev = _live.value
                // A route this app did not see start (it was already running when the app came up): ask for its extras now.
                if (prev?.guiding != true) askRouteExtras()
                _live.value = NaviLive(
                    true, info.name, e7(info.latitude), e7(info.longitude), info.remainTime.takeIf { it > 0 }, info.remainDistance.takeIf { it > 0 }, _live.value?.lowBattery == true,
                    waypoints = prev?.waypoints.orEmpty(), tollWon = info.tollFare.takeIf { it > 0 } ?: prev?.tollWon, traffic = prev?.traffic, restAreaMetres = prev?.restAreaMetres,
                )
            }
            destinationWaiter?.complete(info)
        }
        override fun onRoutingCompleted() {
            if (BuildConfig.DEBUG) Log.d(TAG, "routing completed")
            runCatching { navi.getDestinationInfo() }
            askRouteExtras()
        }
        override fun onRouteStarted(routeStartInfo: RouteStartInfo) {
            val prev = _live.value
            _live.value = NaviLive(true, routeStartInfo.name, prev?.destLatE7, prev?.destLonE7, routeStartInfo.duration.takeIf { it > 0 }, routeStartInfo.distance.takeIf { it > 0 }, tollWon = routeStartInfo.tollFare.takeIf { it > 0 })
            runCatching { navi.getDestinationInfo() } // fills in the destination's coordinates
            startWaiter?.complete(Unit)
        }
        override fun onDrivingInfo(drivingInfo: DrivingInfo) {
            val d = drivingInfo.destination
            if (d.duration <= 0 && d.distance <= 0) return
            // A zero is "unknown", never "arriving now".
            _live.value = (_live.value ?: NaviLive(true, d.name, null, null, null, null)).copy(guiding = true, remainSeconds = d.duration.takeIf { it > 0 }, remainMetres = d.distance.takeIf { it > 0 }, at = System.currentTimeMillis(), waypoints = drivingInfo.legs())
        }
        override fun onRouteStateInfo(routeStateInfo: RouteStateInfo) {
            val live = _live.value?.takeIf { it.guiding } ?: return
            // No traffic block at all = not reported; zero length and no incident = clear road. Neither becomes a traffic line.
            val t = routeStateInfo.trafficStatus ?: return run { _live.value = live.copy(traffic = null) }
            val metres = t.summary.totalCongestionDist.takeIf { it > 0 }?.roundToInt()
            _live.value = live.copy(traffic = if (metres == null && t.trafficEventList.isEmpty()) null else NaviTraffic(metres, t.trafficEventList.size))
        }
        override fun onTBTInfo(tbtInfoList: List<TBTInfo>) {
            val live = _live.value?.takeIf { it.guiding } ?: return
            _live.value = live.copy(restAreaMetres = RestAreas.ahead(tbtInfoList.map { RestAreas.Turn(it.type.name, it.distance) }, live.remainMetres))
        }
        override fun onWayPointInfo(waypointInfoList: List<WaypointInfo>) {
            // Same numbers as onDrivingInfo.waypoints (checked on the emulator: seconds and metres left to each waypoint).
            _live.value?.takeIf { it.guiding }?.let { live -> _live.value = live.copy(waypoints = waypointInfoList.map { NaviLeg(it.name, it.remainTime.takeIf { s -> s > 0 }, it.remainDistance.takeIf { m -> m > 0 }) }) }
            waypointWaiter?.complete(waypointInfoList)
        }
        override fun onWayPointArrived(waypointArrivedInfo: WaypointArrivedInfo) {
            _arrivals.tryEmit(NaviArrival(waypointArrivedInfo.name.orEmpty(), waypoint = true))
        }
        override fun onNavigationStatus(status: NavigationStatus) {
            if (status == NavigationStatus.ROUTE_DRIVE) runCatching { navi.getDestinationInfo() } else stopped()
        }
        override fun onRouteCancelled() = stopped()
        override fun onDestinationChanged() { runCatching { navi.getDestinationInfo() } }
        override fun onDestinationArrived(destinationArrivedInfo: DestinationArrivedInfo) {
            stopped()
            _arrivals.tryEmit(NaviArrival(destinationArrivedInfo.name.orEmpty()))
        }
        override fun onCurrentLocationInfo(currentLocationInfo: CurrentLocationInfo) { locationWaiter?.complete(currentLocationInfo) }
        override fun onTripInfo(tripInfo: TripInfo) { tripWaiter?.complete(tripInfo) }
        override fun onBookmarkInfo(bookmarkInfoList: List<BookmarkInfo>) { bookmarkWaiter?.complete(bookmarkInfoList) }
        override fun onError(errorCode: NaviErrorCode) {
            if (BuildConfig.DEBUG) Log.d(TAG, "navi error $errorCode")
            // Each failure ends only the request it belongs to; a trip estimate failing must not cancel a route check.
            when (errorCode) {
                NaviErrorCode.CAUSE_SEARCH_TRIP -> tripWaiter?.complete(null)
                NaviErrorCode.CAUSE_LOW_BATTERY -> _live.value = (_live.value ?: NaviLive(false, "", null, null, null, null)).copy(lowBattery = true)
                else -> {
                    // The error doesn't say which query failed; end whichever is waiting (only one runs at a time) so none hangs for its full timeout.
                    destinationWaiter?.complete(null)
                    locationWaiter?.complete(null)
                    bookmarkWaiter?.complete(emptyList())
                }
            }
        }
    }

    init {
        try {
            navi.addListener(listener)
            probe?.let { navi.addListener(it.listener) }
            navi.initialize({ _status.value = NaviStatus.CONNECTED; runCatching { navi.getDestinationInfo() }; if (BuildConfig.DEBUG) Log.d(TAG, "connected") }, { _status.value = NaviStatus.UNAVAILABLE; if (BuildConfig.DEBUG) Log.d(TAG, "connect failed $it") })
        } catch (e: Throwable) {
            _status.value = NaviStatus.UNAVAILABLE
        }
    }

    private suspend fun destination(timeoutMs: Long = 5_000): DestinationInfo? {
        if (_status.value != NaviStatus.CONNECTED) return null
        val w = CompletableDeferred<DestinationInfo?>().also { destinationWaiter = it }
        runCatching { navi.getDestinationInfo() }.onFailure { return null }
        return withTimeoutOrNull(timeoutMs) { w.await() }?.takeIf { it.name.isNotBlank() }
    }

    override suspend fun currentDestination(): NaviBinding? = destination()?.binding()

    override suspend fun homeBookmark(): NaviBinding? {
        if (_status.value != NaviStatus.CONNECTED) return null
        val w = CompletableDeferred<List<BookmarkInfo>>().also { bookmarkWaiter = it }
        runCatching { navi.getBookmarkInfo() }.onFailure { return null }
        return withTimeoutOrNull(5_000) { w.await() }?.firstOrNull { it.category == BookmarkType.HOME }?.binding()
    }

    override suspend fun route(target: RouteTarget, previous: NaviBinding?, fastest: Boolean): RouteOutcome {
        if (_status.value != NaviStatus.CONNECTED) return RouteOutcome.Unavailable(io.tteonaljido.car.R.string.navi_not_connected)
        val lat = target.latE7 ?: return RouteOutcome.NoAnswer
        val lon = target.lonE7 ?: return RouteOutcome.NoAnswer
        try {
            navi.requestRoute(
                RouteInfo(
                    latitude = lat / 1e7,
                    longitude = lon / 1e7,
                    poiName = target.name,
                    poiId = target.poiId.orEmpty(),
                    address = target.address,
                    poiSubId = target.poiSubId ?: "0",
                    routeOption = if (fastest) RouteOption.SHORT_TIME else RouteOption.RECOMMENDED,
                    poiProvider = target.poiProvider.orEmpty(),
                ),
            )
        } catch (e: Throwable) {
            return RouteOutcome.Unavailable(io.tteonaljido.car.R.string.navi_rejected)
        }
        return confirmRoute(target, previous)
    }

    /** Waits for the navigation to settle, then classifies its own confirmed destination against [target] (shared by [route] and [routeTrip]). */
    private suspend fun confirmRoute(target: RouteTarget, previous: NaviBinding?): RouteOutcome {
        // The navigation first reports an empty destination, then settles after its route screen.
        // Confirmation is its own answer, not our request: same POI or within 150 m of what we asked for.
        var last: NaviBinding? = null
        val confirmed = withTimeoutOrNull(30_000) {
            var hit: NaviBinding? = null
            while (hit == null) {
                val b = destination(2_500)?.binding()
                if (b != null && b != previous) last = b
                if (b != null && PlaceMatch.classify(target.latE7!!, target.lonE7!!, target.poiId, b.latE7, b.lonE7, b.poiId) == Match.SAME) hit = b
                else delay(1_500)
            }
            hit
        }
        if (confirmed != null) return RouteOutcome.Confirmed(confirmed)
        val other = last ?: return RouteOutcome.NoAnswer
        return RouteOutcome.Different(other, PlaceMatch.classify(target.latE7!!, target.lonE7!!, target.poiId, other.latE7, other.lonE7, other.poiId))
    }

    override suspend fun routeTrip(dest: RouteTarget, waypoints: List<RouteTarget>, previous: NaviBinding?): RouteOutcome {
        if (_status.value != NaviStatus.CONNECTED) return RouteOutcome.Unavailable(io.tteonaljido.car.R.string.navi_not_connected)
        val lat = dest.latE7 ?: return RouteOutcome.NoAnswer
        val lon = dest.lonE7 ?: return RouteOutcome.NoAnswer
        try {
            navi.requestRouteWithWaypoints(waypointRoute(dest, lat, lon, waypoints.filter { it.latE7 != null && it.lonE7 != null }))
        } catch (e: Throwable) {
            return RouteOutcome.Unavailable(io.tteonaljido.car.R.string.navi_rejected)
        }
        return confirmRoute(dest, previous)
    }

    /**
     * A route through `waypoints` to `dest`, in the order given. The SDK names two waypoints (FIRST, SECOND); the rest go
     * out as SECOND, which the emulator's navigation appended in order up to nine (docs/evidence/navi-waypoints). What a
     * real car's navigation keeps is read back by the caller ([waypointCount], [measure]).
     */
    private fun waypointRoute(dest: RouteTarget, lat: Int, lon: Int, waypoints: List<RouteTarget>) = RouteWithWaypointsRequest(
        RouteInfo(
            latitude = lat / 1e7,
            longitude = lon / 1e7,
            poiName = dest.name,
            poiId = dest.poiId.orEmpty(),
            address = dest.address,
            poiSubId = dest.poiSubId ?: "0",
            poiProvider = dest.poiProvider.orEmpty(),
        ),
        waypoints.mapIndexed { i, w ->
            RequestWaypointInfo(
                latitude = w.latE7!! / 1e7,
                longitude = w.lonE7!! / 1e7,
                poiName = w.name,
                waypointIndex = if (i == 0) WaypointIndex.FIRST else WaypointIndex.SECOND,
                poiId = w.poiId.orEmpty(),
                address = w.address,
                poiSubId = w.poiSubId ?: "0",
                poiProvider = w.poiProvider.orEmpty(),
            )
        },
    )

    private suspend fun waypoints(): List<WaypointInfo>? {
        val w = CompletableDeferred<List<WaypointInfo>>().also { waypointWaiter = it }
        runCatching { navi.getWaypointInfo() }.onFailure { return null }
        return withTimeoutOrNull(3_000) { w.await() }
    }

    override suspend fun measure(points: List<RouteTarget>): MeasureOutcome {
        if (_status.value != NaviStatus.CONNECTED || points.size < 2 || points.any { it.latE7 == null || it.lonE7 == null }) return MeasureOutcome.NoAnswer
        val dest = points.last()
        val via = points.dropLast(1)
        // Only a route that starts after this request counts: an older route's numbers must not be read as the answer.
        val started = CompletableDeferred<Unit>().also { startWaiter = it }
        try {
            navi.requestRouteWithWaypoints(waypointRoute(dest, dest.latE7!!, dest.lonE7!!, via))
        } catch (e: Throwable) {
            return MeasureOutcome.NoAnswer
        }
        withTimeoutOrNull(MEASURE_START_MS) { started.await() } ?: return MeasureOutcome.NoAnswer
        // The waypoint list and the destination's remainder follow the start by a moment (up to ten seconds on a long route).
        var fewer: Int? = null
        val read = withTimeoutOrNull(MEASURE_READ_MS) {
            var out: List<NaviMeasure.Reading>? = null
            while (out == null) {
                val w = waypoints()
                val d = destination(3_000)
                if (w != null && d != null && d.remainTime > 0 && metres(e7(d.latitude), e7(d.longitude), dest.latE7, dest.lonE7) <= MEASURE_MATCH_METRES) {
                    // Every waypoint has to be the one sent, in the order sent: a list the navigation reordered or trimmed is not read.
                    val inOrder = w.size == via.size && w.indices.all { i -> w[i].remainTime > 0 && sameWaypoint(w[i], via[i]) }
                    if (inOrder) out = w.map { NaviMeasure.Reading(it.remainTime, it.remainDistance) } + NaviMeasure.Reading(d.remainTime, d.remainDistance)
                    else if (w.size < via.size) fewer = w.size
                }
                if (out == null) delay(1_000)
            }
            out
        }
        if (BuildConfig.DEBUG) Log.d(TAG, "measure points=${points.size} read=${read?.size} fewer=$fewer")
        return read?.let { MeasureOutcome.Read(it) } ?: fewer?.let { MeasureOutcome.Fewer(it) } ?: MeasureOutcome.NoAnswer
    }

    /**
     * Whether a waypoint the navigation lists is the one sent at that position. The emulator's navigation returns
     * waypoints without coordinates (0, 0) but with the name they were sent under (docs/evidence/navi-waypoints), so:
     * by position where it gives one, else by name, else by its place in the list alone.
     */
    private fun sameWaypoint(w: WaypointInfo, sent: RouteTarget): Boolean = when {
        w.latitude != 0.0 || w.longitude != 0.0 -> metres(e7(w.latitude), e7(w.longitude), sent.latE7!!, sent.lonE7!!) <= MEASURE_MATCH_METRES
        w.name.isNotBlank() && sent.name.isNotBlank() -> w.name.trim() == sent.name.trim()
        else -> true
    }

    /**
     * Ends the navigation's route — only when the navigation itself says it has one. A cancel sent with no route
     * fails inside the emulator's navigation ("NOT_CANCEL_ABLE_TRIP") and leaves it refusing every later cancel as
     * "already working" until its app restarts (docs/evidence/navi-waypoints), so one is never sent on a guess: no
     * answer about the destination counts as "do not cancel".
     */
    override suspend fun cancelRoute() {
        if (_status.value != NaviStatus.CONNECTED) return
        if ((destination(3_000) ?: destination(3_000)) == null) return
        runCatching { navi.cancelRoute() }
        withTimeoutOrNull(8_000) { while (destination(2_000) != null) delay(500) }
    }

    override suspend fun currentLocation(): HereLocation? {
        if (_status.value != NaviStatus.CONNECTED) return null
        val w = CompletableDeferred<CurrentLocationInfo?>().also { locationWaiter = it }
        runCatching { navi.getCurrentLocationInfo() }.onFailure { return null }
        val info = withTimeoutOrNull(5_000) { w.await() } ?: return null
        if (info.latitude == 0.0 && info.longitude == 0.0) return null
        return HereLocation(e7(info.latitude), e7(info.longitude), info.address.orEmpty())
    }

    override suspend fun estimate(target: RouteTarget): NaviEstimate? {
        if (_status.value != NaviStatus.CONNECTED) return null
        val lat = target.latE7 ?: return null
        val lon = target.lonE7 ?: return null
        val w = CompletableDeferred<TripInfo?>().also { tripWaiter = it }
        runCatching { navi.requestTrip(TripRequest(lat / 1e7, lon / 1e7, target.poiId.orEmpty(), target.name, target.poiSubId ?: "0")) }.onFailure { return null }
        val info = withTimeoutOrNull(10_000) { w.await() } ?: return null
        if (info.eta <= 0) return null
        return NaviEstimate(info.eta, info.distance, info.estimatedSocAtDest.takeIf { it in 0..100 })
    }

    override suspend fun waypointCount(): Int? = if (_status.value != NaviStatus.CONNECTED) null else waypoints()?.size

    override fun refreshLive() {
        if (_status.value != NaviStatus.CONNECTED) return
        runCatching { navi.getDestinationInfo() }
        if (_live.value?.guiding == true) askRouteExtras()
    }

    override fun openSearch(keyword: String) { runCatching { navi.requestNavigationScreen(NavigationScreenRequest.SearchPlace(keyword)) } }

    override fun openAddHome() { runCatching { navi.requestNavigationScreen(NavigationScreenRequest.AddHomeFavorite) } }

    override fun openNearbyChargers() { runCatching { navi.requestNavigationScreen(NavigationScreenRequest.NearbyChargingStations) } }

    override fun demoArrive() { _arrivals.tryEmit(NaviArrival(_live.value?.destName.orEmpty(), demo = true)) }

    override fun close() { runCatching { probe?.let { navi.removeListener(it.listener) }; navi.removeListener(listener); navi.release() } }
}

/** Off-car stand-in (demo on a phone emulator, previews). Never claims a real route. */
class OfflineNaviGateway : NaviGateway {
    override val status: StateFlow<NaviStatus> = MutableStateFlow(NaviStatus.UNAVAILABLE)
    override val live: StateFlow<NaviLive?> = MutableStateFlow(null)
    private val _arrivals = MutableSharedFlow<NaviArrival>(extraBufferCapacity = 4)
    override val arrivals: SharedFlow<NaviArrival> = _arrivals
    override suspend fun currentDestination(): NaviBinding? = null
    override suspend fun homeBookmark(): NaviBinding? = null
    override suspend fun route(target: RouteTarget, previous: NaviBinding?, fastest: Boolean): RouteOutcome = RouteOutcome.Unavailable(io.tteonaljido.car.R.string.navi_missing)
    override suspend fun routeTrip(dest: RouteTarget, waypoints: List<RouteTarget>, previous: NaviBinding?): RouteOutcome = RouteOutcome.Unavailable(io.tteonaljido.car.R.string.navi_missing)
    override suspend fun currentLocation(): HereLocation? = null
    override suspend fun estimate(target: RouteTarget): NaviEstimate? = null
    override suspend fun waypointCount(): Int? = null
    override suspend fun measure(points: List<RouteTarget>): MeasureOutcome = MeasureOutcome.NoAnswer
    override suspend fun cancelRoute() {}
    override fun refreshLive() {}
    override fun openSearch(keyword: String) {}
    override fun openAddHome() {}
    override fun openNearbyChargers() {}
    override fun demoArrive() { _arrivals.tryEmit(NaviArrival("", demo = true)) }
    override fun close() {}
}
