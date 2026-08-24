package com.glukotrack.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import kotlin.concurrent.thread

/**
 * Opt-in Android foreground service for family live location. It uploads only
 * the current point and keeps no local route history. The service is not sticky:
 * if Android stops it, the patient must explicitly enable sharing again.
 */
class LiveLocationService : Service(), LocationListener {
    companion object {
        const val ACTION_START = "com.glukotrack.app.live_location.START"
        const val ACTION_STOP = "com.glukotrack.app.live_location.STOP"
        private const val CHANNEL_ID = "glucotrack_live_location"
        private const val NOTIFICATION_ID = 4110
        const val PREFS = "glucotrack_live_location"
        const val PREF_TOKEN = "token"
        const val PREF_ENDPOINT = "endpoint"
        const val PREF_SOS = "sos_mode"
    }

    private lateinit var manager: LocationManager
    private var token = ""
    private var endpoint = ""
    private var sosMode = false
    private var lastUploadAt = 0L

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
            stopSelf()
            return START_NOT_STICKY
        }
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        token = intent?.getStringExtra("token") ?: prefs.getString(PREF_TOKEN, "").orEmpty()
        endpoint = intent?.getStringExtra("endpoint") ?: prefs.getString(PREF_ENDPOINT, "").orEmpty()
        sosMode = intent?.getBooleanExtra("sosMode", prefs.getBoolean(PREF_SOS, false)) == true
        if (token.isBlank() || endpoint.isBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }
        prefs.edit()
            .putString(PREF_TOKEN, token)
            .putString(PREF_ENDPOINT, endpoint)
            .putBoolean(PREF_SOS, sosMode)
            .apply()
        startForeground(NOTIFICATION_ID, notification())
        manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        if (!hasLocationPermission()) {
            stopSelf()
            return START_NOT_STICKY
        }
        try {
            val interval = if (sosMode) 10_000L else 60_000L
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, interval, 10f, this)
            manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, interval, 20f, this)
        } catch (_: IllegalArgumentException) {
            // A provider may not exist on a specific device.
        }
        return START_STICKY
    }

    override fun onDestroy() {
        if (::manager.isInitialized) manager.removeUpdates(this)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onLocationChanged(location: Location) {
        val now = System.currentTimeMillis()
        val moving = location.hasSpeed() && location.speed >= 1f
        val minimumInterval = if (sosMode) 10_000L else if (moving) 120_000L else 300_000L
        if (now - lastUploadAt < minimumInterval) return
        lastUploadAt = now
        upload(location)
    }

    private fun upload(location: Location) = thread(name = "live-location-upload") {
        try {
            val json = buildString {
                append('{')
                append("\"latitude\":").append(location.latitude).append(',')
                append("\"longitude\":").append(location.longitude).append(',')
                append("\"accuracyMeters\":").append(if (location.hasAccuracy()) location.accuracy else "null").append(',')
                append("\"speedMps\":").append(if (location.hasSpeed()) location.speed else "null").append(',')
                append("\"headingDegrees\":").append(if (location.hasBearing()) location.bearing else "null")
                append('}')
            }
            val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 12_000
                readTimeout = 12_000
                doOutput = true
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
            connection.outputStream.use { it.write(json.toByteArray(Charsets.UTF_8)) }
            connection.inputStream.close()
            connection.disconnect()
        } catch (_: Exception) {
            // Network failures are retried by the next location update.
        }
    }

    private fun hasLocationPermission() =
        ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun notification(): android.app.Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "GlucoTrack: семейная геолокация", NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Передача текущей геопозиции выбранным родственникам" }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Геолокация активна")
            .setContentText("Текущая позиция доступна выбранным родственникам")
            .setOngoing(true)
            .build()
    }
}
