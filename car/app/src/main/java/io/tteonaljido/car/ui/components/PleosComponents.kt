package io.tteonaljido.car.ui.components

import androidx.annotation.ColorRes
import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.dimensionResource
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import io.tteonaljido.car.R
import io.tteonaljido.car.ui.theme.Pleos

/*
 * Pleos Connect components in the Toss visual language (design/TOSS.md, 2026-11-14): each one names the Pleos component
 * set whose structure and sizes it keeps (design/DESIGN.md — @dimen/pleos_*, TextAppearance.Pleos.*), and takes its
 * colors from the @color/tn_* roles of TOSS.md §2 and its look from TOSS.md §5. No hex, no dp of its own, no shape
 * outside the Pleos radius ladder. One accent (Toss blue) for the main action, selection and progress; semantic color
 * only where it means something; cards are white faces on the grey canvas without borders or shadows.
 */

/** design/DESIGN.md Spacing: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 (the only gaps and paddings used). */
object Space {
    val x4 @Composable get() = dimensionResource(R.dimen.pleos_common_4)
    val x8 @Composable get() = dimensionResource(R.dimen.pleos_common_8)
    val x12 @Composable get() = dimensionResource(R.dimen.pleos_common_12)
    val x16 @Composable get() = dimensionResource(R.dimen.pleos_common_16)
    val x20 @Composable get() = dimensionResource(R.dimen.pleos_common_20)
    val x24 @Composable get() = dimensionResource(R.dimen.pleos_common_24)
    val x32 @Composable get() = dimensionResource(R.dimen.pleos_common_32)
    val x40 @Composable get() = dimensionResource(R.dimen.pleos_common_40)
    val x48 @Composable get() = dimensionResource(R.dimen.pleos_common_48)
}

/** design/DESIGN.md Shapes: 8 · 12 · 16 · 20 · 24 · 32 · 48 · 999. */
object Radius {
    val r8 @Composable get() = dimensionResource(R.dimen.pleos_radius_top_left_level3)
    val r12 @Composable get() = dimensionResource(R.dimen.pleos_radius_top_left_level4)
    val r16 @Composable get() = dimensionResource(R.dimen.pleos_radius_top_left_level5)
    val r20 @Composable get() = dimensionResource(R.dimen.pleos_radius_top_left_level6)
    val r24 @Composable get() = dimensionResource(R.dimen.pleos_radius_top_left_level7)
    val r32 @Composable get() = dimensionResource(R.dimen.pleos_radius_top_left_level9)
}

/**
 * Where a component sits, so a faint face stays one step off what is under it (TOSS.md §2): straight on the grey
 * canvas, on a white surface (card), or on a floating surface (popup). [Screen], [PleosCard] and [PleosSystemPopup]
 * set it; buttons, tags, tracks and number circles read it through [weakFace].
 */
enum class Layer { CANVAS, SURFACE, FLOAT }

val LocalLayer = staticCompositionLocalOf { Layer.CANVAS }

/** Content drawn on a white surface that is not a [PleosCard] (the timeline's start/lodging bars). */
@Composable
fun OnSurface(content: @Composable () -> Unit) = CompositionLocalProvider(LocalLayer provides Layer.SURFACE, content = content)

/** The faint face for the current [Layer] (`fill-weak`, `fill-weak-on-canvas`), or its pressed step. */
@Composable
fun weakFace(pressed: Boolean = false): Color = colorResource(
    when (LocalLayer.current) {
        Layer.CANVAS -> if (pressed) R.color.tn_fill_weak_on_canvas_pressed else R.color.tn_fill_weak_on_canvas
        Layer.SURFACE -> if (pressed) R.color.tn_fill_weak_pressed else R.color.tn_fill_weak
        Layer.FLOAT -> if (pressed) R.color.tn_fill_weak_on_float_pressed else R.color.tn_fill_weak_on_float
    },
)

/** Disabled is the whole component at 30% (TOSS.md §1), never a partial grey-out. */
private const val DISABLED_ALPHA = 0.3f

private fun Modifier.disabledLook(enabled: Boolean) = if (enabled) this else alpha(DISABLED_ALPHA)

/** A CSS-style blur is a Gaussian of sigma = blur / 2; Skia's shadow radius r gives sigma ≈ 0.577 r, so r ≈ 0.866 blur. */
private const val BLUR_TO_RADIUS = 0.866f

