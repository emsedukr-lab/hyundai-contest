package io.tteonaljido.car

import android.app.Application
import android.content.pm.PackageManager
import android.os.Build
import io.tteonaljido.car.handoff.PairingClient
import io.tteonaljido.car.navi.NaviGateway
import io.tteonaljido.car.navi.OfflineNaviGateway
import io.tteonaljido.car.navi.PleosNaviGateway
import io.tteonaljido.car.safety.CarDrivingGate
import io.tteonaljido.car.safety.DemoDrivingGate
import io.tteonaljido.car.safety.DriveState
import io.tteonaljido.car.safety.DrivingGate
import io.tteonaljido.car.storage.SecureBox
import io.tteonaljido.car.storage.SessionStore
import io.tteonaljido.car.storage.TripRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class App : Application() {
    lateinit var container: Container
        private set

    override fun onCreate() {
        super.onCreate()
        container = Container(this)
    }
}

/** Manual dependency wiring (the Pleos SDK pulls in Hilt, but the app does not need it). */
class Container(private val app: Application) {
    val isAutomotive = app.packageManager.hasSystemFeature(PackageManager.FEATURE_AUTOMOTIVE)
    val isEmulator = Build.HARDWARE.contains("ranchu") || Build.FINGERPRINT.contains("generic")

    private val box = SecureBox()
    val sessions = SessionStore(app.filesDir, box)
    val client = PairingClient(BuildConfig.API_BASE)
    val navi: NaviGateway = if (isAutomotive) PleosNaviGateway(app) else OfflineNaviGateway()

    /** Demo mode (emulator only) uses a separate store and an in-app driving switch. */
    val demo = MutableStateFlow(false)
    val demoGate = DemoDrivingGate()
    private val carGate: DrivingGate? = if (isAutomotive) CarDrivingGate(app) else null
    private val unknown = MutableStateFlow(DriveState.UNKNOWN)

    fun drive(): StateFlow<DriveState> = if (demo.value) demoGate.state else carGate?.state ?: unknown
    fun trips() = TripRepository(app.filesDir, demo.value, box)
}
