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

@Serializable
data class CarOverlay(
    /** Home confirmed from the navigation's HOME bookmark, used when the payload carried no home address. */
    val home: NaviBinding? = null,
    /** User re-set the first-day origin in the car. */
    val originOverride: NaviBinding? = null,
    val poiBindings: Map<String, NaviBinding> = emptyMap(),
    val visited: Set<String> = emptySet(),
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