/**
 * A drop shadow with a Pleos level's offset and blur (@dimen/pleos_shadow_*) in a Toss shadow color (low-alpha navy,
 * @color/tn_shadow_*). Only floating things have one: the selected segment, the switch knob (Level1), popups (Level3).
 */
@Composable
private fun Modifier.dropShadow(radius: Dp, y: Dp, blur: Dp, @ColorRes color: Int): Modifier {
    val tint = colorResource(color).toArgb()
    val paint = remember { android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG) }
    return drawBehind {
        paint.color = android.graphics.Color.TRANSPARENT
        paint.setShadowLayer(blur.toPx() * BLUR_TO_RADIUS, 0f, y.toPx(), tint)
        val r = radius.toPx()
        drawIntoCanvas { it.nativeCanvas.drawRoundRect(0f, 0f, size.width, size.height, r, r, paint) }
    }
}

/** Shadow Level1 (0 6 24) in navy 8%: the selected segment, switch knobs. */
@Composable
fun Modifier.shadowLevel1(radius: Dp): Modifier =
    dropShadow(radius, dimensionResource(R.dimen.pleos_shadow_level1_y), dimensionResource(R.dimen.pleos_shadow_level1_blur), R.color.tn_shadow_1)

/** Shadow Level3 (0 20 40) in navy 16%: system popups. */
@Composable
fun Modifier.shadowLevel3(radius: Dp): Modifier =
    dropShadow(radius, dimensionResource(R.dimen.pleos_shadow_level3_y1), dimensionResource(R.dimen.pleos_shadow_level3_blur1), R.color.tn_shadow_3)

@Composable
fun PleosText(text: String, style: TextStyle, color: Color = colorResource(R.color.tn_text_primary), modifier: Modifier = Modifier, maxLines: Int = 3, align: TextAlign? = null) {
    // Pleos guide: a sentence or paragraph should not exceed three lines.
    BasicText(text, modifier, style.copy(color = color, textAlign = align ?: TextAlign.Unspecified), overflow = TextOverflow.Ellipsis, maxLines = maxLines)
}

@Composable
fun Icon(@DrawableRes icon: Int, size: Dp, tint: Color, modifier: Modifier = Modifier) {
    Image(painterResource(icon), null, modifier.size(size), colorFilter = ColorFilter.tint(tint))
}

/* ---------- Buttons ---------- */

/**
 * `ivi_basic_button` Type. FILLED is the Toss main button (accent face, white bold label): the one main action among
 * several. BASIC is the secondary button (faint grey face, ink label); a lone button is BASIC. DESTRUCTIVE is the red
 * face TOSS.md §5 keeps for the confirm step of a deletion only.
 */
enum class ButtonType { BASIC, FILLED, DESTRUCTIVE }
enum class ButtonSize { LARGE, MEDIUM, SMALL }

/**
 * `ivi_basic_button` sizes — Large 100 · r32 · Title/Small/Strong, Medium 80 · r24 · Body/Large/Strong, Small 64 · r16 ·
 * Body/Small/Strong — with the TOSS.md §5 look: FILLED `accent` (pressed `accent-pressed`) + `on-accent`, BASIC the
 * faint face for where it sits (pressed one step darker) + `text-primary`, disabled the whole button at 30%.
 */
