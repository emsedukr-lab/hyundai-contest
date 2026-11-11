package io.tteonaljido.trip

/**
 * 차량 신호 조합 (M57): read-only facts from the Pleos Vehicle SDK, already reduced to what the trip logic needs.
 * Every field is nullable — null means "the car did not report it" (unsupported domain, permission not granted, no
 * answer in time). An unknown is never counted as fine and never as a problem; it is simply left out.
 * Raw signal values are not stored anywhere: a snapshot lives in memory only and is replaced by the next reading.
 *
 * Warning lamps (Safety.getTelltalesInfo) are deliberately absent: Vehicle Service 2.3.22 answers that call with
 * "need Permission" unless the app holds a private permission (checked on the emulator, 2026-11-12), and private
 * permissions are not for third-party apps. Only readings that work with the public `CAR_*` permissions are here.
 */
data class VehicleSnapshot(
    /** Safety.hasPowerDownWarningIndicator: the car is limiting its power. */
    val powerLimited: Boolean? = null,
    /** Safety.hasLowWasherFluidWarning. */
    val washerLow: Boolean? = null,
    /** Safety.getEngineOilLevelState (combustion cars). */
    val engineOil: FluidLevel? = null,
    /** Safety.getBrakeFluidLevelState. */
    val brakeFluid: FluidLevel? = null,
    /** How many passenger doors are open, among those this car reports (Door.getCurrentDoorPosition per area). */
    val doorsOpen: Int? = null,
    /** The trunk (rear) or the hood is open, when the car reports those areas. */
    val trunkOpen: Boolean? = null,
    /** EvBattery.isEvChargePortOpen. */
    val chargePortOpen: Boolean? = null,
    /** Occupied seats (Seat.getCurrentSeatOccupancy), and how many of those have no belt on (getCurrentSeatBeltBuckledState). */
    val occupants: Int? = null,
    val unbuckled: Int? = null,
    /** Gear.getCurrentGearSelectionState == GEAR_PARK. */
    val gearPark: Boolean? = null,
    /** DrivingMode.getCurrentDrivingModeState. */
    val driveMode: DriveMode? = null,
    /** Odometer.getCurrentDistanceDriven (km): only differences are used, to say how far this drive has gone. */
    val odometerKm: Double? = null,
) {
    val empty: Boolean
        get() = powerLimited == null && washerLow == null && engineOil == null && brakeFluid == null && doorsOpen == null && trunkOpen == null &&
            chargePortOpen == null && occupants == null && gearPark == null && driveMode == null && odometerKm == null
}

enum class FluidLevel { OK, LOW, CRITICAL }

enum class DriveMode { NORMAL, ECO, SPORT }

/**
 * SDK enum names → this app's terms. Mapped by name (not by SDK type) so core-trip stays free of the SDK and a value
 * added by a later SDK version is simply unknown instead of breaking the build.
 */
object VehicleTerms {
    /** `OilLevelState.name` → level; ERROR (sensor fault) is unknown, HIGH is not a reason to stop. */
    fun fluid(oilLevelState: String): FluidLevel? = when (oilLevelState) {
        "NORMAL", "HIGH" -> FluidLevel.OK
        "LOW" -> FluidLevel.LOW
        "CRITICALLY_LOW" -> FluidLevel.CRITICAL
        else -> null
    }

    fun driveMode(drivingModeType: String): DriveMode? = runCatching { DriveMode.valueOf(drivingModeType) }.getOrNull()
}
