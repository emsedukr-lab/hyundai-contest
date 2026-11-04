package io.tteonaljido.car.storage

import android.util.AtomicFile
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Survives an app kill during a handoff: the session token and the car's ephemeral private key (encrypted),
 * plus a result the server has not acknowledged yet. Cleared as soon as the session ends.
 */
@Serializable
data class ActiveSession(
    val sid: String,
    val carToken: String,
    val privateScalar: String,
    val carPub: String,
    val qrUrl: String,
    val createdAt: Long,
)

@Serializable
data class PendingResult(val sid: String, val carToken: String, val outcome: String, val resultCode: String, val appliedRevision: Int?)

class SessionStore(root: File, private val box: SecureBox) {
    private val dir = File(root, "handoff").apply { mkdirs() }
    private val json = Json { ignoreUnknownKeys = true }
    private val active = AtomicFile(File(dir, "active.bin"))
    private val pending = AtomicFile(File(dir, "pending.bin"))

    private fun write(f: AtomicFile, text: String) {
        val out = f.startWrite()
        try { out.write(box.seal(text.encodeToByteArray())); f.finishWrite(out) } catch (e: Exception) { f.failWrite(out); throw e }
    }
    private fun read(f: AtomicFile): String? = runCatching { box.open(f.readFully()).decodeToString() }.getOrNull()

    fun saveActive(s: ActiveSession) = write(active, json.encodeToString(ActiveSession.serializer(), s))
    fun loadActive(): ActiveSession? = read(active)?.let { runCatching { json.decodeFromString(ActiveSession.serializer(), it) }.getOrNull() }
    fun clearActive() = active.delete()

    fun savePending(p: PendingResult) = write(pending, json.encodeToString(PendingResult.serializer(), p))
    fun loadPending(): PendingResult? = read(pending)?.let { runCatching { json.decodeFromString(PendingResult.serializer(), it) }.getOrNull() }
    fun clearPending() = pending.delete()
}
