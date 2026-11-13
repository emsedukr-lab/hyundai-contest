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
)

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
    /** Travel times measured by the car's navigation, keyed by [LegKeys] ("from>to"). Used only where the plan has none. */
    val legEstimates: Map<String, LegEstimate> = emptyMap(),
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

/** A leg's travel time as the navigation estimated it from the car's position (`requestTrip`), never typed or guessed. */
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
