package io.tteonaljido.car.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Shape
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
 * Pleos Connect components, built to design/DESIGN.md (the official 2.1.5 design assets, written out): each one names
 * the component set it implements, and takes every color, size, radius and text style from the @color/pleos_*,
 * @dimen/pleos_* and TextAppearance.Pleos.* tokens. No hex, no dp of its own, no shape outside the system's.
 * Chromatic color appears only as an Informative mark (a state dot), never as decoration.
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

/** Shadow/Light/Level1 (0 6 24, black 8%): switch knobs, the selected segment. The only shadow these screens use. */
@Composable
fun Modifier.shadowLevel1(shape: Shape): Modifier {
    val tint = Color.Black.copy(alpha = 0.08f)
    return shadow(dimensionResource(R.dimen.pleos_shadow_level1_y), shape, clip = false, ambientColor = tint, spotColor = tint)
}

@Composable
fun PleosText(text: String, style: TextStyle, color: Color = colorResource(R.color.pleos_text_dark_primary), modifier: Modifier = Modifier, maxLines: Int = 3, align: TextAlign? = null) {
    // Pleos guide: a sentence or paragraph should not exceed three lines.
    BasicText(text, modifier, style.copy(color = color, textAlign = align ?: TextAlign.Unspecified), overflow = TextOverflow.Ellipsis, maxLines = maxLines)
}

@Composable
fun Icon(@DrawableRes icon: Int, size: Dp, tint: Color, modifier: Modifier = Modifier) {
    Image(painterResource(icon), null, modifier.size(size), colorFilter = ColorFilter.tint(tint))
}

/* ---------- Buttons ---------- */

/**
 * `ivi_basic_button` Type. The design file calls the light one "Primary" and the filled one "Secondary"; the names
 * here say what they look like. A lone button is BASIC; FILLED marks the one main action among several.
 */
enum class ButtonType { BASIC, FILLED }
enum class ButtonSize { LARGE, MEDIUM, SMALL }

/** `ivi_basic_button`: Large 100 · r32 · Title/Small/Strong, Medium 80 · r24 · Body/Large/Strong, Small 64 · r16 · Body/Small/Strong. */
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
    val filled = type == ButtonType.FILLED
    val bg = colorResource(
        when {
            filled && !enabled -> R.color.pleos_button_filled_disabled
            filled && pressed -> R.color.pleos_button_filled_pressed
            filled -> R.color.pleos_button_filled_enabled
            !enabled -> R.color.pleos_button_basic_disabled
            pressed -> R.color.pleos_button_basic_pressed
            else -> R.color.pleos_button_basic_enabled
        },
    )
    val fg = colorResource(
        when {
            !enabled -> R.color.pleos_text_dark_quaternary
            filled -> R.color.pleos_text_light_primary
            else -> R.color.pleos_text_dark_primary
        },
    )
    val style = when (size) { ButtonSize.LARGE -> Pleos.type.titleSmall; ButtonSize.MEDIUM -> Pleos.type.bodyLargeStrong; ButtonSize.SMALL -> Pleos.type.bodySmallStrong }
    Box(
        modifier
            .heightIn(min = height)
            .widthIn(min = minW)
            .clip(shape)
            .background(bg)
            // Disabled keeps its outline: divider/secondary, 2dp.
            .then(if (!enabled) Modifier.border(dimensionResource(R.dimen.pleos_buttons_basic_disabled_border), colorResource(R.color.pleos_divider_secondary), shape) else Modifier)
            .clickable(interactionSource = source, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = tag }
            .padding(horizontal = padH),
        contentAlignment = Alignment.Center,
    ) {
        PleosText(label, style, fg, maxLines = 1)
    }
}

/** `ivi_icon_button` Medium (80 × 80 · r20 · icon 56). Plain has no face until pressed; the tag is its accessible name. */
@Composable
fun PleosIconButton(@DrawableRes icon: Int, tag: String, onClick: () -> Unit, plain: Boolean = true) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val face = when {
        pressed -> colorResource(R.color.pleos_button_basic_pressed)
        plain -> Color.Transparent
        else -> colorResource(R.color.pleos_button_basic_enabled)
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
        Icon(icon, dimensionResource(R.dimen.pleos_buttons_icon_medium_content), colorResource(R.color.pleos_icon_dark_primary))
    }
}

