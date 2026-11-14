package io.tteonaljido.car.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import io.tteonaljido.car.BuildConfig
import io.tteonaljido.car.handoff.StaticMapClient
import io.tteonaljido.car.ui.components.Radius
import io.tteonaljido.trip.MapMarker

private val client by lazy { StaticMapClient(BuildConfig.API_BASE) }

/**
 * The next-trip card's route picture as a real Kakao map with the trip's places marked, in the same 5 : 4 box as the
 * drawn sketch. The picture is fetched while this is on screen and held only in this composition (Kakao's terms rule
 * out keeping it); until it arrives, or when there is no network, [fallback] — the drawn sketch — is what shows. The
 * map is shown as Kakao gives it, with its logo.
 */
@Composable
fun TripMapPreview(markers: List<MapMarker>, description: String, modifier: Modifier = Modifier, fallback: @Composable (Modifier) -> Unit) {
    var map by remember(markers) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(markers) { map = client.fetch(markers, StaticMapClient.WIDTH, StaticMapClient.HEIGHT) }
    val bitmap = map
    if (bitmap == null) fallback(modifier)
    else Image(
        bitmap, null,
        modifier.aspectRatio(StaticMapClient.WIDTH / StaticMapClient.HEIGHT.toFloat()).clip(RoundedCornerShape(Radius.r24)).semantics { this.contentDescription = description },
        contentScale = ContentScale.Fit,
    )
}