@Composable
fun PleosButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    type: ButtonType = ButtonType.FILLED,
    size: ButtonSize = ButtonSize.MEDIUM,
    enabled: Boolean = true,
    tag: String = label,
) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val height = dimensionResource(
        when (size) { ButtonSize.LARGE -> R.dimen.pleos_buttons_basic_large_height; ButtonSize.MEDIUM -> R.dimen.pleos_buttons_basic_medium_height; ButtonSize.SMALL -> R.dimen.pleos_buttons_basic_small_height },
    )
    val padH = dimensionResource(
        when (size) { ButtonSize.LARGE -> R.dimen.pleos_buttons_basic_large_padding_horizontal; ButtonSize.MEDIUM -> R.dimen.pleos_buttons_basic_medium_padding_horizontal; ButtonSize.SMALL -> R.dimen.pleos_buttons_basic_small_padding_horizontal },
    )
    val minW = dimensionResource(
        when (size) { ButtonSize.LARGE -> R.dimen.pleos_buttons_basic_large_min_width; ButtonSize.MEDIUM -> R.dimen.pleos_buttons_basic_medium_min_width; ButtonSize.SMALL -> R.dimen.pleos_buttons_basic_small_min_width },
    )
    val shape = RoundedCornerShape(when (size) { ButtonSize.LARGE -> Radius.r32; ButtonSize.MEDIUM -> Radius.r24; ButtonSize.SMALL -> Radius.r16 })
    val bg = when (type) {
        ButtonType.FILLED -> colorResource(if (pressed) R.color.tn_accent_pressed else R.color.tn_accent)
        ButtonType.DESTRUCTIVE -> colorResource(R.color.tn_negative)
        ButtonType.BASIC -> weakFace(pressed)
    }
    // The red face has no pressed role of its own: the press overlay steps it like a pressed photo.
    val press = if (type == ButtonType.DESTRUCTIVE && pressed) colorResource(R.color.tn_press_overlay) else Color.Transparent
    val fg = colorResource(if (type == ButtonType.BASIC) R.color.tn_text_primary else R.color.tn_on_accent)
    val style = when (size) { ButtonSize.LARGE -> Pleos.type.titleSmall; ButtonSize.MEDIUM -> Pleos.type.bodyLargeStrong; ButtonSize.SMALL -> Pleos.type.bodySmallStrong }
    Box(
        modifier
            .heightIn(min = height)
            .widthIn(min = minW)
            .disabledLook(enabled)
            .clip(shape)
            .background(bg)
            .background(press)
            .clickable(interactionSource = source, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = tag }
            .padding(horizontal = padH),
        contentAlignment = Alignment.Center,
    ) {
        PleosText(label, style, fg, maxLines = 1)
    }
}

/** `ivi_icon_button` Medium (80 × 80 · r20 · icon 56), ink icon. Plain has no face until pressed; the tag is its accessible name. */
@Composable
fun PleosIconButton(@DrawableRes icon: Int, tag: String, onClick: () -> Unit, plain: Boolean = true) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val face = when {
        pressed -> weakFace(pressed = true)
        plain -> Color.Transparent
        else -> weakFace()
    }
    Box(
        Modifier
            .size(dimensionResource(R.dimen.pleos_buttons_icon_medium_width))
            .clip(RoundedCornerShape(dimensionResource(R.dimen.pleos_buttons_icon_medium_rounded_radius_top_left)))
            .background(face)
            .clickable(interactionSource = source, indication = null, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = tag },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, dimensionResource(R.dimen.pleos_buttons_icon_medium_content), colorResource(R.color.tn_text_primary))
    }
}

/* ---------- Page navigation ---------- */

/**
 * `ivi_header` with `ivi_title` (its paddings and heights), drawn as the Toss top bar: the same face as the canvas and
 * no line under it, title left-aligned. Type=Depth when there is somewhere to go back to (arrow, Title/Large/Strong, an
 * optional description line), Type=Main otherwise. Buttons on the right sit in the title's 80dp row.
 */
@Composable
fun PleosHeader(title: String, description: String? = null, onBack: (() -> Unit)? = null, backTag: String = stringResource(R.string.list), actions: @Composable RowScope.() -> Unit = {}) {
    val iconButton = dimensionResource(R.dimen.pleos_buttons_icon_medium_width)
    val arrow = dimensionResource(R.dimen.pleos_page_navigation_title_depth_icon_square)
    val startPad = dimensionResource(R.dimen.pleos_page_navigation_padding_extralarge)
    Row(
        Modifier
            .fillMaxWidth()
            .background(colorResource(R.color.tn_canvas))
            // The arrow's 80dp touch box is wider than its 56dp glyph: pull it in so the glyph starts at the 40dp edge.
            .padding(
                start = if (onBack != null) startPad - (iconButton - arrow) / 2 else startPad,
                end = dimensionResource(R.dimen.pleos_page_navigation_padding_large),
                top = dimensionResource(R.dimen.pleos_page_navigation_padding_extralarge),
                bottom = dimensionResource(R.dimen.pleos_page_navigation_padding_large),
            )
            .heightIn(min = dimensionResource(R.dimen.pleos_page_navigation_container_height)),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(dimensionResource(R.dimen.pleos_page_navigation_gap_samll)),
    ) {
        if (onBack != null) PleosIconButton(R.drawable.ic_back, backTag, onBack)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(dimensionResource(R.dimen.pleos_page_navigation_sub_title_gap_vertical))) {
            PleosText(title, Pleos.type.titleLarge, maxLines = 1)
            description?.let { PleosText(it, Pleos.type.bodySmall, colorResource(R.color.tn_text_secondary), maxLines = 1) }
        }
        actions()
    }
}

