package io.tteonaljido.car.navi

import ai.pleos.playground.navi.constants.BookmarkType
import ai.pleos.playground.navi.constants.NaviErrorCode
import ai.pleos.playground.navi.data.BookmarkInfo
import ai.pleos.playground.navi.data.DestinationInfo
import ai.pleos.playground.navi.data.NavigationScreenRequest
import ai.pleos.playground.navi.data.RouteInfo
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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.math.roundToInt

enum class NaviStatus { CONNECTING, CONNECTED, UNAVAILABLE }

data class RouteTarget(val name: String, val address: String, val latE7: Int, val lonE7: Int, val poiId: String?, val poiSubId: String?, val poiProvider: String?)

sealed interface RouteOutcome {
    data class Confirmed(val binding: NaviBinding) : RouteOutcome
    data class Different(val binding: NaviBinding, val match: Match) : RouteOutcome
    data object NoAnswer : RouteOutcome
    data class Unavailable(val reason: String) : RouteOutcome
}

/** The only door to the Hyundai navigation. `route` changes the real destination, so it runs only on an explicit tap. */
interface NaviGateway {
    val status: StateFlow<NaviStatus>
    suspend fun currentDestination(): NaviBinding?
    suspend fun homeBookmark(): NaviBinding?
    /** `previous` is the destination before the request, so an unchanged old route is not mistaken for the answer. */
    suspend fun route(target: RouteTarget, previous: NaviBinding? = null): RouteOutcome
    fun openSearch(keyword: String)
    fun openAddHome()
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
    private var destinationWaiter: CompletableDeferred<DestinationInfo?>? = null
    private var bookmarkWaiter: CompletableDeferred<List<BookmarkInfo>>? = null

    private val listener = object : NaviHelperEventListener {
        override fun onDestinationInfo(info: DestinationInfo) {
            if (BuildConfig.DEBUG) Log.d(TAG, "destination name=${info.name.isNotBlank()} poi=${!info.poiId.isNullOrEmpty()} provider=${info.poiProvider} lat=${info.latitude != 0.0} remain=${info.remainTime}")
            destinationWaiter?.complete(info)
        }
        override fun onRoutingCompleted() {
            if (BuildConfig.DEBUG) Log.d(TAG, "routing completed")
            runCatching { navi.getDestinationInfo() }
        }
        override fun onBookmarkInfo(bookmarkInfoList: List<BookmarkInfo>) { bookmarkWaiter?.complete(bookmarkInfoList) }
        override fun onError(errorCode: NaviErrorCode) {
            if (BuildConfig.DEBUG) Log.d(TAG, "navi error $errorCode")
            destinationWaiter?.complete(null)
            bookmarkWaiter?.complete(emptyList())
        }
    }

    init {
        try {
            navi.addListener(listener)
            navi.initialize({ _status.value = NaviStatus.CONNECTED; if (BuildConfig.DEBUG) Log.d(TAG, "connected") }, { _status.value = NaviStatus.UNAVAILABLE; if (BuildConfig.DEBUG) Log.d(TAG, "connect failed $it") })
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
        if (_status.value != NaviStatus.CONNECTED) return RouteOutcome.Unavailable("내비게이션에 연결되지 않았어요")
        try {
            navi.requestRoute(
                RouteInfo(
                    latitude = target.latE7 / 1e7,
                    longitude = target.lonE7 / 1e7,
                    poiName = target.name,
                    poiId = target.poiId.orEmpty(),
                    address = target.address,
                    poiSubId = target.poiSubId ?: "0",
                    poiProvider = target.poiProvider.orEmpty(),
                ),
            )
        } catch (e: Throwable) {
            return RouteOutcome.Unavailable("내비게이션이 요청을 받지 않았어요")
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

    override fun openSearch(keyword: String) { runCatching { navi.requestNavigationScreen(NavigationScreenRequest.SearchPlace(keyword)) } }

    override fun openAddHome() { runCatching { navi.requestNavigationScreen(NavigationScreenRequest.AddHomeFavorite) } }

    override fun close() { runCatching { navi.removeListener(listener); navi.release() } }
}

/** Off-car stand-in (demo on a phone emulator, previews). Never claims a real route. */
class OfflineNaviGateway : NaviGateway {
    override val status: StateFlow<NaviStatus> = MutableStateFlow(NaviStatus.UNAVAILABLE)
    override suspend fun currentDestination(): NaviBinding? = null
    override suspend fun homeBookmark(): NaviBinding? = null
    override suspend fun route(target: RouteTarget, previous: NaviBinding?): RouteOutcome = RouteOutcome.Unavailable("이 기기에는 현대자동차그룹 내비게이션이 없어요")
    override fun openSearch(keyword: String) {}
    override fun openAddHome() {}
    override fun close() {}
}
