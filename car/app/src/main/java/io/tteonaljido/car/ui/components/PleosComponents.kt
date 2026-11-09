package io.tteonaljido.car.ui.components

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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import io.tteonaljido.car.R
import io.tteonaljido.car.ui.theme.Pleos

/* Components follow the Pleos Connect 2.1.5 design assets (ivi_basic_button, ivi_system_popup, ivi_title, …),
   with colors and sizes from @color/pleos_* and @dimen/pleos_* tokens. M55: the phone app's shapes (flat white
   containers on a grey canvas, quiet tags, a day chip bar, switch rows) at car scale, about phone × 1/0.6. */

enum class ButtonType { PRIMARY, SECONDARY }
enum class ButtonSize { LARGE, MEDIUM, SMALL }

@Composable
fun PleosText(text: String, style: TextStyle, color: Color = colorResource(R.color.pleos_text_dark_primary), modifier: Modifier = Modifier, maxLines: Int = 3) {
    // Pleos guide: a sentence or paragraph should not exceed three lines.
    BasicText(text, modifier, style.copy(color = color), overflow = TextOverflow.Ellipsis, maxLines = maxLines)
}

@Composable
fun PleosButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    type: ButtonType = ButtonType.PRIMARY,
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
    val radius = dimensionResource(if (size == ButtonSize.LARGE) R.dimen.pleos_buttons_basic_large_radius_top_left else R.dimen.pleos_buttons_basic_medium_radius_top_left_medium)
    val bg = colorResource(
        when {
            type == ButtonType.PRIMARY && !enabled -> R.color.pleos_button_filled_disabled
            type == ButtonType.PRIMARY && pressed -> R.color.pleos_button_filled_pressed
            type == ButtonType.PRIMARY -> R.color.pleos_button_filled_enabled
            !enabled -> R.color.pleos_button_basic_disabled
            pressed -> R.color.pleos_button_basic_pressed
            else -> R.color.pleos_button_basic_enabled
        },
    )
    val fg = colorResource(
        when {
            !enabled -> R.color.pleos_text_dark_quaternary
            type == ButtonType.PRIMARY -> R.color.pleos_text_light_primary
            else -> R.color.pleos_text_dark_primary
        },
    )
    Box(
        modifier
            .heightIn(min = height)
            .widthIn(min = minW)
            .clip(RoundedCornerShape(radius))
            .background(bg)
            .clickable(interactionSource = source, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = tag }
            .padding(horizontal = padH),
        contentAlignment = Alignment.Center,
    ) {
        PleosText(label, if (size == ButtonSize.SMALL) Pleos.type.label else Pleos.type.bodyMedium, fg, maxLines = 1)
    }
}

/** A quiet text action ("이 여행 삭제"): no fill, the tone's text color, still a full 64dp touch target. */
@Composable
fun TextAction(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, tone: TagTone = TagTone.INK, tag: String = label, enabled: Boolean = true) {
    Box(
        modifier
            .heightIn(min = 64.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = tag }
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        PleosText(label, Pleos.type.bodyMedium, if (enabled) tagFg(tone) else colorResource(R.color.pleos_text_dark_quaternary), maxLines = 1)
    }
}

/**
 * The phone's white container (M45): flat on the grey canvas, radius_l, no shadow. A tappable one shows a pressed
 * tint; its text stays visible to UI Automator.
 */
@Composable
fun PleosCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    padding: Dp = dimensionResource(R.dimen.pleos_common_32),
    gap: Dp = dimensionResource(R.dimen.pleos_common_12),
    content: @Composable ColumnScope.() -> Unit,
) {
    val radius = dimensionResource(R.dimen.pleos_radius_l)
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(radius))
            .background(colorResource(R.color.pleos_surface_basic))
            .then(if (pressed) Modifier.background(colorResource(R.color.pleos_button_basic_enabled)) else Modifier)
            .then(if (onClick != null) Modifier.clickable(interactionSource = source, indication = null, onClick = onClick) else Modifier)
            .padding(padding),
        verticalArrangement = Arrangement.spacedBy(gap),
        content = content,
    )
}