/**
 * One screen in the app window: the header across the top, then the content on the grey `canvas` with the header's
 * 40dp side margin.
 */
@Composable
fun Screen(header: @Composable () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    CompositionLocalProvider(LocalLayer provides Layer.CANVAS) {
        Column(Modifier.fillMaxSize().background(colorResource(R.color.tn_canvas))) {
            header()
            Column(
                Modifier.fillMaxSize().padding(horizontal = Space.x40).padding(top = Space.x24),
                verticalArrangement = Arrangement.spacedBy(Space.x24),
                content = content,
            )
        }
    }
}

/* ---------- Containers and rows ---------- */

/**
 * A content container: a white `surface` face on the grey canvas, radius 32, no border and no shadow (TOSS.md §5).
 * Pressed steps the face to `fill-weak-pressed`. What sits inside reads [Layer.SURFACE].
 */
@Composable
fun PleosCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    padding: Dp = dimensionResource(R.dimen.pleos_common_32),
    gap: Dp = dimensionResource(R.dimen.pleos_common_12),
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(Radius.r32)
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    CompositionLocalProvider(LocalLayer provides Layer.SURFACE) {
        Column(
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(colorResource(if (pressed) R.color.tn_fill_weak_pressed else R.color.tn_surface))
                .then(if (onClick != null) Modifier.clickable(interactionSource = source, indication = null, onClick = onClick) else Modifier)
                .padding(padding),
            verticalArrangement = Arrangement.spacedBy(gap),
            content = content,
        )
    }
}

/** A section's label above its container: Title/Small/Strong. */
@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    PleosText(text, Pleos.type.titleSmall, modifier = modifier, maxLines = 1)
}

/** Hairline between rows inside one container: `hairline`, 1dp. */
@Composable
fun RowDivider() {
    Box(Modifier.fillMaxWidth().height(dimensionResource(R.dimen.pleos_page_navigation_border_bottom)).background(colorResource(R.color.tn_hairline)))
}

/**
 * List item (112dp row, Body/Large/Strong label): a title over one quiet `text-secondary` line, a trailing slot, and a
 * `text-disabled` chevron when it opens something. Disabled is the whole row at 30%.
 */
@Composable
fun ListRow(title: String, meta: String? = null, onClick: (() -> Unit)? = null, tag: String? = null, enabled: Boolean = true, trailing: @Composable RowScope.() -> Unit = {}) {
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = LIST_ITEM_HEIGHT)
            .disabledLook(enabled)
            .clip(RoundedCornerShape(Radius.r24))
            .then(if (onClick != null) Modifier.clickable(enabled = enabled, role = Role.Button, onClick = onClick) else Modifier)
            .then(if (tag != null) Modifier.semantics { contentDescription = tag } else Modifier)
            .padding(vertical = Space.x16),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x20),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Space.x4)) {
            PleosText(title, Pleos.type.bodyLargeStrong, maxLines = 1)
            meta?.let { PleosText(it, Pleos.type.bodySmall, colorResource(R.color.tn_text_secondary), maxLines = 2) }
        }
        trailing()
        if (onClick != null) Icon(R.drawable.ic_chevron, Space.x40, colorResource(R.color.tn_text_disabled))
    }
}

/** The list item height of the design file's settings list (`vehicle_setting_popup_content/List/item`): 112dp = 80 + 16 + 16. */
private val LIST_ITEM_HEIGHT @Composable get() = dimensionResource(R.dimen.pleos_buttons_basic_medium_height) + Space.x16 + Space.x16

