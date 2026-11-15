package io.tteonaljido.car.vehicle

import ai.pleos.playground.vehicle.Vehicle
import ai.pleos.playground.vehicle.api.model.area.DoorArea
import ai.pleos.playground.vehicle.api.model.area.SeatArea
import ai.pleos.playground.vehicle.api.model.capability.AccessType
import ai.pleos.playground.vehicle.api.model.capability.AreaBounds
import ai.pleos.playground.vehicle.api.model.capability.CapabilityConfig
import ai.pleos.playground.vehicle.constant.control.DrivingModeType
import ai.pleos.playground.vehicle.constant.control.OilLevelState
import ai.pleos.playground.vehicle.constant.area.DoorValue
import ai.pleos.playground.vehicle.constant.control.VehicleGear
import android.content.Context
import android.util.Log
import io.tteonaljido.car.BuildConfig
import io.tteonaljido.car.EnergyState
import io.tteonaljido.trip.VehicleKind
import io.tteonaljido.trip.VehicleSnapshot
import io.tteonaljido.trip.VehicleTerms
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume
import kotlin.math.roundToInt

/**
 * The only door to the Pleos Vehicle SDK, and it only reads. Two kinds of reading:
 *  - [readEnergy] (`CAR_ENERGY`, `CAR_DRIVE`): EV state-of-charge / fuel % / remaining range, with EV vs ICE vs PHEV
 *    inferred from which capability the car reports.
 *  - [readSnapshot] (adds `CAR_SAFETY`, `CAR_DOORS`, `CAR_SEATS`): power-down warning, fluid levels, doors and
 *    trunk, charge port, seats and belts, gear, drive mode, odometer — reduced at once to a [VehicleSnapshot]; raw
 *    values are not kept. Warning lamps are not read: `getTelltalesInfo` is refused without a private permission
 *    (Vehicle Service 2.3.22, checked on the emulator), and private permissions are not for third-party apps.
 *
 * Rules it follows (Pleos guide): support is asked at runtime with `checkXxxCapabilities` and remembered, never
 * guessed from the car model; a reading the car does not support, that this app has no permission for, or that does
 * not answer in time is simply null. No control API is called and no `CONTROL_CAR_*` permission is declared.
 * One-shot getters are polled by the ViewModel while a screen is shown (no listeners are left registered, so
 * `release()` never races a callback). The emulator used here cannot inject these signals, so this is
 * compile-verified here and runtime-verified on a real car / userdebug image; on the emulator the demo seed stands in.
 */
class PleosVehicleReader(context: Context) {
    private val vehicle = Vehicle(context)
    @Volatile private var started = false
    /** Capability answers, asked once per reading (a timeout is not remembered: the service may still be connecting). */
    private val supported = ConcurrentHashMap<String, Boolean>()

    fun start() { if (!started) runCatching { vehicle.initialize() }.onSuccess { started = true } }
    fun close() { runCatching { vehicle.release() } }

    /* ---------- energy ---------- */

    /** EV SOC / fuel % / range, chosen by the car's capabilities. Null when unknown or unsupported. */
    suspend fun readEnergy(): EnergyState? {
        if (!started) return null
        val range = rangeKm()
        return when (val kind = kind()) {
            VehicleKind.EV, VehicleKind.PHEV -> EnergyState(kind, ask { ok, err -> vehicle.getEvBattery().getEvBatteryStateOfCharge(ok, err) }, range)
            VehicleKind.ICE -> EnergyState(kind, ask { ok, err -> vehicle.getFuel().getFuelPercent(ok, err) }, range)
            VehicleKind.UNKNOWN -> null
        }.also { if (BuildConfig.DEBUG) Log.d(TAG, "energy $it") }
    }

    private suspend fun kind(): VehicleKind {
        val ev = can("soc") { ok, err -> vehicle.getEvBattery().checkEvBatteryStateOfChargeCapabilities({ c -> ok(c.readable()) }, { _ -> err() }) }
        val ice = can("fuel") { ok, err -> vehicle.getFuel().checkFuelPercentCapabilities({ c -> ok(c.readable()) }, { _ -> err() }) }
        return when {
            ev && ice -> VehicleKind.PHEV
            ev -> VehicleKind.EV
            ice -> VehicleKind.ICE
            else -> VehicleKind.UNKNOWN
        }
    }

    @Suppress("DEPRECATION") // getRangeRemainingDistance is the 2.3.2 read path; the Google RANGE_REMAINING property is a later migration.
    private suspend fun rangeKm(): Int? = ask<Float> { ok, err -> vehicle.getOdometer().getRangeRemainingDistance(ok, err) }?.let { (it / 1000f).roundToInt() }