/** A section's label above its container ("다른 여행", "확인할 점"). */
@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    PleosText(text, Pleos.type.titleSmall, modifier = modifier.padding(top = 8.dp), maxLines = 1)
}

@Composable
fun Icon(@DrawableRes icon: Int, size: Dp, tint: Color, modifier: Modifier = Modifier) {
    Image(painterResource(icon), null, modifier.size(size), colorFilter = ColorFilter.tint(tint))
}

/** 80dp icon button (the top bar's ‹). The tag is its accessible name and what the UI scripts look up. */
@Composable
fun IconAction(@DrawableRes icon: Int, tag: String, onClick: () -> Unit) {
    Box(
        Modifier
            .size(80.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = tag },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, 44.dp, colorResource(R.color.pleos_text_dark_primary))
    }
}

/**
 * Top bar like the phone's push screens: ‹ on the left when there is somewhere to go back to, the title with one
 * quiet line under it, actions on the right.
 */
@Composable
fun TopBar(title: String, subtitle: String? = null, onBack: (() -> Unit)? = null, backTag: String = stringResource(R.string.list), actions: @Composable RowScope.() -> Unit = {}) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 96.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (onBack != null) IconAction(R.drawable.ic_back, backTag, onBack)
        Column(Modifier.weight(1f)) {
            PleosText(title, Pleos.type.titleLarge, maxLines = 1)
            subtitle?.let { PleosText(it, Pleos.type.bodySmall, colorResource(R.color.pleos_text_dark_secondary), maxLines = 1) }
        }
        actions()
    }
}

/* ---------- tags (the phone's .tn-tag) ---------- */

enum class TagTone { NEUTRAL, INK, OK, WARN, ERROR, ACCENT }

@Composable
fun tagBg(tone: TagTone): Color = colorResource(
    when (tone) {
        TagTone.NEUTRAL, TagTone.INK -> R.color.pleos_button_basic_enabled
        TagTone.OK -> R.color.tn_ok_bg
        TagTone.WARN -> R.color.tn_warn_bg
        TagTone.ERROR -> R.color.tn_error_bg
        TagTone.ACCENT -> R.color.tn_accent_bg
    },
)

/** Text color that keeps 4.5:1 on its tag background, day and night (same values as the phone's shell.css). */
@Composable
fun tagFg(tone: TagTone): Color = colorResource(
    when (tone) {
        TagTone.NEUTRAL -> R.color.pleos_text_dark_secondary
        TagTone.INK -> R.color.pleos_text_dark_primary
        TagTone.OK -> R.color.tn_ok_fg
        TagTone.WARN -> R.color.tn_warn_fg
        TagTone.ERROR -> R.color.tn_error_fg
        TagTone.ACCENT -> R.color.tn_accent_fg
    },
)

