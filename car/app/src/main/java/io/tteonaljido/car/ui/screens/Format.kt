package io.tteonaljido.car.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import io.tteonaljido.car.R
import io.tteonaljido.trip.Trip
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/** Calendar strings are shown as-is (they are already local to the trip); only the wording follows the UI language. */
fun dateLabel(date: String, locale: Locale = Locale.getDefault()): String {
    val d = LocalDate.parse(date)
    return if (locale.language == "ko") "${d.monthValue}월 ${d.dayOfMonth}일 (${d.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.KOREAN)})"
    else d.format(DateTimeFormatter.ofPattern("EEE, MMM d", Locale.ENGLISH))
}

fun periodLabel(t: Trip) = if (t.startDate == t.endDate) dateLabel(t.startDate) else "${dateLabel(t.startDate)} ~ ${dateLabel(t.endDate)}"

@Composable
fun nightsLabel(t: Trip) = if (t.days.size == 1) stringResource(R.string.day_trip) else stringResource(R.string.nights_days, t.days.size - 1, t.days.size)

fun codeLabel(code: String) = "${code.take(3)} ${code.drop(3)}"

fun countdown(ms: Long): String {
    val s = (ms.coerceAtLeast(0) + 999) / 1000
    return "%d:%02d".format(Locale.ROOT, s / 60, s % 60)
}
