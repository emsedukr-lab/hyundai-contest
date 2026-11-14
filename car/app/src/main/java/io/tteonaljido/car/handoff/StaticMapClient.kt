package io.tteonaljido.car.handoff

import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import io.tteonaljido.trip.MapMarker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * The real map on the next-trip card: Kakao's static map, fetched through our relay (the Kakao key stays on the server)
 * with only the few places to mark and the picture size. Kakao's terms do not allow keeping a static map for a later
 * visit — not even on the device — so nothing here is written to disk or kept in a long-lived cache: the picture lives
 * in the screen's own state while it is open, and the next visit asks again. No network, no key, any error: null, and
 * the card keeps its drawn sketch.
 */
class StaticMapClient(private val base: String, private val http: OkHttpClient = PairingClient.defaultClient()) {
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    suspend fun fetch(markers: List<MapMarker>, width: Int, height: Int): ImageBitmap? = withContext(Dispatchers.IO) {
        if (markers.isEmpty()) return@withContext null
        val points = markers.joinToString(",") { """{"latE7":${it.latE7},"lonE7":${it.lonE7}}""" }
        val body = """{"points":[$points],"width":$width,"height":$height}""".toRequestBody(jsonType)
        val req = Request.Builder().url("$base/api/v1/maps/static").post(body).build()
        runCatching {
            http.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return@use null
                val bytes = res.body?.bytes() ?: return@use null
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
            }
        }.getOrNull()
    }

    companion object {
        /** The card's map box is 300 × 240 (5 : 4); the picture is asked for at twice that so it stays sharp on the car's display. */
        const val WIDTH = 600
        const val HEIGHT = 480
    }
}