/** `ivi_switch` Medium: 80 × 48 track · r16, 32 knob · r8. Track `switch-off` / `accent`, white knob with Level1; disabled at 30%. */
@Composable
fun PleosSwitch(checked: Boolean, enabled: Boolean = true) {
    val track = colorResource(if (checked) R.color.tn_accent else R.color.tn_switch_off)
    val knob = colorResource(R.color.tn_switch_knob)
    val pad = dimensionResource(R.dimen.pleos_selections_switch_medium_padding)
    val knobSize = dimensionResource(R.dimen.pleos_selections_switch_medium_knob_square)
    val knobRadius = dimensionResource(R.dimen.pleos_selections_switch_medium_knob_radius_top_left)
    val knobShape = RoundedCornerShape(knobRadius)
    Box(
        Modifier
            .disabledLook(enabled)
            .width(dimensionResource(R.dimen.pleos_selections_switch_medium_width))
            .height(knobSize + pad + pad)
            .clip(RoundedCornerShape(dimensionResource(R.dimen.pleos_selections_switch_medium_radius_top_left)))
            .background(track)
            .padding(pad),
        contentAlignment = if (checked) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(Modifier.size(knobSize).shadowLevel1(knobRadius).clip(knobShape).background(knob))
    }
}

/** A setting that is on or off: the whole row toggles, the switch shows the state. */
@Composable
fun SwitchRow(title: String, body: String? = null, checked: Boolean, onToggle: () -> Unit, tag: String, stateOn: String, stateOff: String, enabled: Boolean = true) {
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = LIST_ITEM_HEIGHT)
            .disabledLook(enabled)
            .clip(RoundedCornerShape(Radius.r24))
            .clickable(enabled = enabled, role = Role.Switch, onClick = onToggle)
            .semantics { contentDescription = tag; stateDescription = if (checked) stateOn else stateOff }
            .padding(vertical = Space.x16),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x24),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Space.x4)) {
            PleosText(title, Pleos.type.bodyLargeStrong, maxLines = 1)
            body?.let { PleosText(it, Pleos.type.bodySmall, colorResource(R.color.tn_text_secondary), maxLines = 3) }
        }
        // The row already carries the 30% when disabled.
        PleosSwitch(checked)
    }
}

/* ---------- Tabs ---------- */

/**
 * `ivi_segmented_control/solid` Medium sizes — an 80dp bar (r24, 8dp inside), 64dp segments (r16) — with the Toss look:
 * the track is the faint face for where it sits, the selected segment a white `surface` with shadow Level1 and
 * Body/Large/Strong in `text-primary`, the others in `text-secondary`. More segments than fit scroll sideways.
 */
@Composable
fun <K> SegmentedControl(items: List<K>, selected: K, label: (K) -> String, tag: (K) -> String, onPick: (K) -> Unit) {
    val pad = dimensionResource(R.dimen.pleos_tabs_solid_padding)
    val segRadius = dimensionResource(R.dimen.pleos_tabs_solid_medium_button_radius_top_left)
    val segShape = RoundedCornerShape(segRadius)
    val track = weakFace()
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
        Row(
            Modifier
                .clip(RoundedCornerShape(dimensionResource(R.dimen.pleos_tabs_solid_medium_radius_top_left)))
                .background(track)
                .padding(pad),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            items.forEach { k ->
                val on = k == selected
                val source = remember { MutableInteractionSource() }
                val pressed by source.collectIsPressedAsState()
                val pressedFace = weakFace(pressed = true)
                Box(
                    Modifier
                        .height(dimensionResource(R.dimen.pleos_tabs_solid_medium_button_height))
                        .widthIn(min = dimensionResource(R.dimen.pleos_tabs_solid_medium_button_width))
                        .then(if (on) Modifier.shadowLevel1(segRadius) else Modifier)
                        .clip(segShape)
                        .background(if (on) colorResource(R.color.tn_surface) else if (pressed) pressedFace else Color.Transparent)
                        .clickable(interactionSource = source, indication = null, role = Role.Tab) { onPick(k) }
                        .semantics { contentDescription = tag(k); this.selected = on }
                        .padding(horizontal = dimensionResource(R.dimen.pleos_tabs_solid_medium_button_padding_horizontal)),
                    contentAlignment = Alignment.Center,
                ) {
                    PleosText(label(k), Pleos.type.bodyLargeStrong, colorResource(if (on) R.color.tn_text_primary else R.color.tn_text_secondary), maxLines = 1)
                }
            }
        }
    }
}

/* ---------- State marks: semantic color as a dot or a washed tag, the words carry the meaning ---------- */