/* ---------- Page navigation ---------- */

/**
 * `ivi_header` with `ivi_title`: the window's top bar on surface/basic with a 1dp divider/tertiary line under it.
 * Type=Depth when there is somewhere to go back to (arrow, Title/Large/Strong, an optional description line),
 * Type=Main otherwise. Buttons on the right sit in the title's 80dp row.
 */
@Composable
fun PleosHeader(title: String, description: String? = null, onBack: (() -> Unit)? = null, backTag: String = stringResource(R.string.list), actions: @Composable RowScope.() -> Unit = {}) {
    val line = colorResource(R.color.pleos_divider_tertiary)
    val lineWidth = dimensionResource(R.dimen.pleos_page_navigation_border_bottom)
    val iconButton = dimensionResource(R.dimen.pleos_buttons_icon_medium_width)
    val arrow = dimensionResource(R.dimen.pleos_page_navigation_title_depth_icon_square)
    val startPad = dimensionResource(R.dimen.pleos_page_navigation_padding_extralarge)
    Row(
        Modifier
            .fillMaxWidth()
            .background(colorResource(R.color.pleos_surface_basic))
            .drawBehind { drawLine(line, Offset(0f, size.height), Offset(size.width, size.height), strokeWidth = lineWidth.toPx()) }
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
            description?.let { PleosText(it, Pleos.type.bodySmall, colorResource(R.color.pleos_text_dark_secondary), maxLines = 1) }
        }
        actions()
    }
}

/**
 * One screen in the app window: the header across the top, then the content on background/primary with the header's
 * 40dp side margin.
 */
@Composable
fun Screen(header: @Composable () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().background(colorResource(R.color.pleos_background_primary))) {
        header()
        Column(
            Modifier.fillMaxSize().padding(horizontal = Space.x40).padding(top = Space.x24),
            verticalArrangement = Arrangement.spacedBy(Space.x24),
            content = content,
        )
    }
}

/* ---------- Containers and rows ---------- */

/**
 * A content container: surface/basic with a 1dp divider/secondary outline, radius 32, no shadow (the design system
 * shows depth with a translucent border; in the dark theme the surface equals the window background, so the outline
 * is what makes the container). Pressed lays dim/dark/secondary over the face.
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
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(colorResource(R.color.pleos_surface_basic))
            .then(if (pressed) Modifier.background(colorResource(R.color.pleos_dim_dark_secondary)) else Modifier)
            .border(dimensionResource(R.dimen.pleos_page_navigation_border_bottom), colorResource(R.color.pleos_divider_secondary), shape)
            .then(if (onClick != null) Modifier.clickable(interactionSource = source, indication = null, onClick = onClick) else Modifier)
            .padding(padding),
        verticalArrangement = Arrangement.spacedBy(gap),
        content = content,
    )
}

/** A section's label above its container: Title/Small/Strong. */
@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    PleosText(text, Pleos.type.titleSmall, modifier = modifier, maxLines = 1)
}

/** Hairline between rows inside one container: divider/secondary, 1dp. */
@Composable
fun RowDivider() {
    Box(Modifier.fillMaxWidth().height(dimensionResource(R.dimen.pleos_page_navigation_border_bottom)).background(colorResource(R.color.pleos_divider_secondary)))
}

/** List item (112dp row, Body/Large/Strong label): a title over one quiet line, a trailing slot, and a chevron when it opens something. */
@Composable
fun ListRow(title: String, meta: String? = null, onClick: (() -> Unit)? = null, tag: String? = null, enabled: Boolean = true, trailing: @Composable RowScope.() -> Unit = {}) {
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = LIST_ITEM_HEIGHT)
            .clip(RoundedCornerShape(Radius.r24))
            .then(if (onClick != null) Modifier.clickable(enabled = enabled, role = Role.Button, onClick = onClick) else Modifier)
            .then(if (tag != null) Modifier.semantics { contentDescription = tag } else Modifier)
            .padding(vertical = Space.x16),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x20),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Space.x4)) {
            PleosText(title, Pleos.type.bodyLargeStrong, colorResource(if (enabled) R.color.pleos_text_dark_primary else R.color.pleos_text_dark_quaternary), maxLines = 1)
            meta?.let { PleosText(it, Pleos.type.bodySmall, colorResource(R.color.pleos_text_dark_secondary), maxLines = 2) }
        }
        trailing()
        if (onClick != null) Icon(R.drawable.ic_chevron, Space.x40, colorResource(R.color.pleos_icon_dark_tertiary))
    }
}

