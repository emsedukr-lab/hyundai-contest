package io.tteonaljido.pairing

import java.math.BigInteger
import java.security.AlgorithmParameters
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.PublicKey
import java.security.SecureRandom
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPrivateKeySpec
import java.security.spec.ECPublicKeySpec
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * End-to-end crypto for one handoff, mirroring packages/shared/src/crypto.ts:
 * P-256 ECDH -> HKDF-SHA256 -> AES-256-GCM, plus the 6-digit confirmation code both screens show.
 * Uses only java.security APIs available on Android API 28.
 */
object HandoffCrypto {
    private const val SALT_PREFIX = "handoff/v1|"
    private const val AAD_PREFIX = "handoff/v1|"
    const val ID_BYTES = 16
    private val random = SecureRandom()

    val P256: ECParameterSpec by lazy {
        AlgorithmParameters.getInstance("EC").apply { init(ECGenParameterSpec("secp256r1")) }.getParameterSpec(ECParameterSpec::class.java)
    }

    fun b64url(bytes: ByteArray): String = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    fun fromB64url(s: String): ByteArray = Base64.getUrlDecoder().decode(s)
    fun randomBytes(n: Int) = ByteArray(n).also(random::nextBytes)
    fun sha256(b: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(b)

    fun generateKeyPair(): KeyPair = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1"), random) }.generateKeyPair()

    /** Uncompressed point 0x04 || X || Y (65 bytes), same as WebCrypto `exportKey('raw')`. */
    fun publicRaw(key: PublicKey): ByteArray {
        val w = (key as ECPublicKey).w
        return byteArrayOf(4) + fixed32(w.affineX) + fixed32(w.affineY)
    }

    fun publicFromRaw(raw: ByteArray): PublicKey {
        require(raw.size == 65 && raw[0] == 4.toByte()) { "expected uncompressed P-256 point" }
        val x = BigInteger(1, raw.copyOfRange(1, 33))
        val y = BigInteger(1, raw.copyOfRange(33, 65))
        require(onCurve(x, y)) { "point is not on P-256" }
        return KeyFactory.getInstance("EC").generatePublic(ECPublicKeySpec(ECPoint(x, y), P256))
    }

    /** 32-byte private scalar, for encrypted persistence of the session key across an app restart. */
    fun privateScalar(key: PrivateKey): ByteArray = fixed32((key as java.security.interfaces.ECPrivateKey).s)

    fun privateFromScalar(d: ByteArray): PrivateKey = KeyFactory.getInstance("EC").generatePrivate(ECPrivateKeySpec(BigInteger(1, d), P256))

    /** First 16 bytes of SHA-256(publicRaw), printed in the QR so the phone can verify the car's key. */
    fun fingerprint(publicRaw: ByteArray): String = b64url(sha256(publicRaw).copyOf(16))

    fun sharedSecret(own: PrivateKey, peer: PublicKey): ByteArray =
        KeyAgreement.getInstance("ECDH").apply { init(own); doPhase(peer, true) }.generateSecret()

    data class SessionKeys(val key: ByteArray, val confirmCode: String)

    fun deriveSessionKeys(z: ByteArray, sid: String, carPub: ByteArray, mobilePub: ByteArray): SessionKeys {
        val salt = sha256((SALT_PREFIX + sid).toByteArray())
        val key = hkdf(z, salt, info("key", carPub, mobilePub), 32)
        val c = hkdf(z, salt, info("confirm", carPub, mobilePub), 4)
        val n = ((c[0].toLong() and 0xff) shl 24) or ((c[1].toLong() and 0xff) shl 16) or ((c[2].toLong() and 0xff) shl 8) or (c[3].toLong() and 0xff)
        return SessionKeys(key, (n % 1_000_000).toString().padStart(6, '0'))
    }

    fun formatConfirmCode(code: String) = "${code.take(3)} ${code.drop(3)}"

    /** QR link: secrets live in the fragment, which browsers never send to a server. */
    fun qrUrl(origin: String, sid: String, scanSecret: String, fingerprint: String) = "${origin.trimEnd('/')}/c#v1.$sid.$scanSecret.$fingerprint"

    fun aad(sid: String, schemaVersion: Int) = "$AAD_PREFIX$sid|$schemaVersion".toByteArray()

    fun encrypt(key: ByteArray, plaintext: ByteArray, aad: ByteArray, iv: ByteArray = randomBytes(12)): Pair<String, String> {
        val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, iv)); updateAAD(aad) }
        return b64url(iv) to b64url(c.doFinal(plaintext))
    }

    fun decrypt(key: ByteArray, iv: String, ct: String, aad: ByteArray): ByteArray {
        val c = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, fromB64url(iv))); updateAAD(aad)
        }
        return c.doFinal(fromB64url(ct))
    }

    /** RFC 5869 HKDF with HMAC-SHA256. */
    fun hkdf(ikm: ByteArray, salt: ByteArray, info: ByteArray, length: Int): ByteArray {
        val prk = hmac(if (salt.isEmpty()) ByteArray(32) else salt, ikm)
        val out = java.io.ByteArrayOutputStream()
        var t = ByteArray(0)
        var i = 1
        while (out.size() < length) {
            t = hmac(prk, t + info + byteArrayOf(i.toByte()))
            out.write(t)
            i++
        }
        return out.toByteArray().copyOf(length)
    }

    private fun hmac(key: ByteArray, data: ByteArray): ByteArray = Mac.getInstance("HmacSHA256").apply { init(SecretKeySpec(key, "HmacSHA256")) }.doFinal(data)

    private fun info(label: String, carPub: ByteArray, mobilePub: ByteArray) = label.toByteArray() + byteArrayOf(0) + carPub + mobilePub

    private fun fixed32(v: BigInteger): ByteArray {
        val b = v.toByteArray()
        return when {
            b.size == 32 -> b
            b.size > 32 -> b.copyOfRange(b.size - 32, b.size)
            else -> ByteArray(32 - b.size) + b
        }
    }

    private fun onCurve(x: BigInteger, y: BigInteger): Boolean {
        val p = (P256.curve.field as java.security.spec.ECFieldFp).p
        if (x.signum() < 0 || x >= p || y.signum() < 0 || y >= p) return false
        val rhs = x.pow(3).add(P256.curve.a.multiply(x)).add(P256.curve.b).mod(p)
        return y.pow(2).mod(p) == rhs
    }
}
