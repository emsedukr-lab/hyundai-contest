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
)

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
    /** User re-set the first-day origin in the car ("여기서 출발"). */
    val originOverride: NaviBinding? = null,
    val poiBindings: Map<String, NaviBinding> = emptyMap(),
    val visited: Set<String> = emptySet(),
    /** When and how each visit was marked done (visitId → stamp). */
    val visitedAt: Map<String, VisitStamp> = emptyMap(),
    /** Stops the driver chose to skip in the car; the plan itself is unchanged. */
    val skipped: Set<String> = emptySet(),
    /** Travel times measured by the car's navigation, keyed by [LegKeys] ("from>to"). Used only where the plan has none. */
    val legEstimates: Map<String, LegEstimate> = emptyMap(),
    /** What this app last handed to the navigation, so its arrival event can be matched to a stop. */
    val guiding: GuidingTarget? = null,
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