/** The list item height of the design file's settings list (`vehicle_setting_popup_content/List/item`): 112dp = 80 + 16 + 16. */
private val LIST_ITEM_HEIGHT @Composable get() = dimensionResource(R.dimen.pleos_buttons_basic_medium_height) + Space.x16 + Space.x16

/** `ivi_switch` Medium: 80 × 48 track · r16, 32 knob · r8 with Shadow/Light/Level1; on = switch/on. */
@Composable
fun PleosSwitch(checked: Boolean, enabled: Boolean = true) {
    val track = colorResource(if (!enabled) R.color.pleos_switch_disabled else if (checked) R.color.pleos_switch_on else R.color.pleos_switch_off)
    val knob = colorResource(if (!enabled) R.color.pleos_switch_knob_disabled else if (checked) R.color.pleos_switch_knob_on else R.color.pleos_switch_knob_off)
    val pad = dimensionResource(R.dimen.pleos_selections_switch_medium_padding)
    val knobSize = dimensionResource(R.dimen.pleos_selections_switch_medium_knob_square)
    val knobShape = RoundedCornerShape(dimensionResource(R.dimen.pleos_selections_switch_medium_knob_radius_top_left))
    Box(
        Modifier
            .width(dimensionResource(R.dimen.pleos_selections_switch_medium_width))
            .height(knobSize + pad + pad)
            .clip(RoundedCornerShape(dimensionResource(R.dimen.pleos_selections_switch_medium_radius_top_left)))
            .background(track)
            .padding(pad),
        contentAlignment = if (checked) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(Modifier.size(knobSize).shadowLevel1(knobShape).clip(knobShape).background(knob))
    }
}

/** A setting that is on or off: the whole row toggles, the switch shows the state. */
@Composable
fun SwitchRow(title: String, body: String? = null, checked: Boolean, onToggle: () -> Unit, tag: String, stateOn: String, stateOff: String, enabled: Boolean = true) {
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = LIST_ITEM_HEIGHT)
            .clip(RoundedCornerShape(Radius.r24))
            .clickable(enabled = enabled, role = Role.Switch, onClick = onToggle)
            .semantics { contentDescription = tag; stateDescription = if (checked) stateOn else stateOff }
            .padding(vertical = Space.x16),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x24),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Space.x4)) {
            PleosText(title, Pleos.type.bodyLargeStrong, colorResource(if (enabled) R.color.pleos_text_dark_primary else R.color.pleos_text_dark_quaternary), maxLines = 1)
            body?.let { PleosText(it, Pleos.type.bodySmall, colorResource(R.color.pleos_text_dark_secondary), maxLines = 3) }
        }
        PleosSwitch(checked, enabled)
    }
}

/* ---------- Tabs ---------- */

/**
 * `ivi_segmented_control/solid` Medium: an 80dp bar on controller/tab_background (r24, 8dp inside), 64dp segments (r16),
 * the selected one on button/switch/enabled with Shadow/Light/Level1 and Body/Large/Strong in text/dark/primary, the
 * others in text/dark/secondary. The design file draws 2–5 segments; more than fit scroll sideways.
 */
