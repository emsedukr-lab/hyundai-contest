// not used by the current screens or timetable — kept as the groundwork for estimating real parking time from
// NaviHelper + Vehicle SDK data (navigation ended → ignition off + belt released + doors locked) later.
package io.tteonaljido.car.vehicle

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.emptyFlow

/**
 * Read-only vehicle signals for parking/stay measurement. The state machine and collector depend only on this
 * interface, never on the Pleos Vehicle SDK directly (mirrors how [io.tteonaljido.car.navi.NaviGateway] fronts the
 * navigation SDK). Each flow is the live stream of one domain; a domain the car does not support simply never emits
 * (or emits null for gear). No control APIs are exposed — measurement is read-only (principle 4).
 *
 * The real SDK adapter (`PleosVehicleSignals`, phase 2) builds these with callbackFlow + capability checks and only
 * calls `release()` after every listener is unregistered. [FakeVehicleSignals] stands in for tests and off-car runs;
 * when the real SDK fails to connect we surface "차량 신호 미연결" via [connected] rather than silently faking data.
 */
interface VehicleSignals {
    /** Whether the vehicle service is actually connected. False ⇒ measurement is skipped (shown as "미연결"). */
    val connected: StateFlow<Boolean>
    /** Cumulative driving distance (any unit; only increase/no-increase matters). */
    val distance: Flow<Double>
    val parkingBrake: Flow<Boolean>
    val driverDoorOpen: Flow<Boolean>
    val seatBeltUnbuckled: Flow<Boolean>
    /** Gear in Park; null stream when the car does not expose gear (then it is simply not counted). */
    val gearPark: Flow<Boolean?>
    /** One emission just before the vehicle powers down. */
    val powerDown: Flow<Unit>
    fun close() {}
}

/** Off-car / unsupported stand-in: never connected, emits nothing. The app stays fully functional (principle 6). */
class OfflineVehicleSignals : VehicleSignals {
    override val connected = MutableStateFlow(false).asStateFlow()
    override val distance = emptyFlow<Double>()
    override val parkingBrake = emptyFlow<Boolean>()
    override val driverDoorOpen = emptyFlow<Boolean>()
    override val seatBeltUnbuckled = emptyFlow<Boolean>()
    override val gearPark = emptyFlow<Boolean?>()
    override val powerDown = emptyFlow<Unit>()
}

/** Controllable fake for tests and the emulator (which cannot inject real vehicle signals). */
class FakeVehicleSignals : VehicleSignals {
    private val _connected = MutableStateFlow(false)
    override val connected = _connected.asStateFlow()
    override val distance = MutableSharedFlow<Double>(extraBufferCapacity = 16)
    override val parkingBrake = MutableStateFlow(false)
    override val driverDoorOpen = MutableStateFlow(false)
    override val seatBeltUnbuckled = MutableStateFlow(false)
    override val gearPark = MutableStateFlow<Boolean?>(null)
    override val powerDown = MutableSharedFlow<Unit>(extraBufferCapacity = 4)

    fun setConnected(on: Boolean) { _connected.value = on }
}
