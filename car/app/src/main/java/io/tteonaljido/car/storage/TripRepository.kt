package io.tteonaljido.car.storage

import android.util.AtomicFile
import io.tteonaljido.trip.LocalTrip
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Imported trips, one encrypted file each, written atomically. Real and demo data never mix.
 * A file that cannot be read is kept untouched and reported, never silently replaced.
 */
class TripRepository(root: File, demo: Boolean, private val box: SecureBox) {
    private val dir = File(root, if (demo) "demo/trips" else "real/trips").apply { mkdirs() }
    private val json = Json { ignoreUnknownKeys = false; encodeDefaults = true }

    data class Loaded(val trips: List<LocalTrip>, val unreadable: List<String>)

    @Synchronized
    fun load(): Loaded {
        val ok = mutableListOf<LocalTrip>()
        val bad = mutableListOf<String>()
        dir.listFiles { f -> f.name.endsWith(".trip") }?.forEach { f ->
            runCatching { json.decodeFromString(LocalTrip.serializer(), box.open(AtomicFile(f).readFully()).decodeToString()) }
                .onSuccess(ok::add)
                .onFailure { bad += f.name }
        }
        return Loaded(ok.sortedBy { it.plan.startDate }, bad)
    }

    @Synchronized
    fun save(trip: LocalTrip) {
        val file = AtomicFile(File(dir, "${trip.localId}.trip"))
        val out = file.startWrite()
        try {
            out.write(box.seal(json.encodeToString(LocalTrip.serializer(), trip).encodeToByteArray()))
            file.finishWrite(out)
        } catch (e: Exception) {
            file.failWrite(out)
            throw e
        }
    }

    @Synchronized
    fun delete(localId: String) = AtomicFile(File(dir, "$localId.trip")).delete()

    @Synchronized
    fun deleteAll() = dir.listFiles()?.forEach { it.delete() }
}
