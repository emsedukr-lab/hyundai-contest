package io.tteonaljido.car.navi

import ai.pleos.playground.navi.constants.NaviErrorCode
import ai.pleos.playground.navi.constants.NavigationStatus
import ai.pleos.playground.navi.data.CurrentLocationInfo
import ai.pleos.playground.navi.data.DestinationArrivedInfo
import ai.pleos.playground.navi.data.DestinationInfo
import ai.pleos.playground.navi.data.DrivingInfo
import ai.pleos.playground.navi.data.NavigationScreenRequest
import ai.pleos.playground.navi.data.RouteStartInfo
import ai.pleos.playground.navi.data.RouteStateInfo
import ai.pleos.playground.navi.data.TripInfo
import ai.pleos.playground.navi.data.TripRequest
import ai.pleos.playground.navi.data.WaypointArrivedInfo
import ai.pleos.playground.navi.helper.NaviHelper
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener
import android.util.Log

/**
 * Debug-only probe for the navigation API (pre-checks S1–S7 in the plan): logs every callback as numbers and booleans
 * (no place names, addresses or coordinates) and runs single queries on request. Attached only when BuildConfig.DEBUG; release builds never construct it.
 *   adb shell am start --user 10 -n io.tteonaljido.car/.MainActivity --es probe "trip:37.7955,128.8975"
 *   probe values: trip:<lat,lon> | route:<lat,lon> | location | state | destination | chargers | cancel
 */
class NaviProbe(private val navi: NaviHelper) {
    private val tag = "TteonaljidoProbe"
    private fun log(m: String) { Log.d(tag, m) }

    val listener = object : NaviHelperEventListener {
        override fun onDrivingInfo(drivingInfo: DrivingInfo) {
            val d = drivingInfo.destination
            log("onDrivingInfo named=${d.name.isNotBlank()} duration=${d.duration} distance=${d.distance} charge=${d.remainDestinationChargingValue} waypoints=${drivingInfo.waypoints.size}")
        }
        override fun onNavigationStatus(navigationStatus: NavigationStatus) = log("onNavigationStatus $navigationStatus")
        override fun onRouteStarted(routeStartInfo: RouteStartInfo) =
            log("onRouteStarted named=${routeStartInfo.name.isNotBlank()} duration=${routeStartInfo.duration} distance=${routeStartInfo.distance} toll=${routeStartInfo.tollFare} charge=${routeStartInfo.remainDestinationChargingValue}")
        override fun onRouteEnded() = log("onRouteEnded")
        override fun onRouteCancelled() = log("onRouteCancelled")
        override fun onReRouteEnded() = log("onReRouteEnded")
        override fun onDestinationChanged() = log("onDestinationChanged")
        override fun onDestinationArrived(destinationArrivedInfo: DestinationArrivedInfo) =
            log("onDestinationArrived named=${!destinationArrivedInfo.name.isNullOrBlank()} duration=${destinationArrivedInfo.duration} distance=${destinationArrivedInfo.distance}")
        override fun onWayPointArrived(waypointArrivedInfo: WaypointArrivedInfo) = log("onWayPointArrived named=${!waypointArrivedInfo.name.isNullOrBlank()}")
        override fun onDestinationInfo(destinationInfo: DestinationInfo) =
            log("onDestinationInfo named=${destinationInfo.name.isNotBlank()} remainTime=${destinationInfo.remainTime} remainDistance=${destinationInfo.remainDistance} located=${destinationInfo.latitude != 0.0}")
        override fun onCurrentLocationInfo(currentLocationInfo: CurrentLocationInfo) =
            log("onCurrentLocationInfo located=${currentLocationInfo.latitude != 0.0} heading=${currentLocationInfo.heading} addressed=${!currentLocationInfo.address.isNullOrBlank()}")
        override fun onRouteStateInfo(routeStateInfo: RouteStateInfo) =
            log("onRouteStateInfo mode=${routeStateInfo.naviMode} routing=${routeStateInfo.isRouting} option=${routeStateInfo.routeOption} charge=${routeStateInfo.remainDestinationChargingInt}")
        override fun onTripInfo(tripInfo: TripInfo) =
            log("onTripInfo distance=${tripInfo.distance} eta=${tripInfo.eta} socAtDest=${tripInfo.estimatedSocAtDest} energy=${tripInfo.energyConsumption} points=${tripInfo.summary.routePoints.size}")
        override fun onError(errorCode: NaviErrorCode) = log("onError $errorCode")
    }

    fun run(cmd: String) {
        log("probe ${cmd.substringBefore(':')}") // the command's coordinates stay out of the log
        runCatching {
            when {
                cmd.startsWith("trip:") -> {
                    val (lat, lon) = cmd.removePrefix("trip:").split(',').map { it.trim().toDouble() }
                    navi.requestTrip(TripRequest(lat, lon, "", "probe", "0"))
                }
                cmd.startsWith("route:") -> {
                    val (lat, lon) = cmd.removePrefix("route:").split(',').map { it.trim().toDouble() }
                    navi.requestRoute(ai.pleos.playground.navi.data.RouteInfo(latitude = lat, longitude = lon, poiName = "probe", poiId = "", address = "", poiSubId = "0", poiProvider = ""))
                }
                cmd == "location" -> navi.getCurrentLocationInfo()
                cmd == "state" -> navi.getRouteStateInfo()
                cmd == "destination" -> navi.getDestinationInfo()
                cmd == "chargers" -> navi.requestNavigationScreen(NavigationScreenRequest.NearbyChargingStations)
                cmd == "cancel" -> navi.cancelRoute()
                else -> log("unknown probe")
            }
        }.onFailure { log("probe failed ${it.javaClass.simpleName}: ${it.message}") }
    }
}
