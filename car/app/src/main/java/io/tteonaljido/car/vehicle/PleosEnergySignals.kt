package io.tteonaljido.car.vehicle

import ai.pleos.playground.vehicle.Vehicle
import android.content.Context
import io.tteonaljido.car.EnergyState
import io.tteonaljido.trip.VehicleKind
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume
import kotlin.math.roundToInt

/**
 * Phase-2 real energy adapter (read-only, `CAR_ENERGY`): reads EV state-of-charge / fuel % / remaining range from the
 * Pleos Vehicle SDK and infers EV vs ICE vs PHEV from which capability the car reports. One-shot getters are polled by
 * the Container; a car that doesn't support a domain simply never answers (→ null), so unsupported cars give no advice.
 * No control API is used (`CONTROL_CAR_ENERGY` is never declared). The emulator can't inject these signals, so this is
 * compile-verified here and runtime-verified on a real car / userdebug image; on the emulator the demo seed stands in.
 */
class PleosEnergySignals(context: Context) {
    private val vehicle = Vehicle(context)
    @Volatile private var started = false

    fun start() { if (!started) runCatching { vehicle.initialize() }.onSuccess { started = true } }
    fun close() { runCatching { vehicle.release() } }

    /** EV SOC / fuel % / range, chosen by the car's capabilities. Null when unknown or unsupported. */
    suspend fun read(): EnergyState? {
        if (!started) return null
        val range = rangeKm()
        return when (val kind = kind()) {
            VehicleKind.EV, VehicleKind.PHEV -> EnergyState(kind, evSoc(), range)
            VehicleKind.ICE -> EnergyState(kind, fuelPercent(), range)
            VehicleKind.UNKNOWN -> null
        }
    }

    private suspend fun kind(): VehicleKind {
        val ev = probe { ok, err -> vehicle.getEvBattery().checkEvBatteryStateOfChargeCapabilities({ _ -> ok() }, { _ -> err() }) }
        val ice = probe { ok, err -> vehicle.getFuel().checkFuelPercentCapabilities({ _ -> ok() }, { _ -> err() }) }
        return when {
            ev && ice -> VehicleKind.PHEV
            ev -> VehicleKind.EV
            ice -> VehicleKind.ICE
            else -> VehicleKind.UNKNOWN
        }
    }

    private suspend fun evSoc(): Int? = oneShotInt { ok, err -> vehicle.getEvBattery().getEvBatteryStateOfCharge(ok, err) }
    private suspend fun fuelPercent(): Int? = oneShotInt { ok, err -> vehicle.getFuel().getFuelPercent(ok, err) }
    @Suppress("DEPRECATION") // getRangeRemainingDistance is the 2.3.2 read path; the Google RANGE_REMAINING property is a later migration.
    private suspend fun rangeKm(): Int? = withTimeoutOrNull(TIMEOUT_MS) {
        suspendCancellableCoroutine<Int?> { c ->
            vehicle.getOdometer().getRangeRemainingDistance({ m -> if (c.isActive) c.resume(m?.let { (it / 1000f).roundToInt() }) }, { if (c.isActive) c.resume(null) })
        }
    }

    private suspend fun oneShotInt(call: (ok: (Int?) -> Unit, err: (Exception) -> Unit) -> Unit): Int? = withTimeoutOrNull(TIMEOUT_MS) {
        suspendCancellableCoroutine<Int?> { c -> call({ v -> if (c.isActive) c.resume(v) }, { if (c.isActive) c.resume(null) }) }
    }

    private suspend fun probe(call: (ok: () -> Unit, err: () -> Unit) -> Unit): Boolean = withTimeoutOrNull(TIMEOUT_MS) {
        suspendCancellableCoroutine<Boolean> { c -> call({ if (c.isActive) c.resume(true) }, { if (c.isActive) c.resume(false) }) }
    } ?: false

    private companion object { const val TIMEOUT_MS = 3_000L }
}