/**
 * What a line or a label says about state (TOSS.md §1): OK = `positive` (slack, done), INFO = `accent`, ERROR =
 * `negative` (late, conflict), CAUTION = `warning` (needs a look — a dot or icon only, its text stays ink). NEUTRAL is
 * a quiet grey.
 */
enum class Tone { NEUTRAL, INFO, OK, CAUTION, ERROR }

/** A small round state mark before a line. */
@Composable
fun Dot(tone: Tone, size: Dp = Space.x16) {
    val color = colorResource(
        when (tone) {
            Tone.OK -> R.color.tn_positive
            Tone.INFO -> R.color.tn_accent
            Tone.ERROR -> R.color.tn_negative
            Tone.CAUTION -> R.color.tn_warning
            Tone.NEUTRAL -> R.color.tn_text_tertiary
        },
    )
    Box(Modifier.size(size).clip(CircleShape).background(color))
}

/**
 * A tag (TOSS.md §5): a washed face with text of the same hue and no dot — INFO `accent-weak`/`accent-text`, OK
 * `positive-weak`/`positive`, ERROR `negative-weak`/`negative-text`, NEUTRAL the faint face/`text-secondary`. CAUTION is
 * `warning-weak` with ink text and a `warning` dot in front (orange is never text). Label/Medium on a 12-radius face,
 * or — `large`, the status in the next-destination panel, read from the driver's seat — Body/Medium/Strong on r16.
 */
@Composable
fun Tag(text: String, tone: Tone = Tone.NEUTRAL, modifier: Modifier = Modifier, large: Boolean = false, maxLines: Int = 1) {
    val face = when (tone) {
        Tone.NEUTRAL -> weakFace()
        Tone.INFO -> colorResource(R.color.tn_accent_weak)
        Tone.OK -> colorResource(R.color.tn_positive_weak)
        Tone.CAUTION -> colorResource(R.color.tn_warning_weak)
        Tone.ERROR -> colorResource(R.color.tn_negative_weak)
    }
    val ink = colorResource(
        when (tone) {
            Tone.NEUTRAL -> R.color.tn_text_secondary
            Tone.INFO -> R.color.tn_accent_text
            Tone.OK -> R.color.tn_positive
            Tone.CAUTION -> R.color.tn_text_primary
            Tone.ERROR -> R.color.tn_negative_text
        },
    )
    Row(
        modifier
            .heightIn(min = if (large) dimensionResource(R.dimen.pleos_buttons_basic_small_height) else Space.x40)
            .clip(RoundedCornerShape(if (large) Radius.r16 else Radius.r12))
            .background(face)
            .padding(horizontal = if (large) Space.x20 else Space.x12, vertical = if (large) Space.x12 else Space.x4),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (large) Space.x12 else Space.x8),
    ) {
        if (tone == Tone.CAUTION) Dot(tone, if (large) Space.x16 else Space.x12)
        PleosText(text, if (large) Pleos.type.bodyMedium else Pleos.type.label, ink, maxLines = maxLines)
    }
}

/**
 * 꼭 — a place that can't be dropped or moved. No words: the Pleos outline pin (24 grid, round 1.6 stroke, like the
 * lock) in `accent-text` on `accent-weak`, the info tag look — red means errors only (design/TOSS.md), and the phone
 * marks 꼭 the same way. `label` is read out by TalkBack. Same heights as [Tag].
 */
@Composable
fun MustTag(label: String, modifier: Modifier = Modifier, large: Boolean = false) {
    val hue = colorResource(R.color.tn_accent_text)
    val side = if (large) dimensionResource(R.dimen.pleos_buttons_basic_small_height) else Space.x40
    Box(
        modifier
            .size(side)
            .clip(RoundedCornerShape(if (large) Radius.r16 else Radius.r12))
            .background(colorResource(R.color.tn_accent_weak))
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Icon(R.drawable.ic_pin, if (large) Space.x40 else Space.x32, hue)
    }
}

/** One line with its state dot in front; the meaning is always in the words. */
@Composable
fun StatusLine(text: String, tone: Tone = Tone.NEUTRAL, style: TextStyle = Pleos.type.bodyMedium) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.x16)) {
        Dot(tone)
        PleosText(text, style, maxLines = 2)
    }
}

/* ---------- Steps ---------- */

