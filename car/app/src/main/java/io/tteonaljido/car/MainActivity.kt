package io.tteonaljido.car

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import io.tteonaljido.car.handoff.ImportViewModel
import io.tteonaljido.car.safety.DriveState
import io.tteonaljido.car.safety.parked
import io.tteonaljido.car.ui.screens.ImportScreen
import io.tteonaljido.car.ui.screens.SettingsScreen
import io.tteonaljido.car.ui.screens.TripDetailScreen
import io.tteonaljido.car.ui.screens.TripsScreen
import io.tteonaljido.car.ui.theme.PleosTheme

private sealed interface Route {
    data object Trips : Route
    data class Detail(val id: String) : Route
    data object Import : Route
    data object Settings : Route
}

class MainActivity : ComponentActivity() {
    private var tripsVm: TripsViewModel? = null
    private var importVm: ImportViewModel? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val c = (application as App).container
        handleDemoIntent(intent)
        setContent {
            PleosTheme {
                val demo by c.demo.collectAsState()
                val drive by remember(demo) { c.drive() }.collectAsState()
                val demoDriving by c.demoGate.state.collectAsState()
                val clockOffset by c.clockOffset.collectAsState()
                val autoArrive by c.autoArrive.collectAsState()
                val trips: TripsViewModel = viewModel(
                    key = "trips-$demo",
                    factory = viewModelFactory { initializer { TripsViewModel(c::trips, c::updateTrip, c::deleteTrip, c::deleteAllTrips, c.navi, c.tracker, c::nowMs, c.clockOffset, getString(R.string.home), getString(R.string.home_bookmark)) } },
                )
                tripsVm = trips
                val import: ImportViewModel = viewModel(
                    key = "import-$demo",
                    factory = viewModelFactory { initializer { ImportViewModel(c.client, c, c.sessions, BuildConfig.WEB_ORIGIN, onTripsChanged = { tripsVm?.reload() }) } },
                )
                importVm = import
                var route by remember { mutableStateOf<Route>(Route.Trips) }
                // Settings (delete all, demo switches) is parked-only: leave it the moment the car moves.
                LaunchedEffect(drive) { if (!drive.parked && route == Route.Settings) route = Route.Trips }

                // Top-level Back hides the app instead of finishing it (Pleos CCP rule); state survives.
                BackHandler { if (route == Route.Trips) moveTaskToBack(true) else route = Route.Trips }

                when (val r = route) {
                    Route.Trips -> TripsScreen(trips, drive, clockOffset != 0L, onImport = { import.start(); route = Route.Import }, onOpen = { route = Route.Detail(it) }, onSettings = { route = Route.Settings })
                    is Route.Detail -> TripDetailScreen(trips, r.id, drive, clockOffset != 0L, onBack = { route = Route.Trips })
                    Route.Import -> ImportScreen(import, drive, onClose = { trips.reload(); route = Route.Trips }, onOpenTrip = { trips.reload(); route = Route.Detail(it) })
                    Route.Settings -> SettingsScreen(
                        trips, c.isEmulator, demo, demoDriving == DriveState.RESTRICTED, clockOffset != 0L, autoArrive, BuildConfig.API_BASE,
                        onDemo = { on -> c.demo.value = on && c.isEmulator },
                        onDemoDriving = { on -> c.demoGate.set(on) },
                        onDemoClock = { on -> setDemoClock(if (on) demoDayTwo() else null) },
                        onDemoArrive = { if (c.isEmulator && c.demo.value) c.navi.demoArrive() },
                        onAutoArrive = c::setAutoArrive,
                        onBack = { route = Route.Trips },
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDemoIntent(intent)
    }

    /** Emulator demo mode only: moves the app clock to `target` (null = real time). The screen shows a demo-time line while on. */
    private fun setDemoClock(target: java.time.ZonedDateTime?) {
        val c = (application as App).container
        if (!c.isEmulator || !c.demo.value) return
        c.clockOffset.value = target?.let { it.toInstant().toEpochMilli() - System.currentTimeMillis() } ?: 0L
    }

    /** Day 2 of the earliest stored trip at 09:00 in its time zone (the sample: 2026-11-21 09:00 KST). */
    private fun demoDayTwo(): java.time.ZonedDateTime {
        val c = (application as App).container
        val t = c.trips().load().trips.minByOrNull { it.plan.startDate }
        val zone = java.time.ZoneId.of(t?.plan?.timezone ?: "Asia/Seoul")
        val start = java.time.LocalDate.parse(t?.plan?.startDate ?: "2026-11-20")
        return start.plusDays(1).atTime(9, 0).atZone(zone)
    }

    /**
     * Debug builds on the emulator only, for scripted tests:
     * `am start ... --ez demo true --ez demoDriving true --es demoNow 2026-11-21T09:00 --ez demoArrive true`.
     */
    private fun handleDemoIntent(intent: Intent?) {
        val c = (application as App).container
        if (!BuildConfig.DEBUG || !c.isEmulator || intent == null) return
        if (intent.hasExtra("demo")) c.demo.value = intent.getBooleanExtra("demo", false)
        if (intent.hasExtra("demoDriving")) c.demoGate.set(intent.getBooleanExtra("demoDriving", false))
        // Scripted tests only: empty the current (demo) store without the Settings popup, which UI Automator misses on a loaded emulator.
        if (intent.getBooleanExtra("demoWipe", false)) { c.deleteAllTrips(); c.sessions.clearActive(); c.sessions.clearPending(); tripsVm?.reload() } // a clean slate: trips and any resumable import session
        intent.getStringExtra("demoNow")?.let { v -> setDemoClock(if (v == "off") null else java.time.LocalDateTime.parse(v).atZone(java.time.ZoneId.of("Asia/Seoul"))) }
        if (intent.getBooleanExtra("demoArrive", false) && c.demo.value) c.navi.demoArrive()
        intent.getStringExtra("probe")?.let { (c.navi as? io.tteonaljido.car.navi.PleosNaviGateway)?.probe?.run(it) }
    }

    override fun onResume() {
        super.onResume()
        tripsVm?.onResume() // returning from the navigation's own search
        importVm?.retryPending() // a result the relay has not taken yet (offline, 429, 5xx)
    }
}
