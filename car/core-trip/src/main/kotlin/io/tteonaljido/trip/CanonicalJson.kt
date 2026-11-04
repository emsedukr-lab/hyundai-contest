package io.tteonaljido.trip

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.math.BigDecimal
import java.security.MessageDigest
import java.util.Base64

/**
 * Canonical JSON identical to packages/shared/src/canonical.ts: keys sorted by UTF-16 code units,
 * no whitespace, integers only, strings escaped exactly like JavaScript's JSON.stringify.
 */
object CanonicalJson {
    fun write(e: JsonElement): String = StringBuilder().also { append(it, e) }.toString()

    fun sha256B64url(text: String): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8)))

    fun contentHash(trip: JsonElement): String = sha256B64url(write(trip))

    private fun append(sb: StringBuilder, e: JsonElement) {
        when (e) {
            is JsonNull -> sb.append("null")
            is JsonPrimitive -> when {
                e.isString -> quote(sb, e.content)
                e.content == "true" || e.content == "false" -> sb.append(e.content)
                else -> sb.append(BigDecimal(e.content).longValueExact())
            }
            is JsonArray -> {
                sb.append('[')
                e.forEachIndexed { i, v -> if (i > 0) sb.append(','); append(sb, v) }
                sb.append(']')
            }
            is JsonObject -> {
                sb.append('{')
                e.keys.sorted().forEachIndexed { i, k ->
                    if (i > 0) sb.append(',')
                    quote(sb, k); sb.append(':'); append(sb, e.getValue(k))
                }
                sb.append('}')
            }
        }
    }

    private fun quote(sb: StringBuilder, s: String) {
        sb.append('"')
        var i = 0
        while (i < s.length) {
            val c = s[i]
            when {
                c == '"' -> sb.append("\\\"")
                c == '\\' -> sb.append("\\\\")
                c == '\b' -> sb.append("\\b")
                c == '\u000C' -> sb.append("\\f")
                c == '\n' -> sb.append("\\n")
                c == '\r' -> sb.append("\\r")
                c == '\t' -> sb.append("\\t")
                c < ' ' -> sb.append("\\u").append(c.code.toString(16).padStart(4, '0'))
                c.isHighSurrogate() && i + 1 < s.length && s[i + 1].isLowSurrogate() -> { sb.append(c).append(s[i + 1]); i++ }
                c.isSurrogate() -> sb.append("\\u").append(c.code.toString(16).padStart(4, '0')) // lone surrogate, like JSON.stringify
                else -> sb.append(c)
            }
            i++
        }
        sb.append('"')
    }
}