@Composable
fun <K> SegmentedControl(items: List<K>, selected: K, label: (K) -> String, tag: (K) -> String, onPick: (K) -> Unit) {
    val pad = dimensionResource(R.dimen.pleos_tabs_solid_padding)
    val segShape = RoundedCornerShape(dimensionResource(R.dimen.pleos_tabs_solid_medium_button_radius_top_left))
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
        Row(
            Modifier
                .clip(RoundedCornerShape(dimensionResource(R.dimen.pleos_tabs_solid_medium_radius_top_left)))
                .background(colorResource(R.color.pleos_controller_tab_background))
                .padding(pad),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            items.forEach { k ->
                val on = k == selected
                val source = remember { MutableInteractionSource() }
                val pressed by source.collectIsPressedAsState()
                Box(
                    Modifier
                        .height(dimensionResource(R.dimen.pleos_tabs_solid_medium_button_height))
                        .widthIn(min = dimensionResource(R.dimen.pleos_tabs_solid_medium_button_width))
                        .then(if (on) Modifier.shadowLevel1(segShape) else Modifier)
                        .clip(segShape)
                        .background(if (on) colorResource(R.color.pleos_button_switch_enabled) else if (pressed) colorResource(R.color.pleos_button_basic_pressed) else Color.Transparent)
                        .clickable(interactionSource = source, indication = null, role = Role.Tab) { onPick(k) }
                        .semantics { contentDescription = tag(k); this.selected = on }
                        .padding(horizontal = dimensionResource(R.dimen.pleos_tabs_solid_medium_button_padding_horizontal)),
                    contentAlignment = Alignment.Center,
                ) {
                    PleosText(label(k), Pleos.type.bodyLargeStrong, colorResource(if (on) R.color.pleos_text_dark_primary else R.color.pleos_text_dark_secondary), maxLines = 1)
                }
            }
        }
    }
}

/* ---------- State marks: Informative colors as a dot, the words carry the meaning ---------- */

/**
 * What a line or a label says about state. Only OK, INFO and ERROR have a color (informative/active · positive ·
 * negative); CAUTION is a strong ink dot, since the design system keeps regulation colors for legal information and
 * has no "warning" hue. NEUTRAL has no mark.
 */
enum class Tone { NEUTRAL, INFO, OK, CAUTION, ERROR }

/** A small round state mark before a line. */
@Composable
fun Dot(tone: Tone, size: Dp = Space.x16) {
    val color = colorResource(
        when (tone) {
            Tone.OK -> R.color.pleos_informative_active
            Tone.INFO -> R.color.pleos_informative_positive
            Tone.ERROR -> R.color.pleos_informative_negative
            Tone.CAUTION -> R.color.pleos_icon_dark_primary
            Tone.NEUTRAL -> R.color.pleos_icon_dark_tertiary
        },
    )
    Box(Modifier.size(size).clip(CircleShape).background(color))
}

/**
 * A quiet label on dim/dark/primary: Label/Medium on a 12-radius face, or — `large`, the status in the
 * next-destination panel, read from the driver's seat — Body/Medium/Strong on a 16-radius face. A tone adds its dot;
 * the text stays ink, so it reads the same in both themes.
 */
@Composable
fun Tag(text: String, tone: Tone = Tone.NEUTRAL, modifier: Modifier = Modifier, large: Boolean = false, maxLines: Int = 1) {
    Row(
        modifier
            .heightIn(min = if (large) dimensionResource(R.dimen.pleos_buttons_basic_small_height) else Space.x40)
            .clip(RoundedCornerShape(if (large) Radius.r16 else Radius.r12))
            .background(colorResource(R.color.pleos_dim_dark_primary))
            .padding(horizontal = if (large) Space.x20 else Space.x12, vertical = if (large) Space.x12 else Space.x4),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (large) Space.x12 else Space.x8),
    ) {
        if (tone != Tone.NEUTRAL) Dot(tone, if (large) Space.x16 else Space.x12)
        PleosText(text, if (large) Pleos.type.bodyMedium else Pleos.type.label, maxLines = maxLines)
    }
}

/**
 * 꼭 — a place that can't be dropped or moved. The one tag off the neutral face: light coral with coral text and a 📌
 * in front, so it reads as a constraint of the plan, not one more status. Same sizes as [Tag].
 */
