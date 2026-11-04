package io.tteonaljido.car.handoff

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.common.BitMatrix
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import io.tteonaljido.car.R
import io.tteonaljido.car.ui.components.PleosText
import io.tteonaljido.car.ui.theme.Pleos

const val QUIET_ZONE = 4
const val MIN_PX_PER_MODULE = 6

/** Plain QR for reliable scanning (spec 24-7): ECC M, 4-module quiet zone, no logo or effects. */
fun encodeQr(text: String): BitMatrix =
    QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0, mapOf(EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M, EncodeHintType.MARGIN to QUIET_ZONE))

/**
 * Drawn with a whole number of pixels per module so no module is blurred by scaling, always black on a
 * static white ground in day and night themes. If the window is too small to keep 6 px per module,
 * it says so instead of showing an unreadable code.
 */
@Composable
fun QrImage(text: String, maxSize: Dp, modifier: Modifier = Modifier) {
    val matrix = remember(text) { encodeQr(text) }
    val density = LocalDensity.current
    BoxWithConstraints(modifier, contentAlignment = Alignment.Center) {
        val availablePx = with(density) { minOf(maxSize, maxWidth, maxHeight).toPx() }
        val px = (availablePx / matrix.width).toInt()
        if (px < MIN_PX_PER_MODULE) {
            PleosText("창을 넓혀 주세요 · QR을 읽기 어려운 크기예요", Pleos.type.bodyMedium)
            return@BoxWithConstraints
        }
        val side = with(density) { (px * matrix.width).toDp() }
        val white = colorResource(R.color.pleos_static_light_100)
        val black = colorResource(R.color.pleos_static_dark_100)
        Box(Modifier.size(side).background(white).semantics { contentDescription = "연결 QR코드" }) {
            Canvas(Modifier.size(side)) {
                for (y in 0 until matrix.height) for (x in 0 until matrix.width) {
                    if (matrix[x, y]) drawRect(black, Offset((x * px).toFloat(), (y * px).toFloat()), Size(px.toFloat(), px.toFloat()))
                }
            }
        }
    }
}
