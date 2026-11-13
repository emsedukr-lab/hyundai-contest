package io.tteonaljido.trip

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject

/**
 * A trip stored in the car. `plan` is exactly what the phone sent and is never edited here;
 * everything the car learns on its own (navigation bindings, chosen origin, visits done) lives in `overlay`.
 */
@Serializable
data class LocalTrip(
    val localId: String,
    val plan: Trip,
    val overlay: CarOverlay = CarOverlay(),
    val meta: ImportMeta,
) {
    /**
     * The plan as the car follows it (M63): the phone's plan with the stop order chosen in the car laid over it
     * ([CarOrder]). Screens and guidance read this; `plan` stays what the phone sent, for storage and re-imports.
     * Not stored: a delegated property is left out of the saved file.
     */
    val view: Trip by lazy { CarOrder.apply(plan, overlay) }
}

@Serializable
data class ImportMeta(
    /** Null for a detached copy: it is never matched again by later imports. */
    val sourceTripId: String?,
    val revision: Int,
    val planHash: String,
    val importedAt: Long,
    /** Saved as a detached copy ("사본"): the plan stays exactly as sent; screens add a localized suffix. */
    val copy: Boolean = false,
)

/** The trip's time zone. The parser rejects unknown ids, but a file from an older build must not crash a screen. */
fun Trip.zoneOrUtc(): java.time.ZoneId = runCatching { java.time.ZoneId.of(timezone) }.getOrDefault(java.time.ZoneOffset.UTC)

/**
 * Where a day starts (M59). The first day starts from the trip's origin — a saved place (집, 회사, 즐겨찾기), a place of
 * the trip, or the car's current location — and every later day from the lodging of the night before. "여기서 출발" can
 * re-set the start to where the car stands only where the plan leaves it open to that: on the first day, or on a later
 * day whose previous night has no lodging. On any other day it still asks the navigation for the time from here, and
 * the day keeps its start.
 */
object DayStart {
    fun canDepartHere(trip: Trip, dayIndex: Int): Boolean = dayIndex == 1 || trip.days.getOrNull(dayIndex - 2)?.lodgingPlaceRef == null

    /** How long an estimate from the car's position stands before the first leg is asked again. */
    const val FRESH_MS = 30 * 60_000L

    /**
     * True while the trip's very first leg is the car's to time (M60): no stop of the first day is done yet, and either
     * the plan carries no time for the leg (a home the phone had no address for) or the trip starts "from the current
     * location". For the latter the phone may have sent a time measured from where the phone was (M61); in the car
     * the current location is the car's, so it measures again. The navigation can only time a leg from the car's own
     * position, so that is where the leg is measured from.
     */
    fun untimed(trip: Trip, overlay: CarOverlay): Boolean {
        val first = trip.days.firstOrNull() ?: return false
        return (trip.origin is Endpoint.Current || first.legs.firstOrNull() == null) && first.visitOrder.none { it in overlay.visited }
    }

    /** Coordinates of the plan's own start, where the car knows them: home (from the phone or the navigation) or a place. */
    fun planStart(trip: Trip, overlay: CarOverlay): Pair<Int, Int>? = when (val o = trip.origin) {
        is Endpoint.Current -> null
        is Endpoint.Home -> overlay.home?.let { it.latE7 to it.lonE7 } ?: trip.home?.let { it.latE7 to it.lonE7 }
        is Endpoint.AtPlace -> overlay.poiBindings[o.placeRef]?.let { it.latE7 to it.lonE7 }
            ?: trip.places.firstOrNull { it.placeRef == o.placeRef }?.let { p -> p.latE7?.let { la -> p.lonE7?.let { lo -> la to lo } } }
    }

    /** True when the car stands at the plan's own start (within [PlaceMatch.SAME_METRES]): the leg from there can be asked as it is. */
    fun atPlanStart(trip: Trip, overlay: CarOverlay, hereLatE7: Int, hereLonE7: Int): Boolean =
        planStart(trip, overlay)?.let { metres(it.first, it.second, hereLatE7, hereLonE7) <= PlaceMatch.SAME_METRES } ?: false

    /** The first leg has an estimate from the navigation that is still recent. */
    fun estimateFresh(trip: Trip, overlay: CarOverlay, now: Long): Boolean =
        LegKeys.of(trip, overlay, 1, 0)?.let(overlay.legEstimates::get)?.let { now - it.at <= FRESH_MS } ?: false

    /**
     * Whether a start pinned to the car has to be measured (again) from where the car now stands: never pinned, the car
     * has moved away from the pin (beyond [PlaceMatch.SAME_METRES]), or the first leg has no recent estimate.
     */
    fun needsMeasure(trip: Trip, overlay: CarOverlay, hereLatE7: Int, hereLonE7: Int, now: Long): Boolean {
        val pinned = overlay.originFor(trip, 1) ?: return true
        if (metres(pinned.latE7, pinned.lonE7, hereLatE7, hereLonE7) > PlaceMatch.SAME_METRES) return true
        return !estimateFresh(trip, overlay, now)
    }
}

/**
 * Where the day now starts from after "여기서 출발", or null if it still starts from the plan. Reads the per-day map,
 * falling back to the legacy first-day field. A later day that has a lodging the night before always starts there, so an
 * override saved for such a day by an older version no longer applies ([DayStart]).
 */
