package io.tteonaljido.car

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val c = (application as App).container
        handleDemoIntent(intent)
        setContent {
            PleosTheme {
                val demo by c.demo.collectAsState()
                val drive by remember(demo) { c.drive() }.collectAsState()
                val demoDriving by c.demoGate.state.collectAsState()
                val trips: TripsViewModel = viewModel(key = "trips-$demo", factory = viewModelFactory { initializer { TripsViewModel(c::trips, c.navi, getString(R.string.home), getString(R.string.home_bookmark)) } })
                tripsVm = trips
                val import: ImportViewModel = viewModel(
                    key = "import-$demo",
                    factory = viewModelFactory { initializer { ImportViewModel(c.client, c::trips, c.sessions, BuildConfig.WEB_ORIGIN, onTripsChanged = { tripsVm?.reload() }) } },
                )
                var route by remember { mutableStateOf<Route>(Route.Trips) }

                // Top-level Back hides the app instead of finishing it (Pleos CCP rule); state survives.
                BackHandler { if (route == Route.Trips) moveTaskToBack(true) else route = Route.Trips }

                when (val r = route) {
                    Route.Trips -> TripsScreen(trips, drive, onImport = { import.start(); route = Route.Import }, onOpen = { route = Route.Detail(it) }, onSettings = { route = Route.Settings })
                    is Route.Detail -> TripDetailScreen(trips, r.id, drive, onBack = { route = Route.Trips })
                    Route.Import -> ImportScreen(import, drive, onClose = { trips.reload(); route = Route.Trips }, onOpenTrip = { trips.reload(); route = Route.Detail(it) })
                    Route.Settings -> SettingsScreen(
                        trips, c.isEmulator, demo, demoDriving == DriveState.RESTRICTED, BuildConfig.API_BASE,
                        onDemo = { on -> c.demo.value = on && c.isEmulator },
                        onDemoDriving = { on -> c.demoGate.set(on) },
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

    /** Debug builds on the emulator only: `am start ... --ez demo true --ez demoDriving true` for scripted tests. */
    private fun handleDemoIntent(intent: Intent?) {
        val c = (application as App).container
        if (!BuildConfig.DEBUG || !c.isEmulator || intent == null) return
        if (intent.hasExtra("demo")) c.demo.value = intent.getBooleanExtra("demo", false)
        if (intent.hasExtra("demoDriving")) c.demoGate.set(intent.getBooleanExtra("demoDriving", false))
    }

    override fun onResume() {
        super.onResume()
        tripsVm?.onResume() // returning from the navigation's own search
    }
}
