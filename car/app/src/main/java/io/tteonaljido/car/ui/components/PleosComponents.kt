package io.tteonaljido.car.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.dimensionResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import io.tteonaljido.car.R
import io.tteonaljido.car.ui.theme.Pleos

/* Components follow the Pleos Connect 2.1.5 design assets (ivi_basic_button, ivi_system_popup, ivi_title, …),
   with every color and size taken from @color/pleos_* and @dimen/pleos_* tokens. */

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

@Composable
fun PleosCard(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    val radius = dimensionResource(R.dimen.pleos_radius_l)
    Column(
        modifier
            .fillMaxWidth()
            .shadow(6.dp, RoundedCornerShape(radius), ambientColor = Color(0x14000000), spotColor = Color(0x14000000)) // Shadow/Light/Level1
            .clip(RoundedCornerShape(radius))
            .background(colorResource(R.color.pleos_surface_basic))
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(dimensionResource(R.dimen.pleos_common_32)),
        verticalArrangement = Arrangement.spacedBy(dimensionResource(R.dimen.pleos_common_12)),
        content = content,
    )
}

@Composable
fun PleosHeader(title: String, subtitle: String? = null, actions: @Composable RowScope.() -> Unit = {}) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = dimensionResource(R.dimen.pleos_common_24)),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(dimensionResource(R.dimen.pleos_common_24)),
    ) {
        Column(Modifier.weight(1f)) {
            PleosText(title, Pleos.type.titleLarge, maxLines = 1)
            subtitle?.let { PleosText(it, Pleos.type.bodySmall, colorResource(R.color.pleos_text_dark_secondary), maxLines = 2) }
        }
        actions()
    }
}

enum class Tone { INFO, POSITIVE, WARNING, NEGATIVE }

@Composable
fun toneColor(t: Tone) = colorResource(
    when (t) { Tone.INFO -> R.color.pleos_text_dark_secondary; Tone.POSITIVE -> R.color.pleos_informative_active; Tone.WARNING -> R.color.pleos_regulation_orange; Tone.NEGATIVE -> R.color.pleos_informative_negative },
)

/** The colored bar is only a cue; meaning is always in words (Pleos 4.5:1 rule, and no color-only signals). */
@Composable
fun StatusLine(text: String, tone: Tone = Tone.INFO) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.padding(top = 2.dp).height(20.dp).widthIn(min = 8.dp, max = 8.dp).clip(RoundedCornerShape(4.dp)).background(toneColor(tone)))
        PleosText(text, Pleos.type.bodyMedium, maxLines = 2)
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

@Composable
fun Screen(content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier
            .fillMaxSize()
            .background(colorResource(R.color.pleos_background_primary))
            .padding(horizontal = dimensionResource(R.dimen.pleos_common_40), vertical = dimensionResource(R.dimen.pleos_common_24)),
        verticalArrangement = Arrangement.spacedBy(dimensionResource(R.dimen.pleos_common_24)),
        content = content,
    )
}
