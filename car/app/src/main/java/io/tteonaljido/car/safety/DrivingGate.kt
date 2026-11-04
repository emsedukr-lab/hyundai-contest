package io.tteonaljido.car.safety

import android.car.Car
import android.car.drivingstate.CarUxRestrictionsManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

enum class DriveState { PARKED, RESTRICTED, UNKNOWN }

/**
 * Wraps CarUxRestrictions. Unknown counts as restricted: QR display, import approval and route requests
 * are only offered while the platform says no distraction optimization is required.
 */
interface DrivingGate {
    val state: StateFlow<DriveState>
    fun close() {}
}

val DriveState.parked get() = this == DriveState.PARKED

class CarDrivingGate(context: Context) : DrivingGate {
    private val flow = MutableStateFlow(DriveState.UNKNOWN)
    override val state: StateFlow<DriveState> = flow
    private var car: Car? = null
    private var manager: CarUxRestrictionsManager? = null

    init {
        try {
            car = Car.createCar(context, Handler(Looper.getMainLooper()), Car.CAR_WAIT_TIMEOUT_DO_NOT_WAIT) { c, ready ->
                if (!ready) flow.value = DriveState.UNKNOWN
                else runCatching {
                    val m = c.getCarManager(Car.CAR_UX_RESTRICTION_SERVICE) as CarUxRestrictionsManager
                    manager = m
                    m.registerListener { r -> flow.value = if (r.isRequiresDistractionOptimization) DriveState.RESTRICTED else DriveState.PARKED }
                    flow.value = if (m.currentCarUxRestrictions.isRequiresDistractionOptimization) DriveState.RESTRICTED else DriveState.PARKED
                }.onFailure { flow.value = DriveState.UNKNOWN }
            }
        } catch (e: Throwable) {
            flow.value = DriveState.UNKNOWN
        }
    }

    override fun close() {
        runCatching { manager?.unregisterListener(); car?.disconnect() }
        flow.value = DriveState.UNKNOWN
    }
}

/** Emulator-only demo gate: lets the demo toggle "driving" without the vehicle HAL. Never used on a real car. */
class DemoDrivingGate : DrivingGate {
    private val flow = MutableStateFlow(DriveState.PARKED)
    override val state: StateFlow<DriveState> = flow
    fun set(driving: Boolean) { flow.value = if (driving) DriveState.RESTRICTED else DriveState.PARKED }
}
