package io.tteonaljido.car.ui.screens

import io.tteonaljido.trip.Trip
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

fun dateLabel(date: String): String {
    val d = LocalDate.parse(date)
    return "${d.monthValue}월 ${d.dayOfMonth}일 (${d.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.KOREAN)})"
}

fun periodLabel(t: Trip) = if (t.startDate == t.endDate) dateLabel(t.startDate) else "${dateLabel(t.startDate)} ~ ${dateLabel(t.endDate)}"

fun nightsLabel(t: Trip) = if (t.days.size == 1) "당일" else "${t.days.size - 1}박 ${t.days.size}일"

fun codeLabel(code: String) = "${code.take(3)} ${code.drop(3)}"

fun countdown(ms: Long): String {
    val s = (ms.coerceAtLeast(0) + 999) / 1000
    return "%d:%02d".format(Locale.ROOT, s / 60, s % 60)
}
