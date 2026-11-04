package io.tteonaljido.trip

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull
import java.time.LocalDate

/**
 * Decodes and checks an incoming transfer. Produces the same first error code as
 * packages/shared/src/integrity.ts for every fixture in schema/fixtures (see TransferParityTest).
 */
enum class IntegrityCode {
    TOO_LARGE, SCHEMA, UNSUPPORTED_VERSION, DATE_RANGE, DAY_COUNT_MISMATCH, DAY_SEQUENCE, DUPLICATE_REF,
    UNKNOWN_PLACE_REF, UNKNOWN_VISIT_REF, DUPLICATE_ASSIGNMENT, LEGS_LENGTH, UNASSIGNED_REASON_MISMATCH, HASH_MISMATCH,
}

sealed interface ParseResult {
    data class Ok(val transfer: TripTransfer) : ParseResult
    data class Rejected(val code: IntegrityCode, val detail: String = "") : ParseResult
}

object TransferParser {
    const val MAX_PLAINTEXT_BYTES = 98_304
    val SUPPORTED_SCHEMA_VERSIONS = listOf(1)

    private val json = Json { ignoreUnknownKeys = false; isLenient = false; explicitNulls = true; coerceInputValues = false }

    fun parse(text: String): ParseResult {
        if (text.toByteArray(Charsets.UTF_8).size > MAX_PLAINTEXT_BYTES) return ParseResult.Rejected(IntegrityCode.TOO_LARGE)
        val root = try { json.parseToJsonElement(text) } catch (e: Exception) { return ParseResult.Rejected(IntegrityCode.SCHEMA, "json") }
        val obj = root as? JsonObject ?: return ParseResult.Rejected(IntegrityCode.SCHEMA, "root")
        val version = (obj["schemaVersion"] as? JsonPrimitive)?.takeIf { !it.isString }?.intOrNull
        if ((obj["schema"] as? JsonPrimitive)?.content == "trip-transfer" && version != null && version != 1) {
            return ParseResult.Rejected(IntegrityCode.UNSUPPORTED_VERSION, "$version")
        }
        val transfer = try { json.decodeFromJsonElement(TripTransfer.serializer(), obj) } catch (e: Exception) {
            return ParseResult.Rejected(IntegrityCode.SCHEMA, e.message?.take(120) ?: "decode")
        }
        SchemaRules.violation(transfer)?.let { return ParseResult.Rejected(IntegrityCode.SCHEMA, it) }
        TransferIntegrity.check(transfer.trip)?.let { return it }
        if (CanonicalJson.contentHash(obj.getValue("trip")) != transfer.contentHash) return ParseResult.Rejected(IntegrityCode.HASH_MISMATCH)
        return ParseResult.Ok(transfer)
    }

    fun encode(transfer: TripTransfer): String = json.encodeToString(TripTransfer.serializer(), transfer)

    fun tripElement(trip: Trip): JsonElement = json.encodeToJsonElement(Trip.serializer(), trip)
}

/** Value rules that zod enforces but kotlinx.serialization cannot express (formats, ranges, sizes). */
internal object SchemaRules {
    private val DATE = Regex("""^\d{4}-\d{2}-\d{2}$""")
    private val TIME = Regex("""^([01]\d|2[0-3]):[0-5]\d$""")
    private val REF = Regex("""^[A-Za-z0-9_-]{1,40}$""")
    private val UUID = Regex("""^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$""")
    private val DATETIME = Regex("""^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$""")
    private val TZ = Regex("""^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$""")
    private val HASH = Regex("""^[A-Za-z0-9_-]{43}$""")

    private fun date(s: String) = DATE.matches(s) && runCatching { LocalDate.parse(s) }.isSuccess
    private fun lat(v: Int) = v in -900_000_000..900_000_000
    private fun lon(v: Int) = v in -1_800_000_000..1_800_000_000