    /* ---------- snapshot ---------- */

    /** One reading of everything the trip logic combines. Groups are asked side by side, so a silent one costs one timeout, not many. */
    @Suppress("DEPRECATION") // isEvChargePortOpen / getCurrentGearSelectionState are the 2.3.2 read paths; their Google car properties are a later migration (like the range above).
    suspend fun readSnapshot(): VehicleSnapshot? {
        if (!started) return null
        return coroutineScope {
            val safety = vehicle.getSafety()
            val power = async {
                if (can("powerDown") { ok, err -> safety.checkPowerDownWarningIndicatorCapabilities({ c -> ok(c.readable()) }, { _ -> err() }) })
                    ask<Boolean> { ok, err -> safety.hasPowerDownWarningIndicator(ok, err) } else null
            }
            val washer = async {
                if (can("washer") { ok, err -> safety.checkLowWasherFluidWarningStateCapabilities({ c -> ok(c.readable()) }, { _ -> err() }) })
                    ask<Boolean> { ok, err -> safety.hasLowWasherFluidWarning(ok, err) } else null
            }
            val oil = async {
                if (can("engineOil") { ok, err -> safety.checkEngineOilLevelStateCapabilities({ c, _ -> ok(c.readable()) }, { _ -> err() }) })
                    ask<OilLevelState> { ok, err -> safety.getEngineOilLevelState(ok, err) }?.let { VehicleTerms.fluid(it.name) } else null
            }
            val brakeFluid = async {
                if (can("brakeFluid") { ok, err -> safety.checkBrakeFluidLevelStateCapabilities({ c, _ -> ok(c.readable()) }, { _ -> err() }) })
                    ask<OilLevelState> { ok, err -> safety.getBrakeFluidLevelState(ok, err) }?.let { VehicleTerms.fluid(it.name) } else null
            }
            val doors = async { withTimeoutOrNull(GROUP_TIMEOUT_MS) { doors() } }
            val port = async {
                if (can("chargePort") { ok, err -> vehicle.getEvBattery().checkEvChargePortOpenCapabilities({ c -> ok(c.readable()) }, { _ -> err() }) })
                    ask<Boolean> { ok, err -> vehicle.getEvBattery().isEvChargePortOpen(ok, err) } else null
            }
            val seats = async { withTimeoutOrNull(GROUP_TIMEOUT_MS) { seats() } }
            // Gear has no capability call in 2.3.2: an unsupported car answers through onFailed (→ null).
            val gear = async { ask<VehicleGear> { ok, err -> vehicle.getGear().getCurrentGearSelectionState(ok, err) }?.takeIf { it != VehicleGear.GEAR_UNKNOWN } }
            val mode = async {
                if (can("driveMode") { ok, err -> vehicle.getDrivingMode().checkDrivingModeStateCapabilities({ c -> ok(c.readable()) }, { _ -> err() }) })
                    ask<DrivingModeType> { ok, err -> vehicle.getDrivingMode().getCurrentDrivingModeState(ok, err) }?.let { VehicleTerms.driveMode(it.name) } else null
            }
            val odometer = async {
                if (can("odometer") { ok, err -> vehicle.getOdometer().checkCurrentDistanceDrivenCapabilities({ c -> ok(c.readable()) }, { _ -> err() }) })
                    ask<Float> { ok, err -> vehicle.getOdometer().getCurrentDistanceDriven(ok, err) }?.toDouble() else null
            }
            val s = seats.await()
            val d = doors.await()
            VehicleSnapshot(
                powerLimited = power.await(), washerLow = washer.await(), engineOil = oil.await(), brakeFluid = brakeFluid.await(),
                doorsOpen = d?.first, trunkOpen = d?.second, chargePortOpen = port.await(), occupants = s?.first, unbuckled = s?.second,
                gearPark = gear.await()?.let { it == VehicleGear.GEAR_PARK }, driveMode = mode.await(), odometerKm = odometer.await(),
            ).takeUnless { it.empty }.also { if (BuildConfig.DEBUG) Log.d(TAG, "snapshot $it supported=$supported") }
        }
    }