/** "QR 스캔 · 1/4" over a four-part bar: done and current parts in `accent`, the rest `hairline`. */
@Composable
fun StepHeader(label: String, n: Int, total: Int) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Space.x12)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            PleosText(label, Pleos.type.bodyLargeStrong, modifier = Modifier.weight(1f), maxLines = 1)
            PleosText("$n/$total", Pleos.type.bodySmall, colorResource(R.color.tn_text_secondary), maxLines = 1)
        }
        val done = colorResource(R.color.tn_accent)
        val todo = colorResource(R.color.tn_hairline)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Space.x8)) {
            repeat(total) { i -> Box(Modifier.weight(1f).height(Space.x8).clip(CircleShape).background(if (i < n) done else todo)) }
        }
    }
}

/** A numbered instruction: the number on a faint circle (`fill-weak` for where it sits), the text in Body/Large/Normal. */
@Composable
fun NumberedStep(n: Int, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.x20)) {
        Box(Modifier.size(Space.x48).clip(CircleShape).background(weakFace()), contentAlignment = Alignment.Center) {
            PleosText("$n", Pleos.type.bodyMedium, maxLines = 1)
        }
        PleosText(text, Pleos.type.bodyLarge, maxLines = 2)
    }
}

/* ---------- Popup ---------- */

/**
 * `ivi_system_popup` Medium sizes — 808 wide, radius 48, 48 padding, 40 between header and buttons — drawn as a Toss
 * dialog: `surface-float`, no border, shadow Level3, `overlay` (black 56%) behind. Header centered: Title/Large/Extra_Strong,
 * then Body/Large/Normal in `text-secondary` (three lines at most). Buttons are Large, 24 apart: the action filled,
 * then cancel basic — the order the design file draws them; a deletion's action is `destructive` (red face). Never
 * shown while driving.
 */
@Composable
fun PleosSystemPopup(
    title: String,
    description: String,
    confirm: String,
    onConfirm: () -> Unit,
    cancel: String? = null,
    onCancel: () -> Unit = {},
    onDismiss: () -> Unit = onCancel,
    destructive: Boolean = false,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        // The scrim is the design system's overlay token, not the platform's dim.
        val window = (LocalView.current.parent as? DialogWindowProvider)?.window
        SideEffect { window?.setDimAmount(0f) }
        val radius = dimensionResource(R.dimen.pleos_popup_system_radius_top_left)
        val shape = RoundedCornerShape(radius)
        CompositionLocalProvider(LocalLayer provides Layer.FLOAT) {
            Box(Modifier.fillMaxSize().background(colorResource(R.color.tn_overlay)), contentAlignment = Alignment.Center) {
                Column(
                    Modifier
                        .width(dimensionResource(R.dimen.pleos_popup_system_medium_width))
                        .shadowLevel3(radius)
                        .clip(shape)
                        .background(colorResource(R.color.tn_surface_float))
                        .padding(dimensionResource(R.dimen.pleos_popup_system_padding_large)),
                    verticalArrangement = Arrangement.spacedBy(dimensionResource(R.dimen.pleos_popup_system_gap_extralarge)),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Column(
                        Modifier.fillMaxWidth().padding(PaddingValues(bottom = dimensionResource(R.dimen.pleos_popup_system_padding_small))),
                        verticalArrangement = Arrangement.spacedBy(dimensionResource(R.dimen.pleos_popup_system_gap_large)),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        PleosText(title, Pleos.type.titleLargeExtra, maxLines = 2, align = TextAlign.Center)
                        PleosText(description, Pleos.type.bodyLarge, colorResource(R.color.tn_text_secondary), align = TextAlign.Center)
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(dimensionResource(R.dimen.pleos_popup_system_gap_large))) {
                        // With a choice the action is the filled one; a lone acknowledgement is a basic button.
                        val action = when {
                            cancel == null -> ButtonType.BASIC
                            destructive -> ButtonType.DESTRUCTIVE
                            else -> ButtonType.FILLED
                        }
                        PleosButton(confirm, onConfirm, Modifier.weight(1f), action, ButtonSize.LARGE)
                        if (cancel != null) PleosButton(cancel, onCancel, Modifier.weight(1f), ButtonType.BASIC, ButtonSize.LARGE)
                    }
                }
            }
        }
    }
}