    fun violation(t: TripTransfer): String? {
        val r = mutableListOf<Pair<Boolean, String>>()
        fun need(ok: Boolean, what: String) { r += ok to what }
        need(t.schema == "trip-transfer", "schema")
        need(t.schemaVersion == 1, "schemaVersion")
        need(DATETIME.matches(t.exportedAt), "exportedAt")
        need(HASH.matches(t.contentHash), "contentHash")
        val trip = t.trip
        need(UUID.matches(trip.tripId), "tripId")
        need(trip.revision >= 1, "revision")
        need(DATETIME.matches(trip.updatedAt), "updatedAt")
        need(trip.name.length in 1..60, "name")
        need(TZ.matches(trip.timezone) && trip.timezone.length <= 40, "timezone")
        need(date(trip.startDate) && date(trip.endDate), "dates")
        when (val f = trip.firstDay) {
            is FirstDay.DepartOrigin -> need(TIME.matches(f.departTime), "firstDay")
            is FirstDay.ArriveFirstStop -> need(TIME.matches(f.arriveTime) && f.prepMinutes in 0..240, "firstDay")
        }
        listOf(trip.origin, trip.finalDestination).forEach { if (it is Endpoint.AtPlace) need(REF.matches(it.placeRef), "endpoint") }
        trip.home?.let { need(it.address.length in 1..120 && lat(it.latE7) && lon(it.lonE7), "home") }
        need(trip.places.size <= 100 && trip.visits.size <= 100 && trip.days.size in 1..14, "sizes")
        trip.places.forEach { p ->
            need(REF.matches(p.placeRef) && p.name.length in 1..60 && p.address.length <= 120 && lat(p.latE7) && lon(p.lonE7), "place")
            need((p.source.externalId?.length ?: 0) <= 40, "place.source")
            p.naviPoi?.let { need(it.poiId.length in 1..40 && it.poiSubId.length <= 40 && it.poiProvider.length in 1..40, "naviPoi") }
            (p.hours as? OpeningHours.UserEntered)?.let { h ->
                need(h.weekly.size <= 21 && h.closedDates.size <= 31, "hours")
                h.weekly.forEach { w -> need(w.weekday in 1..7 && TIME.matches(w.open) && TIME.matches(w.close), "hours.weekly") }
                h.closedDates.forEach { need(date(it), "hours.closedDates") }
            }
        }
        trip.visits.forEach { v ->
            need(REF.matches(v.visitId) && REF.matches(v.placeRef), "visit.ref")
            need(v.stayMinutes in 0..720 && v.prepMinutes in 0..120, "visit.minutes")
            need(v.desiredTime?.let(TIME::matches) ?: true, "visit.desiredTime")
            need(v.fixed?.let { TIME.matches(it.time) } ?: true, "visit.fixed")
        }
        trip.days.forEach { d ->
            need(d.dayIndex in 1..14 && date(d.date), "day")
            need(d.departTime?.let(TIME::matches) ?: true, "day.departTime")
            need(d.endBy?.let(TIME::matches) ?: true, "day.endBy")
            need(d.visitOrder.size <= 20 && d.visitOrder.all(REF::matches), "day.visitOrder")
            need(d.legs.size <= 21 && d.legs.all { it == null || it.minutes in 0..1440 }, "day.legs")
            need(d.lodgingPlaceRef?.let(REF::matches) ?: true, "day.lodging")
        }
        return r.firstOrNull { !it.first }?.second
    }
}

internal object TransferIntegrity {
    fun check(trip: Trip): ParseResult.Rejected? {
        fun no(code: IntegrityCode, detail: String) = ParseResult.Rejected(code, detail)
        val start = LocalDate.parse(trip.startDate)
        val span = LocalDate.parse(trip.endDate).toEpochDay() - start.toEpochDay()
        if (span < 0) return no(IntegrityCode.DATE_RANGE, "${trip.startDate} > ${trip.endDate}")
        if (trip.days.size.toLong() != span + 1) return no(IntegrityCode.DAY_COUNT_MISMATCH, "${trip.days.size} != ${span + 1}")
        trip.days.forEachIndexed { i, d ->
            if (d.dayIndex != i + 1 || d.date != start.plusDays(i.toLong()).toString()) return no(IntegrityCode.DAY_SEQUENCE, "day ${i + 1}")
        }
        val places = HashSet<String>()
        trip.places.forEach { if (!places.add(it.placeRef)) return no(IntegrityCode.DUPLICATE_REF, it.placeRef) }
        val visits = HashSet<String>()
        trip.visits.forEach { if (!visits.add(it.visitId)) return no(IntegrityCode.DUPLICATE_REF, it.visitId) }

        val placeRefs = trip.visits.map { it.placeRef } +
            trip.days.mapNotNull { it.lodgingPlaceRef } +
            listOf(trip.origin, trip.finalDestination).filterIsInstance<Endpoint.AtPlace>().map { it.placeRef }
        placeRefs.forEach { if (it !in places) return no(IntegrityCode.UNKNOWN_PLACE_REF, it) }

        trip.days.forEach { d -> d.visitOrder.forEach { if (it !in visits) return no(IntegrityCode.UNKNOWN_VISIT_REF, it) } }
        val assigned = HashSet<String>()
        trip.days.forEach { d -> d.visitOrder.forEach { if (!assigned.add(it)) return no(IntegrityCode.DUPLICATE_ASSIGNMENT, it) } }
        trip.days.forEach { d -> if (d.legs.size != d.visitOrder.size + 1) return no(IntegrityCode.LEGS_LENGTH, "day ${d.dayIndex}") }
        trip.visits.forEach { v ->
            if ((v.visitId in assigned) == (v.unassignedReason != null)) return no(IntegrityCode.UNASSIGNED_REASON_MISMATCH, v.visitId)
        }
        return null
    }
}
