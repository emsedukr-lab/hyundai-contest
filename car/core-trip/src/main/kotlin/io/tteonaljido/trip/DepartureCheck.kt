package io.tteonaljido.trip

/**
 * 출발 전 점검: before the day's drive, several read-only vehicle readings are combined with today's plan into
 * one short list — "can this car do today's route as it stands?". It never blocks anything and never edits the plan;
 * the driver sees what to look at before leaving. The item codes are shared with the server-side Fleet readiness check
 * (packages/shared/src/fleet.ts), which has more of them because a Fleet webhook also carries the warning lamps.
 *
 * What is combined:
 *  - driving range (Odometer) × today's remaining distance (plan)     → ENERGY_SHORT
 *  - occupied seats × belts (Seat)                                    → BELT_UNBUCKLED
 *  - charge port (EvBattery)                                          → CHARGE_CABLE
 *  - door positions per area (Door)                                   → DOOR_OPEN, TRUNK_OPEN
 *  - power-down warning, fluid levels, washer (Safety)                → POWER_LIMITED, BRAKE_FLUID_LOW, ENGINE_OIL_LOW, WASHER_LOW
 */
enum class CheckLevel { STOP, CAUTION }

enum class CheckCode { ENERGY_SHORT, POWER_LIMITED, BRAKE_FLUID_LOW, ENGINE_OIL_LOW, WASHER_LOW, CHARGE_CABLE, DOOR_OPEN, TRUNK_OPEN, BELT_UNBUCKLED }

/** `a`/`b` are the numbers the message needs (range km; open doors; unbuckled / occupants). */
data class CheckItem(val code: CheckCode, val level: CheckLevel, val a: Int? = null, val b: Int? = null)

/** `known` counts the groups the car actually reported, so "nothing to fix" is only said when something was checked. */
data class DepartureReport(val items: List<CheckItem>, val known: Int) {
    val level: CheckLevel? get() = items.minByOrNull { it.level.ordinal }?.level
    val ready: Boolean get() = items.isEmpty() && known > 0
}

object DepartureCheck {
    /**
     * @param remainingDayKm today's remaining distance between stops (straight lines, so it is stretched by
     *   [EnergyPolicy.RANGE_SAFETY] before it is compared with the range).
     * Returns null when the car reported nothing at all (then no card is shown).
     */
    fun evaluate(s: VehicleSnapshot?, rangeKm: Int?, remainingDayKm: Int?): DepartureReport? {
        val items = mutableListOf<CheckItem>()
        var known = 0

        if (rangeKm != null && remainingDayKm != null) {
            known++
            if (remainingDayKm * EnergyPolicy.RANGE_SAFETY > rangeKm) items += CheckItem(CheckCode.ENERGY_SHORT, CheckLevel.CAUTION, a = rangeKm)
        }
        s?.powerLimited?.let { known++; if (it) items += CheckItem(CheckCode.POWER_LIMITED, CheckLevel.STOP) }
        s?.brakeFluid?.let { known++; if (it != FluidLevel.OK) items += CheckItem(CheckCode.BRAKE_FLUID_LOW, CheckLevel.STOP) }
        s?.engineOil?.let { known++; if (it != FluidLevel.OK) items += CheckItem(CheckCode.ENGINE_OIL_LOW, if (it == FluidLevel.CRITICAL) CheckLevel.STOP else CheckLevel.CAUTION) }
        s?.washerLow?.let { known++; if (it) items += CheckItem(CheckCode.WASHER_LOW, CheckLevel.CAUTION) }
        s?.chargePortOpen?.let { known++; if (it) items += CheckItem(CheckCode.CHARGE_CABLE, CheckLevel.CAUTION) }
        s?.doorsOpen?.let { known++; if (it > 0) items += CheckItem(CheckCode.DOOR_OPEN, CheckLevel.CAUTION, a = it) }
        s?.trunkOpen?.let { known++; if (it) items += CheckItem(CheckCode.TRUNK_OPEN, CheckLevel.CAUTION) }

        val occupants = s?.occupants
        val unbuckled = s?.unbuckled
        if (occupants != null && unbuckled != null) {
            known++
            if (unbuckled > 0) items += CheckItem(CheckCode.BELT_UNBUCKLED, CheckLevel.CAUTION, a = unbuckled, b = occupants)
        }

        if (known == 0) return null
        return DepartureReport(items.sortedBy { it.level.ordinal }, known)
    }
}