fun CarOverlay.originFor(trip: Trip, dayIndex: Int): NaviBinding? =
    if (!DayStart.canDepartHere(trip, dayIndex)) null else originOverrides[dayIndex] ?: if (dayIndex == 1) originOverride else null

/** A place as confirmed in the Hyundai navigation (never a Kakao or manual id). */
@Serializable
data class NaviBinding(
    val poiId: String,
    val poiSubId: String,
    val poiProvider: String,
    val latE7: Int,
    val lonE7: Int,
    val name: String,
    val address: String,
)

/**
 * Car-side state. Every field has a default so trips saved by an older version still load
 * (a file written by this version cannot be read by an older APK: downgrades are not supported).
 */
@Serializable
data class CarOverlay(
    /** Home confirmed from the navigation's HOME bookmark, used when the payload carried no home address. */
    val home: NaviBinding? = null,
    /** Legacy: the first-day origin the user re-set in the car ("여기서 출발"). Kept so older files still load; new overrides go in [originOverrides]. */
    val originOverride: NaviBinding? = null,
    /** "여기서 출발" per day (dayIndex → where the day now starts from). Any day, not just the first. */
    val originOverrides: Map<Int, NaviBinding> = emptyMap(),
    /** The first day's start was pinned by the car itself ([DayStart.untimed]), not by a tap on "여기서 출발": it follows the car until the day starts. */
    val originPinnedAuto: Boolean = false,
    val poiBindings: Map<String, NaviBinding> = emptyMap(),
    val visited: Set<String> = emptySet(),
    /** When and how each visit was marked done (visitId → stamp). */
    val visitedAt: Map<String, VisitStamp> = emptyMap(),
    /** Stops the driver chose to skip in the car; the plan itself is unchanged. */
    val skipped: Set<String> = emptySet(),
    /** Stops the driver chose to do later today (moved to the tail of the day's remaining order); the plan itself is unchanged. */
    val deferred: Set<String> = emptySet(),
    /** Stops the driver chose to do on a different day (visitId → target dayIndex): removed from their own day, shown at the tail of the target day. The plan itself is unchanged. */
    val deferredTo: Map<String, Int> = emptyMap(),
    /**
     * Travel times and distances from the car's navigation, keyed by [LegKeys] ("from>to"). Where a leg has one it is
     * the leg's time (M63); the phone's value stands only for legs the navigation has not timed.
     */
    val legEstimates: Map<String, LegEstimate> = emptyMap(),
    /**
     * The stop order chosen in the car for a day (dayIndex → visitIds), from the navigation's own times ([RouteOptimizer]).
     * The plan itself is unchanged; an order that no longer matches the day's stops is ignored ([CarOrder.of]).
     */
    val orderOverrides: Map<Int, List<String>> = emptyMap(),
    /** What this app last handed to the navigation, so its arrival event can be matched to a stop. */
    val guiding: GuidingTarget? = null,
    /**
     * The stops of the last '오늘 경로 전송' in driving order (waypoints, then the destination, which is also [guiding]).
     * Lets a waypoint arrival mark its stop and the waypoint's remaining time feed the live view. Empty for a single-stop route.
     */
    val guidingStops: List<GuidingTarget> = emptyList(),
    /**
     * Confirmed parking/stay measurements for this trip (local only; deleted with the trip). M42: kept for saved-trip
     * compatibility and as groundwork for estimating real parking time later — not read by the current screens or timetable.
     */
    val visitRecords: List<VisitRecord> = emptyList(),
    /** An in-progress measurement (e.g. AWAY while the car is off), persisted so it resumes on the next launch. */
    val visitProgress: VisitProgress? = null,
)

@Serializable
enum class VisitHow { MANUAL, NAVI_ARRIVED, DEMO_SIGNAL }

@Serializable
data class VisitStamp(val at: Long, val how: VisitHow)

/**
 * A leg's travel time and distance from the navigation, never typed or guessed: its estimate from the car's position
 * (`requestTrip`, source "NAVI") or read off a waypoint route ([NaviMeasure], source "NAVI_ROUTE").
 */
@Serializable
data class LegEstimate(val minutes: Int, val metres: Int, val at: Long, val source: String = "NAVI")

@Serializable
data class GuidingTarget(
    val dayIndex: Int,
    /** Null when heading to the night's lodging or the final destination. */
    val visitId: String?,
    val placeRef: String?,
    val latE7: Int,
    val lonE7: Int,
    /** The name the navigation itself confirmed; its arrival event carries the same name. */
    val name: String,
    val requestedAt: Long,
)

object PlanHash {
    /** Hash of the plan without the optional home address, so consenting to share home does not look like a new version. */
    fun of(trip: Trip): String {
        val e = TransferParser.tripElement(trip) as JsonObject
        return CanonicalJson.contentHash(JsonObject(e + ("home" to JsonNull)))
    }
}

/** Distance in metres between two E7 coordinates (equirectangular; fine for the 150 m / 2 km thresholds). */
fun metres(latA: Int, lonA: Int, latB: Int, lonB: Int): Double {
    val lat1 = Math.toRadians(latA / 1e7)
    val lat2 = Math.toRadians(latB / 1e7)
    val dLon = Math.toRadians((lonB - lonA) / 1e7)
    val x = dLon * Math.cos((lat1 + lat2) / 2)
    val y = lat2 - lat1
    return Math.sqrt(x * x + y * y) * 6_371_000.0
}