@Composable
fun Tag(text: String, tone: TagTone = TagTone.NEUTRAL, modifier: Modifier = Modifier, large: Boolean = false, maxLines: Int = 1) {
    // `large` is the status tag in the next-destination panel: body size, so it reads from the driver's seat.
    Box(
        modifier
            .heightIn(min = if (large) 56.dp else 40.dp)
            .clip(RoundedCornerShape(if (large) 14.dp else 10.dp))
            .background(tagBg(tone))
            .padding(horizontal = if (large) 18.dp else 12.dp, vertical = if (large) 8.dp else 4.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        PleosText(text, (if (large) Pleos.type.bodyMedium else Pleos.type.label).copy(fontWeight = FontWeight.Bold), tagFg(tone), maxLines = maxLines)
    }
}

/** A small round mark before a line: color is only a cue, the words carry the meaning. */
@Composable
fun Dot(tone: TagTone, size: Dp = 14.dp) {
    val color = colorResource(
        when (tone) {
            TagTone.OK -> R.color.pleos_informative_active
            TagTone.WARN -> R.color.pleos_regulation_orange
            TagTone.ERROR -> R.color.pleos_informative_negative
            TagTone.ACCENT -> R.color.pleos_informative_positive
            else -> R.color.pleos_text_dark_tertiary
        },
    )
    Box(Modifier.size(size).clip(CircleShape).background(color))
}

enum class Tone { INFO, POSITIVE, WARNING, NEGATIVE }

fun Tone.tag(): TagTone = when (this) { Tone.INFO -> TagTone.NEUTRAL; Tone.POSITIVE -> TagTone.OK; Tone.WARNING -> TagTone.WARN; Tone.NEGATIVE -> TagTone.ERROR }

@Composable
fun toneColor(t: Tone) = colorResource(
    when (t) { Tone.INFO -> R.color.pleos_text_dark_secondary; Tone.POSITIVE -> R.color.pleos_informative_active; Tone.WARNING -> R.color.pleos_regulation_orange; Tone.NEGATIVE -> R.color.pleos_informative_negative },
)

/** One line with a colored dot in front; the meaning is always in the words (Pleos 4.5:1, no color-only signals). */
@Composable
fun StatusLine(text: String, tone: Tone = Tone.INFO, style: TextStyle = Pleos.type.bodyMedium) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Dot(tone.tag())
        PleosText(text, style, maxLines = 2)
    }
}

/* ---------- chip bar, rows, switch, steps ---------- */

/** The day chip bar (phone M45): ink 5% chips, the selected one graphite with light bold text. Tag `day{n}`. */
@Composable
fun DayChips(days: List<Int>, selected: Int, label: (Int) -> String, onPick: (Int) -> Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        days.forEach { d ->
            val on = d == selected
            Box(
                Modifier
                    .heightIn(min = 64.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(colorResource(if (on) R.color.pleos_button_filled_enabled else R.color.pleos_button_basic_enabled))
                    .clickable(role = Role.Tab) { onPick(d) }
                    .semantics { contentDescription = "day$d"; this.selected = on }
                    .padding(horizontal = 28.dp),
                contentAlignment = Alignment.Center,
            ) {
                PleosText(
                    label(d),
                    Pleos.type.bodyMedium.copy(fontWeight = if (on) FontWeight.Bold else FontWeight.Normal),
                    colorResource(if (on) R.color.pleos_text_light_primary else R.color.pleos_text_dark_primary),
                    maxLines = 1,
                )
            }
        }
    }
}

/** A list row: title over one quiet line, a trailing slot (tags), and a chevron when it opens something. */
@Composable
fun ListRow(title: String, meta: String? = null, onClick: (() -> Unit)? = null, tag: String? = null, enabled: Boolean = true, trailing: @Composable RowScope.() -> Unit = {}) {
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 96.dp)
            .clip(RoundedCornerShape(16.dp))
            .then(if (onClick != null) Modifier.clickable(enabled = enabled, role = Role.Button, onClick = onClick) else Modifier)
            .then(if (tag != null) Modifier.semantics { contentDescription = tag } else Modifier)
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        val fg = colorResource(if (enabled) R.color.pleos_text_dark_primary else R.color.pleos_text_dark_quaternary)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            PleosText(title, Pleos.type.bodyMedium, fg, maxLines = 1)
            meta?.let { PleosText(it, Pleos.type.bodySmall, colorResource(R.color.pleos_text_dark_secondary), maxLines = 2) }
        }
        trailing()
        if (onClick != null) Icon(R.drawable.ic_chevron, 36.dp, colorResource(R.color.pleos_text_dark_tertiary))
    }
}

