@file:OptIn(ExperimentalSerializationApi::class)

package io.tteonaljido.trip

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator

/** Trip transfer schema v1 (schema/trip-transfer.v1.schema.json). Field names are the wire contract. */

@Serializable
data class TripTransfer(
    val schema: String,
    val schemaVersion: Int,
    val exportedAt: String,
    val contentHash: String,
    val trip: Trip,
)

@Serializable
data class Trip(
    val tripId: String,
    val revision: Int,
    val updatedAt: String,
    val name: String,
    val timezone: String,
    val startDate: String,
    val endDate: String,
    val firstDay: FirstDay,
    val origin: Endpoint,
    val finalDestination: Endpoint,
    val home: Home?,
    val places: List<Place>,
    val visits: List<Visit>,
    val days: List<Day>,
)

@Serializable
@JsonClassDiscriminator("basis")
sealed interface FirstDay {
    @Serializable @SerialName("DEPART_ORIGIN")
    data class DepartOrigin(val departTime: String?) : FirstDay // null = no departure time chosen (M48)

    @Serializable @SerialName("ARRIVE_FIRST_STOP")
    data class ArriveFirstStop(val arriveTime: String, val prepMinutes: Int) : FirstDay
}

@Serializable
@JsonClassDiscriminator("kind")
sealed interface Endpoint {
    @Serializable @SerialName("HOME")
    data object Home : Endpoint

    @Serializable @SerialName("PLACE")
    data class AtPlace(val placeRef: String) : Endpoint

    /**
     * Wherever the car is when it leaves (M59): the first day's start when no saved place was chosen. The phone sends no
     * coordinates for it; the car's navigation supplies them on "여기서 출발". Valid as the origin only.
     */
    @Serializable @SerialName("CURRENT")
    data object Current : Endpoint
}

@Serializable
data class Home(val address: String, val latE7: Int, val lonE7: Int)

@Serializable
enum class PlaceCategory { SIGHT, FOOD, CAFE, LODGING, OTHER }

@Serializable
enum class Importance { MUST, NORMAL, OPTIONAL }

@Serializable
enum class UnassignedReason { NOT_SCHEDULED_YET, NO_TIME, OUTSIDE_PERIOD, CLOSED, USER_EXCLUDED }

@Serializable
data class Place(
    val placeRef: String,
    val name: String,
    val address: String,
    /** Null when the place was added by name only; the car then finds it in its navigation. */
    val latE7: Int?,
    val lonE7: Int?,
    val category: PlaceCategory,
    val source: Source,
    val naviPoi: NaviPoi?,
    val hours: OpeningHours,
)

@Serializable
data class Source(val provider: Provider, val externalId: String?) {
    @Serializable enum class Provider { KAKAO, MANUAL }
}

@Serializable
data class NaviPoi(val poiId: String, val poiSubId: String, val poiProvider: String)

@Serializable
@JsonClassDiscriminator("status")
sealed interface OpeningHours {
    @Serializable @SerialName("UNKNOWN")
    data object Unknown : OpeningHours

    /** A place with no opening hours of its own — a lake, a beach, a street (M59): nothing to check before a visit. */
    @Serializable @SerialName("ALWAYS_OPEN")
    data object AlwaysOpen : OpeningHours

    @Serializable @SerialName("USER_ENTERED")
    data class UserEntered(val weekly: List<Weekly>, val closedDates: List<String>) : OpeningHours

    @Serializable
    data class Weekly(val weekday: Int, val open: String, val close: String)
}

@Serializable
data class Visit(
    val visitId: String,
    val placeRef: String,
    val stayMinutes: Int,
    /** Parking time from the phone (0..120). Kept for transfer schema v1; not used in any time math (M42). */
    val prepMinutes: Int,
    val importance: Importance,
    val desiredTime: String?,
    val fixed: Fixed?,
    val dateFlexible: Boolean,
    val timeFlexible: Boolean,
    val unassignedReason: UnassignedReason?,
) {
    @Serializable
    data class Fixed(val time: String, val kind: Kind) {
        @Serializable enum class Kind { RESERVATION, USER }
    }
}

@Serializable
data class Leg(val minutes: Int, val source: LegSource) {
    @Serializable enum class LegSource { USER_ESTIMATE }
}

@Serializable
data class Day(
    val dayIndex: Int,
    val date: String,
    val departTime: String?,
    val endBy: String?,
    val visitOrder: List<String>,
    val legs: List<Leg?>,
    val lodgingPlaceRef: String?,
)
