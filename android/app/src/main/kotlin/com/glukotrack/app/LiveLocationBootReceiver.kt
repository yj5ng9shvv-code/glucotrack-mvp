package com.glukotrack.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/** Restores a user-consented Family Watch foreground service after reboot. */
class LiveLocationBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val prefs = context.getSharedPreferences(LiveLocationService.PREFS, Context.MODE_PRIVATE)
        val token = prefs.getString(LiveLocationService.PREF_TOKEN, "").orEmpty()
        val endpoint = prefs.getString(LiveLocationService.PREF_ENDPOINT, "").orEmpty()
        if (token.isBlank() || endpoint.isBlank()) return
        val service = Intent(context, LiveLocationService::class.java).apply {
            action = LiveLocationService.ACTION_START
            putExtra("token", token)
            putExtra("endpoint", endpoint)
            putExtra("sosMode", prefs.getBoolean(LiveLocationService.PREF_SOS, false))
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(service)
        else context.startService(service)
    }
}
