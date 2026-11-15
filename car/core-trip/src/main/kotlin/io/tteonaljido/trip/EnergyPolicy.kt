package io.tteonaljido.trip

import kotlin.math.roundToInt

/**
 * 충전·주유 권장 (energy advisory): an advisory input to the car timeline only — it never changes the user's plan and
 * never leaves the car. Given the car's own energy reading (EV state-of-charge or ICE fuel %), optional driving range,
 * and the day's remaining distance, it decides WHETHER to recommend and WHAT KIND:
 *  - EV at a day-destination (숙소) it can still reach → overnight slow charge; otherwise a fast charge at the next stop.
 *  - ICE at ~20–30% (or below), or when the range will not cover the rest of the day → refuel at the next stop.
 * The actual station list, fuel price and 급속/완속 type come from the Hyundai navigation's own screen (the app opens it),
 * so no external data or key is used here. Pure and deterministic — testable without any live vehicle signal.
 *
 * It also adds [EnergyOutlook]: the battery expected at the end of today's route, from three readings together (the car's
 * SOC, its range, and the navigation's own estimate for the next leg). A day that ends too low is advised earlier than
 * the plain SOC thresholds would, and a SPORT drive mode is pointed out when energy is the constraint.
 */

enum class VehicleKind { EV, ICE, PHEV, UNKNOWN }

enum class EnergyAction { FAST_CHARGE, SLOW_CHARGE, REFUEL }

/** Where the stop should happen: the next waypoint, or the day's lodging (overnight). */
enum class EnergyWhere { NEXT_STOP, LODGING }

/**
 * `energyPercent` is SOC for EV/PHEV, fuel % for ICE. `reasonCode` localizes via `energy_<code>`.
 * `socAtDayEnd` is the expected battery when today's route is done (null when it cannot be estimated);
 * `ecoHint` is set when the car is in SPORT mode while energy is what limits the day.
 */
data class EnergyAdvisory(
    val action: EnergyAction,
    val where: EnergyWhere,
    val energyPercent: Int?,
    val reasonCode: String,
    val socAtDayEnd: Int? = null,
    val ecoHint: Boolean = false,
)

object EnergyPolicy {
    /** At or below this SOC an EV should charge now (fast). */
    const val EV_LOW_SOC = 20
    /** At or below this SOC an EV is advised to plan a charge (slow overnight if it can still reach the stay). */
    const val EV_PLAN_SOC = 40
    /** Refuel window top: recommend refuelling at or below this fuel %. */
    const val REFUEL_AT = 30
    /** The day's remaining distance must fit in range with this safety margin, or a charge is advised regardless of SOC. */
    const val RANGE_SAFETY = 1.2

    /**
     * @param lodgingAhead the day still has its lodging ahead (so an overnight slow charge there is possible).
     * @param socAtDayEnd [EnergyOutlook.socAtDayEnd], when known.
     * Returns null when no recommendation applies (enough energy, unknown vehicle, or no reading).
     */
    fun advise(
        kind: VehicleKind,
        energyPercent: Int?,
        rangeKm: Int?,
        remainingDayKm: Int?,
        lodgingAhead: Boolean,
        socAtDayEnd: Int? = null,
        driveMode: DriveMode? = null,
    ): EnergyAdvisory? = when (kind) {
        VehicleKind.EV, VehicleKind.PHEV -> adviseEv(energyPercent, rangeKm, remainingDayKm, lodgingAhead, socAtDayEnd)
        VehicleKind.ICE -> adviseIce(energyPercent, rangeKm, remainingDayKm)
        VehicleKind.UNKNOWN -> null
    }?.copy(ecoHint = driveMode == DriveMode.SPORT)

    private fun adviseIce(fuel: Int?, rangeKm: Int?, remainingDayKm: Int?): EnergyAdvisory? {
        val f = fuel ?: return null
        // Fuel % alone misses a long day on a small tank: the range against the rest of today's route decides too.
        val reachable = rangeKm == null || remainingDayKm == null || remainingDayKm * RANGE_SAFETY <= rangeKm
        return if (f <= REFUEL_AT || !reachable) EnergyAdvisory(EnergyAction.REFUEL, EnergyWhere.NEXT_STOP, f, if (f <= REFUEL_AT) "refuel" else "refuel_range") else null
    }

    private fun adviseEv(soc: Int?, rangeKm: Int?, remainingDayKm: Int?, lodgingAhead: Boolean, socAtDayEnd: Int?): EnergyAdvisory? {
        val s = soc ?: return null
        // Can the day's remaining distance fit in the current range (with margin)? Unknown range/distance → assume yes.
        val reachable = rangeKm == null || remainingDayKm == null || remainingDayKm * RANGE_SAFETY <= rangeKm
        // The day would end at or below the "charge now" level: plan the stop before that happens, not after.
        val endsLow = socAtDayEnd != null && socAtDayEnd <= EV_LOW_SOC
        if (s > EV_PLAN_SOC && reachable && !endsLow) return null
        // Urgent (critical SOC, can't reach the day's end, or would arrive nearly empty) → fast now; otherwise a calm overnight slow charge at the stay.
        val urgent = s <= EV_LOW_SOC || !reachable || endsLow
        return if (!urgent && lodgingAhead) EnergyAdvisory(EnergyAction.SLOW_CHARGE, EnergyWhere.LODGING, s, "slow", socAtDayEnd)
        else EnergyAdvisory(EnergyAction.FAST_CHARGE, EnergyWhere.NEXT_STOP, s, "fast", socAtDayEnd)
    }
}

/**
 * The battery expected when today's remaining route is done. Two ways, best first:
 *  1. The navigation's own estimate for the next leg (`requestTrip`: SOC on arrival + road distance) gives this car's
 *     real consumption on this road today (% per km); the rest of the day is charged at the same rate.
 *  2. Otherwise the car's range at its current SOC (Odometer + EvBattery): the day uses the same share of the battery
 *     as it uses of the range.
 * Distances between the later stops are straight lines, so they are stretched by [EnergyPolicy.RANGE_SAFETY].
 */
object EnergyOutlook {
    /**
     * @param laterKm distance between the remaining stops after the next one, to the day's end (straight lines).
     * @param naviSocAtNext battery on arriving at the next stop, as the navigation estimated it.
     * @param nextLegMetres road distance of that next leg, from the same estimate.
     */
    fun socAtDayEnd(soc: Int?, rangeKm: Int?, laterKm: Int?, naviSocAtNext: Int?, nextLegMetres: Int?): Int? {
        val s = soc ?: return null
        val later = (laterKm ?: return null) * EnergyPolicy.RANGE_SAFETY
        val nextKm = nextLegMetres?.let { it / 1000.0 }
        if (naviSocAtNext != null && nextKm != null && nextKm >= 1.0 && naviSocAtNext in 0..s) {
            val perKm = (s - naviSocAtNext) / nextKm
            return (naviSocAtNext - perKm * later).roundToInt().coerceIn(0, 100)
        }
        val range = rangeKm?.takeIf { it > 0 } ?: return null
        val used = (later + (nextKm ?: 0.0)) / range
        return (s * (1 - used)).roundToInt().coerceIn(0, 100)
    }
}
