package io.tteonaljido.trip

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class TransferParityTest {
    private val schemaDir = File(System.getProperty("schemaDir"))
    private fun read(rel: String) = File(schemaDir, rel).readText()

    @Test fun everyFixtureMatchesTheTypeScriptVerdict() {
        val expectations = Json.parseToJsonElement(read("fixtures/expectations.json")).jsonObject
        assertTrue(expectations.size >= 20)
        val mismatches = expectations.mapNotNull { (file, want) ->
            val w = want.jsonObject
            val got = TransferParser.parse(read("fixtures/$file"))
            val expected = if (w.getValue("valid").jsonPrimitive.boolean) "OK" else w.getValue("code").jsonPrimitive.content
            val actual = when (got) { is ParseResult.Ok -> "OK"; is ParseResult.Rejected -> got.code.name }
            if (expected != actual) "$file: expected $expected got $actual (${(got as? ParseResult.Rejected)?.detail})" else null
        }
        assertEquals(emptyList<String>(), mismatches)
    }

    @Test fun canonicalHashMatchesTypeScriptForUnicodeEdgeCases() {
        val root = Json.parseToJsonElement(read("fixtures/valid/unicode.json")) as JsonObject
        val hash = root.getValue("contentHash").jsonPrimitive.content
        assertEquals(hash, CanonicalJson.contentHash(root.getValue("trip")))
    }

    @Test fun reEncodedDtoHashesTheSame() {
        val ok = TransferParser.parse(read("fixtures/valid/with-home.json")) as ParseResult.Ok
        assertEquals(ok.transfer.contentHash, CanonicalJson.contentHash(TransferParser.tripElement(ok.transfer.trip)))
    }

    @Test fun canonicalOrderingAndEscaping() {
        val e = Json.parseToJsonElement("""{"b":1,"a":[true,null,"x"],"가":"\"\n","A":{"z":0,"y":-2}}""")
        assertEquals("""{"A":{"y":-2,"z":0},"a":[true,null,"x"],"b":1,"가":"\"\n"}""".replace("\n", "\\n"), CanonicalJson.write(e))
    }
}
