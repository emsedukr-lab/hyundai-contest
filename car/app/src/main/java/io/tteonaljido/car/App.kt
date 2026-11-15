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
import io.tteonaljido.car.vehicle.PleosVehicleReader
import io.tteonaljido.trip.DriveSession
import io.tteonaljido.trip.DriveSessions
import io.tteonaljido.trip.LocalTrip
import io.tteonaljido.trip.VehicleSnapshot
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

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

    /** Read-only vehicle readings (Pleos Vehicle SDK); only on a real car (the emulator can't inject signals). */
    private val vehicle: PleosVehicleReader? = if (isAutomotive) PleosVehicleReader(app).also { it.start() } else null
    /** SOC/fuel/range for charge·refuel advice. */
    suspend fun readEnergy(): EnergyState? = vehicle?.readEnergy()
    /** Warning lamps, fluids, doors, seats, gear, drive mode, odometer — for the departure check and rest advice. */
    suspend fun readSnapshot(): VehicleSnapshot? = vehicle?.readSnapshot()

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

    /** on while the navigation measures legs, so the app is not frozen behind it ([io.tteonaljido.car.navi.MeasureService]). */
    fun keepRunning(on: Boolean) { if (on) io.tteonaljido.car.navi.MeasureService.start(app) else io.tteonaljido.car.navi.MeasureService.stop(app) }

    /**
     * Asks for this app's screen back once the measurement is over. The system usually declines while the navigation is
     * in front (background activity start, seen on the emulator); the driver then returns by hand, and the result waits.
     */
    fun toFront() {
        runCatching { app.startActivity(android.content.Intent(app, MainActivity::class.java).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP or android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)) }
    }

    /**
     * How long the car has been driven without a real break. App-scoped so it keeps counting while the navigation
     * is in front; it follows the same driving state as the screens (demo switch in demo mode) and holds nothing but
     * two timestamps and the odometer at the start — in memory only.
     */
    val driveSession = MutableStateFlow(DriveSession())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    @Volatile private var driving = false
    fun isDriving() = driving
    /** The odometer reading (when the car reports one) says how far this stretch has gone. */
    fun noteOdometer(km: Double?) { if (km != null) driveSession.update { DriveSessions.step(it, driving, nowMs(), km) } }

    init {
        // Unknown is "locked" for the screens but is not counted as driving: only a state the platform reports as restricted is.
        scope.launch {
            combine(demo, carGate?.state ?: unknown, demoGate.state) { d, car, dm -> (if (d) dm else car) == DriveState.RESTRICTED }.collect { moving ->
                driving = moving
                driveSession.update { DriveSessions.step(it, moving, nowMs()) }
            }
        }
        // The demo clock moves the app's "now"; the stretch moves with it instead of suddenly looking days long.
        scope.launch {
            var last = clockOffset.value
            clockOffset.collect { offset ->
                val delta = offset - last
                last = offset
                if (delta != 0L) driveSession.update { it.shifted(delta) }
            }
        }
    }
}
