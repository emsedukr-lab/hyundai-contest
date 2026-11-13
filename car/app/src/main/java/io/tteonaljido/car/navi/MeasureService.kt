package io.tteonaljido.car.navi

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import io.tteonaljido.car.MainActivity
import io.tteonaljido.car.R

/**
 * Keeps this app's process running while the navigation measures the trip's legs (M63).
 *
 * A measuring route really starts in the navigation, and the navigation comes to the front when it does. An app behind
 * it is frozen by the system about ten seconds later — before the route's numbers have arrived, and with more routes
 * still to send. A short foreground service, started on the driver's tap and stopped when the measurement ends (well
 * within the platform's limit for a short service), is what keeps the measurement going. It does nothing itself.
 */
class MeasureService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, getString(R.string.measure_title), NotificationManager.IMPORTANCE_LOW))
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        val note = Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_pin)
            .setContentTitle(getString(R.string.measure_title))
            .setContentText(getString(R.string.navi_plan_note))
            .setContentIntent(open)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID, note, ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE) else startForeground(ID, note)
        return START_NOT_STICKY
    }

    /** The platform's time limit for a short service: the measurement stops itself long before, this is the backstop. */
    override fun onTimeout(startId: Int) { stopSelf() }

    companion object {
        private const val CHANNEL = "measure"
        private const val ID = 63
        /** Only ever called from a tap on the screen, so the app is in front and may start it. */
        fun start(context: Context) { runCatching { context.startForegroundService(Intent(context, MeasureService::class.java)) } }
        fun stop(context: Context) { runCatching { context.stopService(Intent(context, MeasureService::class.java)) } }
    }
}
