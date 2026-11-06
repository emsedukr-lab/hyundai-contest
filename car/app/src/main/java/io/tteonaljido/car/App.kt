package io.tteonaljido.car

import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import io.tteonaljido.car.guide.GuidanceTracker
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
import io.tteonaljido.car.storage.TripStore
import io.tteonaljido.trip.LocalTrip
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
class Container(private val app: Application) : TripStore {
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

    /** Emulator demo only: shifts the app's clock (e.g. to day 2, 09:00) for scripted demos; the screen says so while on. */
    val clockOffset = MutableStateFlow(0L)
    fun nowMs(): Long = System.currentTimeMillis() + clockOffset.value

    private val prefs = app.getSharedPreferences("settings", Context.MODE_PRIVATE)
    /** Mark a stop as visited when the navigation reports arriving there (default on; always undoable). */
    val autoArrive = MutableStateFlow(prefs.getBoolean("autoArrive", true))
    fun setAutoArrive(on: Boolean) {
        prefs.edit().putBoolean("autoArrive", on).apply()
        autoArrive.value = on
    }

    private val tripLock = Any()

    /** One lock for every read-modify-write of the trip files (a repository instance is per call, so its own lock is not enough). */
    override fun <T> locked(f: (TripRepository) -> T): T = synchronized(tripLock) { f(trips()) }

    /** The single write path for one stored trip. */
    fun updateTrip(localId: String, f: (LocalTrip) -> LocalTrip): LocalTrip? = locked { repo ->
        val t = repo.load().trips.firstOrNull { it.localId == localId } ?: return@locked null
        f(t).also(repo::save)
    }

    fun deleteTrip(localId: String) { locked { it.delete(localId) } }
    fun deleteAllTrips() { locked { it.deleteAll() } }

    val tracker = GuidanceTracker(this)
}