@Composable
fun MustTag(text: String, modifier: Modifier = Modifier, large: Boolean = false) {
    val ink = colorResource(R.color.tn_must_text)
    Row(
        modifier
            .heightIn(min = if (large) dimensionResource(R.dimen.pleos_buttons_basic_small_height) else Space.x40)
            .clip(RoundedCornerShape(if (large) Radius.r16 else Radius.r12))
            .background(colorResource(R.color.tn_must_face))
            .padding(horizontal = if (large) Space.x20 else Space.x12, vertical = if (large) Space.x12 else Space.x4),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (large) Space.x8 else Space.x4),
    ) {
        PleosText("📌", if (large) Pleos.type.bodyMedium else Pleos.type.label, ink, maxLines = 1)
        PleosText(text, if (large) Pleos.type.bodyMedium else Pleos.type.label, ink, maxLines = 1)
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

/** "QR 스캔 · 1/4" over a four-part bar: done parts in button/filled/enabled, the rest divider/secondary. */
@Composable
fun StepHeader(label: String, n: Int, total: Int) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Space.x12)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            PleosText(label, Pleos.type.bodyLargeStrong, modifier = Modifier.weight(1f), maxLines = 1)
            PleosText("$n/$total", Pleos.type.bodySmall, colorResource(R.color.pleos_text_dark_secondary), maxLines = 1)
        }
        val done = colorResource(R.color.pleos_button_filled_enabled)
        val todo = colorResource(R.color.pleos_divider_secondary)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Space.x8)) {
            repeat(total) { i -> Box(Modifier.weight(1f).height(Space.x8).clip(CircleShape).background(if (i < n) done else todo)) }
        }
    }
}

/** A numbered instruction: the number on a dim/dark/primary circle, the text in Body/Large/Normal. */
@Composable
fun NumberedStep(n: Int, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.x20)) {
        Box(Modifier.size(Space.x48).clip(CircleShape).background(colorResource(R.color.pleos_dim_dark_primary)), contentAlignment = Alignment.Center) {
            PleosText("$n", Pleos.type.bodyMedium, maxLines = 1)
        }
        PleosText(text, Pleos.type.bodyLarge, maxLines = 2)
    }
}

/* ---------- Popup ---------- */

/**
 * `ivi_system_popup` Medium: 808 wide on background/popup, radius 48, a 2dp divider/primary outline and no shadow,
 * 48 padding, 40 between header and buttons. Header centered: Title/Large/Extra_Strong, then Body/Large/Normal in
 * text/dark/secondary (three lines at most). Buttons are Large, 24 apart: the action filled, then cancel basic —
 * the order the design file draws them. Behind it, overlay/default. Never shown while driving.
 */
@Composable
fun PleosSystemPopup(title: String, description: String, confirm: String, onConfirm: () -> Unit, cancel: String? = null, onCancel: () -> Unit = {}, onDismiss: () -> Unit = onCancel) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        // The scrim is the design system's overlay token, not the platform's dim.
        val window = (LocalView.current.parent as? DialogWindowProvider)?.window
        SideEffect { window?.setDimAmount(0f) }
        val shape = RoundedCornerShape(dimensionResource(R.dimen.pleos_popup_system_radius_top_left))
        Box(Modifier.fillMaxSize().background(colorResource(R.color.pleos_overlay_default)), contentAlignment = Alignment.Center) {
            Column(
                Modifier
                    .width(dimensionResource(R.dimen.pleos_popup_system_medium_width))
                    .clip(shape)
                    .background(colorResource(R.color.pleos_background_popup))
                    .border(dimensionResource(R.dimen.pleos_popup_system_border), colorResource(R.color.pleos_divider_primary), shape)
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
                    PleosText(description, Pleos.type.bodyLarge, colorResource(R.color.pleos_text_dark_secondary), align = TextAlign.Center)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(dimensionResource(R.dimen.pleos_popup_system_gap_large))) {
                    // With a choice the action is the filled one; a lone acknowledgement is a basic button.
                    PleosButton(confirm, onConfirm, Modifier.weight(1f), if (cancel != null) ButtonType.FILLED else ButtonType.BASIC, ButtonSize.LARGE)
                    if (cancel != null) PleosButton(cancel, onCancel, Modifier.weight(1f), ButtonType.BASIC, ButtonSize.LARGE)
                }
            }
        }
    }
}