/** A setting that is on or off: the whole row toggles; the switch shows the state (green when on, like the phone). */
@Composable
fun SwitchRow(title: String, body: String? = null, checked: Boolean, onToggle: () -> Unit, tag: String, stateOn: String, stateOff: String, enabled: Boolean = true) {
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 96.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable(enabled = enabled, role = Role.Switch, onClick = onToggle)
            .semantics { contentDescription = tag; stateDescription = if (checked) stateOn else stateOff }
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            PleosText(title, Pleos.type.bodyMedium, colorResource(if (enabled) R.color.pleos_text_dark_primary else R.color.pleos_text_dark_quaternary), maxLines = 1)
            body?.let { PleosText(it, Pleos.type.bodySmall, colorResource(R.color.pleos_text_dark_secondary), maxLines = 3) }
        }
        val track = colorResource(if (checked) R.color.pleos_informative_active else R.color.pleos_divider_tertiary)
        Box(
            Modifier.width(88.dp).height(48.dp).clip(CircleShape).background(track).padding(4.dp),
            contentAlignment = if (checked) Alignment.CenterEnd else Alignment.CenterStart,
        ) {
            Box(Modifier.size(40.dp).shadow(2.dp, CircleShape).clip(CircleShape).background(Color.White))
        }
    }
}

/** Hairline between rows inside one container. */
@Composable
fun RowDivider() {
    Box(Modifier.fillMaxWidth().height(1.dp).background(colorResource(R.color.pleos_divider_secondary)))
}

/** "QR 보여 주기 · 1/4" over a segmented bar (the phone's connect steps). */
@Composable
fun StepHeader(label: String, n: Int, total: Int) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            PleosText(label, Pleos.type.bodyMedium, modifier = Modifier.weight(1f), maxLines = 1)
            PleosText("$n/$total", Pleos.type.bodySmall, colorResource(R.color.pleos_text_dark_secondary), maxLines = 1)
        }
        val done = colorResource(R.color.pleos_button_filled_enabled)
        val todo = colorResource(R.color.pleos_divider_secondary)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            repeat(total) { i -> Box(Modifier.weight(1f).height(8.dp).clip(CircleShape).background(if (i < n) done else todo)) }
        }
    }
}

/** A numbered step line (①②③) like the phone's connect instructions. */
@Composable
fun NumberedStep(n: Int, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(20.dp)) {
        Box(Modifier.size(48.dp).clip(CircleShape).background(colorResource(R.color.pleos_button_basic_enabled)), contentAlignment = Alignment.Center) {
            PleosText("$n", Pleos.type.bodyMedium, maxLines = 1)
        }
        PleosText(text, Pleos.type.bodyLarge, maxLines = 2)
    }
}

/** ivi_system_popup: title, up to three lines of description, confirm/cancel. Never full screen while driving. */
@Composable
fun PleosSystemPopup(title: String, description: String, confirm: String, onConfirm: () -> Unit, cancel: String? = null, onCancel: () -> Unit = {}, onDismiss: () -> Unit = onCancel) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        val radius = dimensionResource(R.dimen.pleos_popup_system_radius_top_left)
        Column(
            Modifier
                .widthIn(max = dimensionResource(R.dimen.pleos_popup_system_medium_width))
                .shadow(16.dp, RoundedCornerShape(radius)) // Shadow/Light/Level3
                .clip(RoundedCornerShape(radius))
                .background(colorResource(R.color.pleos_background_popup))
                .padding(dimensionResource(R.dimen.pleos_common_48)),
            verticalArrangement = Arrangement.spacedBy(dimensionResource(R.dimen.pleos_common_32)),
        ) {
            PleosText(title, Pleos.type.titleMedium, maxLines = 2)
            PleosText(description, Pleos.type.bodyLarge, colorResource(R.color.pleos_text_dark_secondary))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(dimensionResource(R.dimen.pleos_common_16))) {
                if (cancel != null) PleosButton(cancel, onCancel, Modifier.weight(1f), ButtonType.SECONDARY)
                PleosButton(confirm, onConfirm, Modifier.weight(1f))
            }
        }
    }
}

/** The grey canvas every screen sits on (phone: #F7F8FA day, #131417 night). */
@Composable
fun Screen(content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier
            .fillMaxSize()
            .background(colorResource(R.color.tn_canvas))
            .padding(horizontal = dimensionResource(R.dimen.pleos_common_40), vertical = dimensionResource(R.dimen.pleos_common_16)),
        verticalArrangement = Arrangement.spacedBy(dimensionResource(R.dimen.pleos_common_24)),
        content = content,
    )
}
