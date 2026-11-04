package io.tteonaljido.pairing

import io.tteonaljido.pairing.HandoffCrypto.b64url
import io.tteonaljido.pairing.HandoffCrypto.fromB64url
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test
import java.io.File

class HandoffCryptoTest {
    private val schemaDir = File(System.getProperty("schemaDir"))
    private val v = Json.parseToJsonElement(File(schemaDir, "fixtures/crypto/vectors.json").readText()).jsonObject
    private fun s(o: JsonObject, k: String) = o.getValue(k).jsonPrimitive.content
    private val car = v.getValue("car").jsonObject
    private val mobile = v.getValue("mobile").jsonObject

    @Test fun reproducesTypeScriptVectors() {
        val carPub = fromB64url(s(car, "publicRaw"))
        val mobilePub = fromB64url(s(mobile, "publicRaw"))
        val carPriv = HandoffCrypto.privateFromScalar(fromB64url(s(car, "d")))
        val z = HandoffCrypto.sharedSecret(carPriv, HandoffCrypto.publicFromRaw(mobilePub))
        assertEquals(s(v, "sharedSecret"), b64url(z))
        assertEquals(s(car, "fingerprint"), HandoffCrypto.fingerprint(carPub))
        val keys = HandoffCrypto.deriveSessionKeys(z, s(v, "sid"), carPub, mobilePub)
        assertEquals(s(v, "key"), b64url(keys.key))
        assertEquals(s(v, "confirmCode"), keys.confirmCode)

        val plain = HandoffCrypto.decrypt(keys.key, s(v, "iv"), s(v, "ciphertext"), HandoffCrypto.aad(s(v, "sid"), 1))
        assertEquals(s(v, "plaintextSha256"), b64url(HandoffCrypto.sha256(plain)))
        val (_, ct) = HandoffCrypto.encrypt(keys.key, plain, HandoffCrypto.aad(s(v, "sid"), 1), fromB64url(s(v, "iv")))
        assertEquals(s(v, "ciphertext"), ct)
    }

    @Test fun publicKeyRawRoundTrip() {
        val kp = HandoffCrypto.generateKeyPair()
        val raw = HandoffCrypto.publicRaw(kp.public)
        assertEquals(65, raw.size)
        assertArrayEquals(raw, HandoffCrypto.publicRaw(HandoffCrypto.publicFromRaw(raw)))
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsPointOffTheCurve() {
        val raw = fromB64url(s(mobile, "publicRaw")).also { it[64] = (it[64] + 1).toByte() }
        HandoffCrypto.publicFromRaw(raw)
    }

    @Test(expected = javax.crypto.AEADBadTagException::class)
    fun ciphertextIsBoundToItsSession() {
        HandoffCrypto.decrypt(fromB64url(s(v, "key")), s(v, "iv"), s(v, "ciphertext"), HandoffCrypto.aad("another-session-id-000", 1))
    }

    @Test fun freshPartiesAgreeAndAnInterceptorDoesNot() {
        val a = HandoffCrypto.generateKeyPair(); val b = HandoffCrypto.generateKeyPair(); val m = HandoffCrypto.generateKeyPair()
        val ap = HandoffCrypto.publicRaw(a.public); val bp = HandoffCrypto.publicRaw(b.public); val mp = HandoffCrypto.publicRaw(m.public)
        val k1 = HandoffCrypto.deriveSessionKeys(HandoffCrypto.sharedSecret(a.private, b.public), "s", ap, bp)
        val k2 = HandoffCrypto.deriveSessionKeys(HandoffCrypto.sharedSecret(b.private, a.public), "s", ap, bp)
        val km = HandoffCrypto.deriveSessionKeys(HandoffCrypto.sharedSecret(a.private, m.public), "s", ap, mp)
        assertEquals(k1.confirmCode, k2.confirmCode)
        assertArrayEquals(k1.key, k2.key)
        assertNotEquals(b64url(k1.key), b64url(km.key))
    }

    /** RFC 5869 test case 1. */
    @Test fun hkdfMatchesRfc5869() {
        fun hex(s: String) = s.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
        val okm = HandoffCrypto.hkdf(hex("0b".repeat(22)), hex("000102030405060708090a0b0c"), hex("f0f1f2f3f4f5f6f7f8f9"), 42)
        assertArrayEquals(hex("3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865"), okm)
    }
}