    /**
     * (open passenger doors, trunk-or-hood open) among the areas the car reports; either half is null when the car
     * reports no such area. "Open" = above the area's closed (minimum) position; the fully-open value differs per car.
     */
    private suspend fun doors(): Pair<Int?, Boolean?>? {
        val areas = areas<DoorArea, AreaBounds<Int>>("doors") { ok, err -> vehicle.getDoor().checkDoorPositionCapabilities({ c: CapabilityConfig, m: Map<DoorArea, AreaBounds<Int>> -> ok(if (c.readable()) m else emptyMap()) }, { _ -> err() }) } ?: return null
        var open = 0
        var doorsAnswered = 0
        var lid: Boolean? = null
        for ((area, bounds) in areas) {
            val pos = ask<Int> { ok, err -> vehicle.getDoor().getCurrentDoorPosition(area, ok, err) } ?: continue
            val isOpen = pos > bounds.minValue
            if (area.values.any { it == DoorValue.REAR || it == DoorValue.HOOD }) lid = (lid == true) || isOpen
            else { doorsAnswered++; if (isOpen) open++ }
        }
        if (doorsAnswered == 0 && lid == null) return null
        return open.takeIf { doorsAnswered > 0 } to lid
    }

    /** (occupied seats, of those without a belt on). A seat whose belt state is unknown is not counted as unbuckled. */
    private suspend fun seats(): Pair<Int, Int>? {
        val seat = vehicle.getSeat()
        val areas = areas<SeatArea, Unit>("seats") { ok, err -> seat.checkSeatOccupancyCapabilities({ c: CapabilityConfig, l: List<SeatArea> -> ok(if (c.readable()) l.associateWith { } else emptyMap()) }, { _ -> err() }) }?.keys ?: return null
        if (areas.isEmpty()) return null
        var occupied = 0
        var unbuckled = 0
        var answered = 0
        for (area in areas) {
            val on = ask<Boolean> { ok, err -> seat.getCurrentSeatOccupancy(area, ok, err) } ?: continue
            answered++
            if (!on) continue
            occupied++
            if (ask<Boolean> { ok, err -> seat.getCurrentSeatBeltBuckledState(area, ok, err) } == false) unbuckled++
        }
        return (occupied to unbuckled).takeIf { answered > 0 }
    }

    /* ---------- plumbing ---------- */

    private fun CapabilityConfig.readable() = accessType == AccessType.READ || accessType == AccessType.READ_WRITE

    private val areaCache = ConcurrentHashMap<String, Map<*, *>>()

    /** The areas a per-area reading supports, asked once. Null = no answer yet; empty = not supported. */
    @Suppress("UNCHECKED_CAST")
    private suspend fun <K, V> areas(key: String, check: (ok: (Map<K, V>) -> Unit, err: () -> Unit) -> Unit): Map<K, V>? {
        areaCache[key]?.let { return it as Map<K, V> }
        val got = withTimeoutOrNull(TIMEOUT_MS) {
            suspendCancellableCoroutine<Map<K, V>> { c ->
                runCatching { check({ m -> if (c.isActive) c.resume(m) }, { if (c.isActive) c.resume(emptyMap()) }) }.onFailure { if (c.isActive) c.resume(emptyMap()) }
            }
        } ?: return null
        areaCache[key] = got
        return got
    }

    /** Whether the car supports a reading, asked once and remembered. A timeout counts as "no" for now and is asked again next time. */
    private suspend fun can(key: String, check: (ok: (Boolean) -> Unit, err: () -> Unit) -> Unit): Boolean {
        supported[key]?.let { return it }
        val got = withTimeoutOrNull(TIMEOUT_MS) {
            suspendCancellableCoroutine<Boolean> { c ->
                runCatching { check({ v -> if (c.isActive) c.resume(v) }, { if (c.isActive) c.resume(false) }) }.onFailure { if (c.isActive) c.resume(false) }
            }
        } ?: return false
        supported[key] = got
        return got
    }

    /** One getter as a suspend call: the value, or null on failure (unsupported, no permission) or no answer in time. */
    private suspend fun <T : Any> ask(call: (ok: (T?) -> Unit, err: (Exception) -> Unit) -> Unit): T? = withTimeoutOrNull(TIMEOUT_MS) {
        suspendCancellableCoroutine<T?> { c ->
            runCatching { call({ v -> if (c.isActive) c.resume(v) }, { if (c.isActive) c.resume(null) }) }.onFailure { if (c.isActive) c.resume(null) }
        }
    }

    private companion object {
        /** Debug builds only: readings as enums and numbers (no identifiers, no position). */
        const val TAG = "TteonaljidoVehicle"
        const val TIMEOUT_MS = 3_000L
        /** Doors and seats ask one area at a time; the whole group gives up after this. */
        const val GROUP_TIMEOUT_MS = 8_000L
    }
}
