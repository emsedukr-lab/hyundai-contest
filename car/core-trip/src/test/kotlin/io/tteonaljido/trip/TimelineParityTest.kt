package io.tteonaljido.trip

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** The phone's timetable (packages/shared/src/timeline.ts) must give the car's answers: schema/fixtures/timeline. */
class TimelineParityTest {
    private val schemaDir = File(System.getProperty("schemaDir"))
    private val expected = Json.parseToJsonElement(File(schemaDir, "fixtures/timeline-expectations.json").readText()).jsonObject
    private val dayCodes = setOf(
        "FIRST_DEPARTURE_UNKNOWN", "DEPARTURE_UNKNOWN", "DEPART_PREVIOUS_DAY", "LEG_UNKNOWN", "LATE_FOR_FIXED",
        "FIXED_UNCHECKED", "CLOSED_DATE", "CLOSED_WEEKDAY", "OUTSIDE_HOURS", "PAST_END_BY",
    )

    private fun intOrNull(e: kotlinx.serialization.json.JsonElement?) = if (e == null || e is JsonNull) null else e.jsonPrimitive.int

    @Test fun everyCaseMatchesTheCar() {
        assertTrue("timeline cases present", expected.size >= 6)
        for ((name, days) in expected) {
            val trip = (TransferParser.parse(File(schemaDir, "fixtures/timeline/$name.json").readText()) as ParseResult.Ok).transfer.trip
            val report = TripValidator.validate(trip)
            for (d in (days as JsonArray).map { it.jsonObject }) {
                val n = d.getValue("dayIndex").jsonPrimitive.int
                val at = "$name day $n"
                assertEquals("$at departure", intOrNull(d["departure"]), TripValidator.departure(trip, n))
                val stops = TripValidator.timeline(trip, n)
                val want = d.getValue("stops").jsonArray.map { it.jsonObject }
                assertEquals("$at stop count", want.size, stops.size)
                want.zip(stops).forEach { (w, s) ->
                    assertEquals("$at ${s.visitId}", w.getValue("visitId").jsonPrimitive.content, s.visitId)
                    assertEquals("$at ${s.visitId} arrive", intOrNull(w["arrive"]), s.arrive)
                    assertEquals("$at ${s.visitId} start", intOrNull(w["start"]), s.start)
                    assertEquals("$at ${s.visitId} end", intOrNull(w["end"]), s.end)
                }
                assertEquals("$at day end", intOrNull(d["dayEnd"]), TripValidator.dayEnd(trip, n))
                val issues = report.issues.filter { it.dayIndex == n && it.code in dayCodes }
                    .map { listOf(it.severity.name, it.code, it.dayIndex.toString()) + it.args }
                val wantIssues = d.getValue("issues").jsonArray.map { it.jsonObject }.map { i ->
                    listOf(i.getValue("severity").jsonPrimitive.content, i.getValue("code").jsonPrimitive.content, i.getValue("dayIndex").jsonPrimitive.int.toString()) +
                        i.getValue("args").jsonArray.map { it.jsonPrimitive.content }
                }
                assertEquals("$at issues", wantIssues, issues)
            }
        }
    }
}
