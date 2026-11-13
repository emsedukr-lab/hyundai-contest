package io.tteonaljido.car.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import io.tteonaljido.car.R
import io.tteonaljido.car.ui.components.Radius
import io.tteonaljido.car.ui.components.weakFace
import io.tteonaljido.car.ui.theme.Pretendard
import io.tteonaljido.car.ui.theme.Pleos
import io.tteonaljido.trip.SketchDay
import io.tteonaljido.trip.TripSketch

/**
 * The whole trip's route on the next-trip card (M55, the phone's M45 drawing), TOSS.md §5 지도·동선 스케치: the day ahead
 * as a solid `accent` line edged in white with numbered stops, the other days as a `text-disabled` dashed line with
 * dots, lodgings as rings, on a faint inset. No map tiles, nothing leaves the car.
 */
@Composable
fun RouteSketch(sketch: TripSketch, focusDay: Int?, description: String, modifier: Modifier = Modifier) {
    val quiet = colorResource(R.color.tn_text_disabled)
    val dot = colorResource(R.color.tn_text_disabled)
    val accent = colorResource(R.color.tn_accent)
    val card = colorResource(R.color.tn_surface)
    val inset = weakFace()
    val minLabelPx = with(androidx.compose.ui.platform.LocalDensity.current) { Pleos.type.labelSmall.fontSize.toPx() }
    val measurer = rememberTextMeasurer()
    // Numbers are text: `accent-text` keeps them at 4.5:1 on the white circle.
    val label = TextStyle(fontFamily = Pretendard, fontWeight = FontWeight.Bold, color = colorResource(R.color.tn_accent_text), fontFeatureSettings = "tnum")
    Canvas(
        modifier
            .aspectRatio((sketch.width / sketch.height).toFloat())
            .clip(RoundedCornerShape(Radius.r24))
            .background(inset)
            .semantics { contentDescription = description },
    ) {
        val s = (size.width / sketch.width).toFloat()
        fun at(x: Double, y: Double) = Offset((x * s).toFloat(), (y * s).toFloat())
        fun line(d: SketchDay): Path = Path().apply {
            val pts = listOfNotNull(d.from) + d.points
            pts.forEachIndexed { i, p -> val o = at(p.x, p.y); if (i == 0) moveTo(o.x, o.y) else lineTo(o.x, o.y) }
        }
        val others = sketch.days.filter { it.dayIndex != focusDay }
        val focus = sketch.days.firstOrNull { it.dayIndex == focusDay }
        val dash = 4f * s
        others.forEach { d -> drawPath(line(d), quiet, style = Stroke(2f * s, cap = StrokeCap.Round, join = StrokeJoin.Round, pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash, dash)))) }
        others.forEach { d ->
            d.points.forEach { p ->
                if (p.lodging) {
                    drawCircle(inset, 3.5f * s, at(p.x, p.y))
                    drawCircle(dot, 3.5f * s, at(p.x, p.y), style = Stroke(1.5f * s))
                } else drawCircle(dot, 3f * s, at(p.x, p.y), alpha = 0.55f)
            }
        }
        focus?.let { d ->
            // The white edge lifts the day ahead off the quiet lines it crosses.
            drawPath(line(d), card, style = Stroke(4.5f * s, cap = StrokeCap.Round, join = StrokeJoin.Round))
            drawPath(line(d), accent, style = Stroke(2.5f * s, cap = StrokeCap.Round, join = StrokeJoin.Round))
            d.points.forEach { p ->
                val c = at(p.x, p.y)
                if (p.lodging) {
                    drawCircle(inset, 4f * s, c)
                    drawCircle(accent, 4f * s, c, style = Stroke(2f * s))
                } else {
                    val r = maxOf(8f * s, minLabelPx * 0.8f)
                    drawCircle(card, r, c)
                    drawCircle(accent, r, c, style = Stroke(2f * s))
                    // Never under the system's smallest text (Label/Small, 20sp).
                    val text = measurer.measure("${p.n}", label.copy(fontSize = maxOf(10f * s, minLabelPx).toSp()))
                    drawText(text, topLeft = Offset(c.x - text.size.width / 2f, c.y - text.size.height / 2f))
                }
            }
        }
    }
}
