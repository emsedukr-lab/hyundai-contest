package io.tteonaljido.car.navi

import ai.pleos.playground.navi.constants.BookmarkType
import ai.pleos.playground.navi.constants.NaviErrorCode
import ai.pleos.playground.navi.constants.NavigationStatus
import ai.pleos.playground.navi.data.BookmarkInfo
import ai.pleos.playground.navi.data.CurrentLocationInfo
import ai.pleos.playground.navi.data.DestinationArrivedInfo
import ai.pleos.playground.navi.data.DestinationInfo
import ai.pleos.playground.navi.data.DrivingInfo
import ai.pleos.playground.navi.data.NavigationScreenRequest
import ai.pleos.playground.navi.data.RouteInfo
import ai.pleos.playground.navi.data.RouteStartInfo
import ai.pleos.playground.navi.data.TripInfo
import ai.pleos.playground.navi.data.TripRequest
import ai.pleos.playground.navi.helper.NaviHelper
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener
import android.content.Context
import android.util.Log
import io.tteonaljido.car.BuildConfig
import io.tteonaljido.trip.Match
import io.tteonaljido.trip.NaviBinding
import io.tteonaljido.trip.PlaceMatch
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
) {
    /** Remaining minutes, rounded up so "1 min left" never shows as 0. */
    val remainMinutes: Int? get() = remainSeconds?.let { (it + 59) / 60 }
}

/** The navigation's arrival event (it carries a name, no coordinates); `demo` = the emulator-only demo signal. */
data class NaviArrival(val name: String, val demo: Boolean = false)

/** `requestTrip` answer: the navigation's own estimate from the car's position (a query; the route is untouched). */
data class NaviEstimate(val seconds: Int, val metres: Int, val socAtDest: Int?) {
    val minutes: Int get() = (seconds + 59) / 60
}

data class HereLocation(val latE7: Int, val lonE7: Int, val address: String)

/** The only door to the Hyundai navigation. `route` changes the real destination, so it runs only on an explicit tap. */
interface NaviGateway {
    val status: StateFlow<NaviStatus>
    val live: StateFlow<NaviLive?>
    val arrivals: SharedFlow<NaviArrival>
    suspend fun currentDestination(): NaviBinding?
    suspend fun homeBookmark(): NaviBinding?
    /** `previous` is the destination before the request, so an unchanged old route is not mistaken for the answer. */
    suspend fun route(target: RouteTarget, previous: NaviBinding? = null): RouteOutcome
    suspend fun currentLocation(): HereLocation?
    suspend fun estimate(target: RouteTarget): NaviEstimate?
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
    /** Debug builds only: logs every navigation callback and runs single queries (see NaviProbe). */
    val probe: NaviProbe? = if (BuildConfig.DEBUG) NaviProbe(navi) else null

    private fun stopped() { _live.value = _live.value?.copy(guiding = false, remainSeconds = null, remainMetres = null, at = System.currentTimeMillis()) }

    private val listener = object : NaviHelperEventListener {
        override fun onDestinationInfo(info: DestinationInfo) {
            if (BuildConfig.DEBUG) Log.d(TAG, "destination name=${info.name.isNotBlank()} poi=${!info.poiId.isNullOrEmpty()} provider=${info.poiProvider} remain=${info.remainTime}")
            if (info.name.isBlank()) stopped()
            else _live.value = NaviLive(true, info.name, e7(info.latitude), e7(info.longitude), info.remainTime.takeIf { it > 0 }, info.remainDistance.takeIf { it > 0 }, _live.value?.lowBattery == true)
            destinationWaiter?.complete(info)
        }
        override fun onRoutingCompleted() {
            if (BuildConfig.DEBUG) Log.d(TAG, "routing completed")
            runCatching { navi.getDestinationInfo() }
        }
        override fun onRouteStarted(routeStartInfo: RouteStartInfo) {
            val prev = _live.value
            _live.value = NaviLive(true, routeStartInfo.name, prev?.destLatE7, prev?.destLonE7, routeStartInfo.duration.takeIf { it > 0 }, routeStartInfo.distance.takeIf { it > 0 })
            runCatching { navi.getDestinationInfo() } // fills in the destination's coordinates
        }
        override fun onDrivingInfo(drivingInfo: DrivingInfo) {
            val d = drivingInfo.destination
            if (d.duration <= 0 && d.distance <= 0) return
            // A zero is "unknown", never "arriving now".
            _live.value = (_live.value ?: NaviLive(true, d.name, null, null, null, null)).copy(guiding = true, remainSeconds = d.duration.takeIf { it > 0 }, remainMetres = d.distance.takeIf { it > 0 }, at = System.currentTimeMillis())
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

    override suspend fun route(target: RouteTarget, previous: NaviBinding?): RouteOutcome {
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
                    poiProvider = target.poiProvider.orEmpty(),
                ),
            )
        } catch (e: Throwable) {
            return RouteOutcome.Unavailable(io.tteonaljido.car.R.string.navi_rejected)
        }
        // The navigation first reports an empty destination, then settles after its route screen.
        // Confirmation is its own answer, not our request: same POI or within 150 m of what we asked for.
        var last: NaviBinding? = null
        val confirmed = withTimeoutOrNull(30_000) {
            var hit: NaviBinding? = null
            while (hit == null) {
                val b = destination(2_500)?.binding()
                if (b != null && b != previous) last = b
                if (b != null && PlaceMatch.classify(target.latE7, target.lonE7, target.poiId, b.latE7, b.lonE7, b.poiId) == Match.SAME) hit = b
                else delay(1_500)
            }
            hit
        }
        if (confirmed != null) return RouteOutcome.Confirmed(confirmed)
        val other = last ?: return RouteOutcome.NoAnswer
        return RouteOutcome.Different(other, PlaceMatch.classify(target.latE7, target.lonE7, target.poiId, other.latE7, other.lonE7, other.poiId))
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

    override fun refreshLive() { if (_status.value == NaviStatus.CONNECTED) runCatching { navi.getDestinationInfo() } }

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
    override suspend fun route(target: RouteTarget, previous: NaviBinding?): RouteOutcome = RouteOutcome.Unavailable(io.tteonaljido.car.R.string.navi_missing)
    override suspend fun currentLocation(): HereLocation? = null
    override suspend fun estimate(target: RouteTarget): NaviEstimate? = null
    override fun refreshLive() {}
    override fun openSearch(keyword: String) {}
    override fun openAddHome() {}
    override fun openNearbyChargers() {}
    override fun demoArrive() { _arrivals.tryEmit(NaviArrival("", demo = true)) }
    override fun close() {}
}
