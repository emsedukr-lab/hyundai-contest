package io.tteonaljido.trip

/**
 * 충전·주유 권장 (energy advisory): an advisory input to the car timeline only — it never changes the user's plan and
 * never leaves the car. Given the car's own energy reading (EV state-of-charge or ICE fuel %), optional driving range,
 * and the day's remaining distance, it decides WHETHER to recommend and WHAT KIND:
 *  - EV at a day-destination (숙소) it can still reach → overnight slow charge; otherwise a fast charge at the next stop.
 *  - ICE at ~20–30% (or below) → refuel at the next stop with the least detour.
 * The actual station list, fuel price and 급속/완속 type come from the Hyundai navigation's own screen (the app opens it),
 * so no external data or key is used here. Pure and deterministic — testable without any live vehicle signal.
 */

enum class VehicleKind { EV, ICE, PHEV, UNKNOWN }

enum class EnergyAction { FAST_CHARGE, SLOW_CHARGE, REFUEL }

/** Where the stop should happen: the next waypoint, or the day's lodging (overnight). */
enum class EnergyWhere { NEXT_STOP, LODGING }

/** `energyPercent` is SOC for EV/PHEV, fuel % for ICE. `reasonCode` localizes via `energy_<code>`. */
data class EnergyAdvisory(val action: EnergyAction, val where: EnergyWhere, val energyPercent: Int?, val reasonCode: String)

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
     * Returns null when no recommendation applies (enough energy, unknown vehicle, or no reading).
     */
    fun advise(kind: VehicleKind, energyPercent: Int?, rangeKm: Int?, remainingDayKm: Int?, lodgingAhead: Boolean): EnergyAdvisory? = when (kind) {
        VehicleKind.EV, VehicleKind.PHEV -> adviseEv(energyPercent, rangeKm, remainingDayKm, lodgingAhead)
        VehicleKind.ICE -> energyPercent?.takeIf { it <= REFUEL_AT }?.let { EnergyAdvisory(EnergyAction.REFUEL, EnergyWhere.NEXT_STOP, it, "refuel") }
        VehicleKind.UNKNOWN -> null
    }

    private fun adviseEv(soc: Int?, rangeKm: Int?, remainingDayKm: Int?, lodgingAhead: Boolean): EnergyAdvisory? {
        val s = soc ?: return null
        // Can the day's remaining distance fit in the current range (with margin)? Unknown range/distance → assume yes.
        val reachable = rangeKm == null || remainingDayKm == null || remainingDayKm * RANGE_SAFETY <= rangeKm
        if (s > EV_PLAN_SOC && reachable) return null
        // Urgent (critical SOC or can't reach the day's end) → fast now; otherwise a calm overnight slow charge at the stay.
        val urgent = s <= EV_LOW_SOC || !reachable
        return if (!urgent && lodgingAhead) EnergyAdvisory(EnergyAction.SLOW_CHARGE, EnergyWhere.LODGING, s, "slow")
        else EnergyAdvisory(EnergyAction.FAST_CHARGE, EnergyWhere.NEXT_STOP, s, "fast")
    }
}
