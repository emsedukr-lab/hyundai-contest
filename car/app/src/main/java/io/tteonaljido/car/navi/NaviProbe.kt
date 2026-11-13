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
import ai.pleos.playground.navi.data.TBTInfo
import ai.pleos.playground.navi.data.TripInfo
import ai.pleos.playground.navi.data.TripRequest
import ai.pleos.playground.navi.data.WaypointArrivedInfo
import ai.pleos.playground.navi.data.WaypointInfo
import ai.pleos.playground.navi.helper.NaviHelper
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener
import android.util.Log

/**
 * Debug-only probe for the navigation API (pre-checks S1–S7 in the plan): logs every callback as numbers and booleans
 * (no place names, addresses or coordinates) and runs single queries on request. Attached only when BuildConfig.DEBUG; release builds never construct it.
 *   adb shell am start --user 10 -n io.tteonaljido.car/.MainActivity --es probe "trip:37.7955,128.8975"
 *   probe values: trip:<lat,lon> | route:<lat,lon> | location | state | destination | chargers | cancel | tbt | waypoints | via:<lat,lon>|<lat,lon>|<lat,lon>
 *                 | add:<lat,lon>,<FIRST|SECOND> | remove:<FIRST|SECOND|ALL>
 * `via:` sends every point it is given (the last is the destination): the third waypoint onwards goes out as SECOND, to
 * see what the navigation does with more than the two the SDK can name.
 */
class NaviProbe(private val navi: NaviHelper) {
    private val tag = "TteonaljidoProbe"
    private fun log(m: String) { Log.d(tag, m) }

    val listener = object : NaviHelperEventListener {
        override fun onDrivingInfo(drivingInfo: DrivingInfo) {
            val d = drivingInfo.destination
            log("onDrivingInfo named=${d.name.isNotBlank()} duration=${d.duration} distance=${d.distance} charge=${d.remainDestinationChargingValue} waypoints=${drivingInfo.waypoints.size} waypointLegs=${drivingInfo.waypoints.joinToString { "${it.duration}s/${it.distance}m" }}")
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
            log("onDestinationInfo named=${destinationInfo.name.isNotBlank()} remainTime=${destinationInfo.remainTime} remainDistance=${destinationInfo.remainDistance} toll=${destinationInfo.tollFare} located=${destinationInfo.latitude != 0.0}")
        override fun onCurrentLocationInfo(currentLocationInfo: CurrentLocationInfo) =
            log("onCurrentLocationInfo located=${currentLocationInfo.latitude != 0.0} heading=${currentLocationInfo.heading} addressed=${!currentLocationInfo.address.isNullOrBlank()}")
        override fun onRouteStateInfo(routeStateInfo: RouteStateInfo) =
            log("onRouteStateInfo mode=${routeStateInfo.naviMode} routing=${routeStateInfo.isRouting} option=${routeStateInfo.routeOption} charge=${routeStateInfo.remainDestinationChargingInt} traffic=${routeStateInfo.trafficStatus?.let { t -> "dist=${t.summary.totalCongestionDist} time=${t.summary.totalCongestionTime} avgSpeed=${t.summary.totalCongestionAvrSpeed} segments=${t.congestionItemList.size} first=${t.congestionItemList.take(3).joinToString { c -> "${c.trafficCongestionType}:${c.distance}/${c.trafficCongestionTime}" }} events=${t.trafficEventList.map { e -> e.eventType }}" }}")
        override fun onTBTInfo(tbtInfoList: List<TBTInfo>) = log("onTBTInfo n=${tbtInfoList.size} sum=${tbtInfoList.sumOf { it.distance }} list=${tbtInfoList.joinToString { "${it.type.name.removePrefix("TURN_")}@${it.distance.toInt()}" }}")
        override fun onWayPointInfo(waypointInfoList: List<WaypointInfo>) = log("onWayPointInfo n=${waypointInfoList.size} legs=${waypointInfoList.joinToString { "${it.remainTime}s/${it.remainDistance}m" }}")
        override fun onWaypointChanged(waypointChangedInfo: ai.pleos.playground.navi.data.WaypointChangedInfo) =
            log("onWaypointChanged index=${waypointChangedInfo.index} cmd=${waypointChangedInfo.cmdType} duration=${waypointChangedInfo.routeStartInfo.duration} distance=${waypointChangedInfo.routeStartInfo.distance}")
        override fun onRoutingCompleted() = log("onRoutingCompleted")
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
                // A route with waypoints: "via:<lat,lon>|<lat,lon>|<lat,lon>" — the last point is the destination.
                cmd.startsWith("via:") -> {
                    val pts = cmd.removePrefix("via:").split('|').map { p -> p.split(',').map { it.trim().toDouble() } }
                    val (dLat, dLon) = pts.last()
                    navi.requestRouteWithWaypoints(
                        ai.pleos.playground.navi.data.RouteWithWaypointsRequest(
                            ai.pleos.playground.navi.data.RouteInfo(latitude = dLat, longitude = dLon, poiName = "probe-dest", poiId = "", address = "", poiSubId = "0", poiProvider = ""),
                            pts.dropLast(1).mapIndexed { i, (lat, lon) ->
                                ai.pleos.playground.navi.data.RequestWaypointInfo(
                                    latitude = lat, longitude = lon, poiName = "probe-wp${i + 1}",
                                    waypointIndex = if (i == 0) ai.pleos.playground.navi.constants.WaypointIndex.FIRST else ai.pleos.playground.navi.constants.WaypointIndex.SECOND,
                                    poiId = "", address = "", poiSubId = "0", poiProvider = "",
                                )
                            },
                        ),
                    )
                }
                cmd.startsWith("add:") -> {
                    val (lat, lon, index) = cmd.removePrefix("add:").split(',').map { it.trim() }
                    navi.addWaypoint(
                        ai.pleos.playground.navi.data.RequestWaypointInfo(
                            latitude = lat.toDouble(), longitude = lon.toDouble(), poiName = "probe-add",
                            waypointIndex = ai.pleos.playground.navi.constants.WaypointIndex.valueOf(index), poiId = "", address = "", poiSubId = "0", poiProvider = "",
                        ),
                    )
                }
                cmd.startsWith("remove:") -> navi.removeWaypoint(ai.pleos.playground.navi.constants.WaypointIndex.valueOf(cmd.removePrefix("remove:").trim()))
                cmd == "tbt" -> navi.getTBTInfo()
                cmd == "waypoints" -> navi.getWaypointInfo()
                else -> log("unknown probe")
            }
        }.onFailure { log("probe failed ${it.javaClass.simpleName}: ${it.message}") }
    }
}
