package io.tteonaljido.trip

/**
 * 쉬어 가기 권고 (M57). How long the car has been driven without a real break is combined with what the navigation
 * and the day's plan know, so the advice is one the driver can act on:
 *  - continuous driving time (driving state, with gear P from the Vehicle SDK) and distance (Odometer)
 *  - time left to the next stop (NaviHelper) — nearly there → rest on arrival instead
 *  - spare minutes before the next fixed time (시간 지킴이) — is there room for a break?
 *  - a rest area on the route ahead (NaviHelper turn-by-turn list)
 * It only advises: nothing is added to the route and the plan is untouched.
 */

/** One stretch of driving. A stop shorter than [DriveSessions.BREAK_MS] (a light, a drive-through) does not end it. */
data class DriveSession(
    /** When this stretch began (epoch millis); null while no stretch is open. */
    val since: Long? = null,
    /** When the car was last seen stopped inside this stretch; null while moving. */
    val stoppedAt: Long? = null,
    /** Odometer (km) when the stretch began, when the car reports it. */
    val startKm: Double? = null,
    val lastKm: Double? = null,
) {
    fun minutes(now: Long): Int? = since?.let { ((now - it) / 60_000L).toInt().coerceAtLeast(0) }
    /** The app clock jumped by [deltaMs] (the emulator's demo clock): the stretch moves with it, so its length stays what it was. */
    fun shifted(deltaMs: Long): DriveSession = copy(since = since?.plus(deltaMs), stoppedAt = stoppedAt?.plus(deltaMs))
    val km: Int? get() = if (startKm != null && lastKm != null && lastKm >= startKm) (lastKm - startKm).toInt() else null
}

object DriveSessions {
    /** Parked this long counts as a break: the next drive starts a new stretch. Our own threshold. */
    const val BREAK_MS = 15 * 60_000L

    /** Pure reducer, fed whenever the driving state or the odometer changes and on the app's 30 s tick. */
    fun step(s: DriveSession, driving: Boolean, now: Long, odometerKm: Double? = null): DriveSession {
        if (driving) {
            // Back on the road after a real break → a new stretch; after a short stop → the same one continues.
            val rested = s.stoppedAt != null && now - s.stoppedAt >= BREAK_MS
            return if (s.since == null || rested) DriveSession(since = now, startKm = odometerKm, lastKm = odometerKm)
            else s.copy(stoppedAt = null, startKm = s.startKm ?: odometerKm, lastKm = odometerKm ?: s.lastKm)
        }
        if (s.since == null) return s
        val stoppedAt = s.stoppedAt ?: now
        // The break is long enough: the stretch is over (nothing to advise while resting).
        return if (now - stoppedAt >= BREAK_MS) DriveSession() else s.copy(stoppedAt = stoppedAt, lastKm = odometerKm ?: s.lastKm)
    }
}

/**
 * The next rest area on the route, from the navigation's turn-by-turn list (`getTBTInfo`). Each entry's distance is
 * measured from the turn before it (checked on the emulator: the entries add up to the route's length), so the
 * distance to a rest area is the running total up to it. The list is only read as "from here" while its total still
 * matches what the navigation says is left; otherwise no distance is given rather than a stale one.
 */
object RestAreas {
    data class Turn(val type: String, val metres: Double)

    /** `TurnType` names that are a place to stop: a rest area (졸음쉼터 등) or a service area (휴게소). */
    private val REST = setOf("TURN_RESTAREA", "TURN_ENTER_SERVICEAREA")
    /** How far the list's total may differ from the remaining distance and still be trusted. */
    const val TOLERANCE = 0.15

    fun ahead(turns: List<Turn>, remainMetres: Int?): Int? {
        val remain = remainMetres?.takeIf { it > 0 } ?: return null
        var along = 0.0
        var rest: Double? = null
        for (t in turns) {
            along += t.metres
            if (rest == null && t.type in REST) rest = along
        }
        if (kotlin.math.abs(along - remain) > remain * TOLERANCE) return null
        return rest?.toInt()
    }
}

/** What to do about it, most useful first. */
enum class RestPlan {
    /** The next stop is close: take the break there. */
    AT_NEXT_STOP,
    /** A rest area is on the route ahead. */
    REST_AREA,
    /** Nothing specific is known: just stop somewhere safe. */
    ANYWHERE,
}

data class RestAdvice(
    /** Minutes driven in this stretch. */
    val drivingMinutes: Int,
    val drivingKm: Int?,
    val plan: RestPlan,
    /** Minutes to the next stop, when [plan] is AT_NEXT_STOP. */
    val nextStopMinutes: Int?,
    /** Distance to the rest area ahead, when [plan] is REST_AREA. */
    val restAreaMetres: Int?,
    /** A [RestAdvisor.BREAK_MINUTES] break still keeps the next fixed time; false = it would not; null = no deadline or unknown. */
    val fitsSchedule: Boolean?,
)

object RestAdvisor {
    /** Advise a break after this much continuous driving. Our own threshold (the common "every two hours" guidance). */
    const val DRIVE_LIMIT_MINUTES = 120
    /** The length of the break the schedule is checked against. */
    const val BREAK_MINUTES = 15
    /** "Nearly there": at or under this many minutes to the next stop the break is simply taken on arrival. */
    const val NEARLY_THERE_MINUTES = 20

    /**
     * @param nextStopMinutes the navigation's remaining time to the next stop (only while it guides there).
     * @param slackMinutes spare minutes before the binding deadline (시간 지킴이), if there is one.
     * @param restAreaMetres distance to the next rest area on the route, from the navigation's turn list.
     * Returns null when no break is due.
     */
    fun advise(session: DriveSession, now: Long, nextStopMinutes: Int?, slackMinutes: Int?, restAreaMetres: Int?): RestAdvice? {
        val driven = session.minutes(now)?.takeIf { it >= DRIVE_LIMIT_MINUTES } ?: return null
        val plan = when {
            nextStopMinutes != null && nextStopMinutes <= NEARLY_THERE_MINUTES -> RestPlan.AT_NEXT_STOP
            restAreaMetres != null -> RestPlan.REST_AREA
            else -> RestPlan.ANYWHERE
        }
        // Resting at the stop itself costs the schedule nothing; anywhere else the break must fit before the deadline.
        val fits = if (plan == RestPlan.AT_NEXT_STOP) null else slackMinutes?.let { it >= BREAK_MINUTES }
        return RestAdvice(
            driven, session.km?.takeIf { it > 0 }, plan,
            nextStopMinutes?.takeIf { plan == RestPlan.AT_NEXT_STOP }, restAreaMetres?.takeIf { plan == RestPlan.REST_AREA }, fits,
        )
    }
}
