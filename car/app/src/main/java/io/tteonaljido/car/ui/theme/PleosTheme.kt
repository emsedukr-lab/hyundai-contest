package io.tteonaljido.car.ui.theme

import android.content.Context
import androidx.annotation.StyleRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import io.tteonaljido.car.R

/**
 * Pleos typography read from the generated TextAppearance.Pleos.* styles (design/android-res), so sizes and
 * line heights come from the official 2.1.5 assets instead of being re-typed here. Colors and dimensions are
 * used directly as @color/pleos_* and @dimen/pleos_* resources; night mode switches them automatically.
 */
@OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
private fun weight(w: Int) = Font(R.font.asta_sans, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))

val AstaSans = FontFamily(weight(400), weight(500), weight(700), weight(800))

/**
 * The styles the screens use, by their design-file names (design/DESIGN.md Typography):
 * Headline 48/64 · Title 40/52, 36/44, 32/40 · Body 30/38, 28/36, 26/34 · Label 24/28, 20/24. Nothing below 20sp.
 */
@Immutable
data class PleosType(
    /** Headline/Small/Strong. */
    val headline: TextStyle,
    /** Title/Large/Extra_Strong: popup titles. */
    val titleLargeExtra: TextStyle,
    /** Title/Large/Strong: header titles. */
    val titleLarge: TextStyle,
    /** Title/Medium/Strong. */
    val titleMedium: TextStyle,
    /** Title/Small/Strong: Large buttons, section labels. */
    val titleSmall: TextStyle,
    /** Body/Large/Normal: descriptions. */
    val bodyLarge: TextStyle,
    /** Body/Large/Strong: Medium buttons, list items, segments. */
    val bodyLargeStrong: TextStyle,
    /** Body/Medium/Strong. */
    val bodyMedium: TextStyle,
    /** Body/Medium/Normal. */
    val bodyMediumNormal: TextStyle,
    /** Body/Small/Normal: secondary lines. */
    val bodySmall: TextStyle,
    /** Body/Small/Strong: Small buttons. */
    val bodySmallStrong: TextStyle,
    /** Label/Medium. */
    val label: TextStyle,
    /** Label/Small: the smallest text there is (20sp). */
    val labelSmall: TextStyle,
    /** Headline/Medium/Extra_Strong: the confirm code. */
    val code: TextStyle,
)

private fun read(context: Context, @StyleRes style: Int): TextStyle {
    val attrs = intArrayOf(android.R.attr.textSize, android.R.attr.textFontWeight, R.attr.lineHeight)
    val order = attrs.sortedArray() // obtainStyledAttributes requires ascending ids
    val a = context.obtainStyledAttributes(style, order)
    try {
        val density = context.resources.displayMetrics.scaledDensity
        val size = a.getDimension(order.indexOf(android.R.attr.textSize), 28f * density) / density
        val w = a.getInt(order.indexOf(android.R.attr.textFontWeight), 400)
        val lh = a.getDimension(order.indexOf(R.attr.lineHeight), 0f) / density
        return TextStyle(fontFamily = AstaSans, fontWeight = FontWeight(w), fontSize = size.sp, lineHeight = if (lh > 0) lh.sp else (size * 1.3f).sp)
    } finally {
        a.recycle()
    }
}

fun pleosType(context: Context) = PleosType(
    headline = read(context, R.style.TextAppearance_Pleos_Headline_Small_Strong),
    titleLargeExtra = read(context, R.style.TextAppearance_Pleos_Title_Large_Extra_Strong),
    titleLarge = read(context, R.style.TextAppearance_Pleos_Title_Large_Strong),
    titleMedium = read(context, R.style.TextAppearance_Pleos_Title_Medium_Strong),
    titleSmall = read(context, R.style.TextAppearance_Pleos_Title_Small_Strong),
    bodyLarge = read(context, R.style.TextAppearance_Pleos_Body_Large_Normal),
    bodyLargeStrong = read(context, R.style.TextAppearance_Pleos_Body_Large_Strong),
    bodyMedium = read(context, R.style.TextAppearance_Pleos_Body_Medium_Strong),
    // Body/Medium comes in Strong and Normal; the generated styles carry only Strong, so Normal is the same style at 400.
    bodyMediumNormal = read(context, R.style.TextAppearance_Pleos_Body_Medium_Strong).copy(fontWeight = FontWeight.Normal),
    bodySmall = read(context, R.style.TextAppearance_Pleos_Body_Small_Normal),
    bodySmallStrong = read(context, R.style.TextAppearance_Pleos_Body_Small_Strong),
    label = read(context, R.style.TextAppearance_Pleos_Label_Medium),
    labelSmall = read(context, R.style.TextAppearance_Pleos_Label_Small),
    code = read(context, R.style.TextAppearance_Pleos_Headline_Medium_Extra_Strong),
)

val LocalPleosType = staticCompositionLocalOf<PleosType> { error("PleosTheme missing") }

@Composable
fun PleosTheme(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val config = LocalConfiguration.current
    // Re-read when font scale or night mode changes.
    val type = remember(config.fontScale, config.uiMode) { pleosType(context) }
    CompositionLocalProvider(LocalPleosType provides type, content = content)
}

object Pleos {
    val type: PleosType @Composable get() = LocalPleosType.current
}
