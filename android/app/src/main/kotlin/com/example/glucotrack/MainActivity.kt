package com.example.glucotrack

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.location.Location
import android.location.LocationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Bundle
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.security.MessageDigest

class MainActivity : FlutterActivity() {
    private val channelName = "glucotrack/emergency"
    private val notificationChannelId = "glucotrack_sos"
    private val lockScreenChannelId = "glucotrack_sos_card_v2"
    private val sosCardPrefsName = "glucotrack_sos_card"
    private val sosCardUpdatedAction = "com.example.glucotrack.SOS_CARD_UPDATED"
    private val voiceRequestCode = 4104
    private val voicePermissionRequestCode = 4108
    private var pendingEmergencyData: Map<*, *>? = null
    private var pendingLockScreenData: Map<*, *>? = null
    private var pendingVoiceResult: MethodChannel.Result? = null
    private var pendingVoiceLanguage: String = ""
    private var pendingVoicePrompt: String = ""
    private var speechRecognizer: SpeechRecognizer? = null
    private var pendingLocationResult: MethodChannel.Result? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        NotificationManagerCompat.from(this).cancel(4103)
        super.onCreate(savedInstanceState)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "showEmergencyAlert" -> {
                        val data = call.arguments as? Map<*, *> ?: emptyMap<String, String>()
                        showEmergencyAlert(data)
                        result.success(null)
                    }
                    "updateLockScreenCard" -> {
                        val data = call.arguments as? Map<*, *> ?: emptyMap<String, String>()
                        updateLockScreenCard(data)
                        result.success(null)
                    }
                    "dial" -> {
                        val phone = call.argument<String>("phone").orEmpty()
                        startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(phone)}")))
                        result.success(null)
                    }
                    "composeSms" -> {
                        val phone = call.argument<String>("phone").orEmpty()
                        val message = call.argument<String>("message").orEmpty()
                        val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:${Uri.encode(phone)}"))
                            .putExtra("sms_body", message)
                        startActivity(intent)
                        result.success(null)
                    }
                    "getCurrentLocation" -> getCurrentLocation(result)
                    "openAppSettings" -> {
                        openAppSettings()
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "glucotrack/voice")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "listen" -> {
                        if (pendingVoiceResult != null) {
                            result.error("busy", getString(R.string.voice_busy), null)
                            return@setMethodCallHandler
                        }
                        val language = call.argument<String>("language").orEmpty()
                        val prompt = call.argument<String>("prompt").orEmpty().ifBlank {
                            getString(R.string.voice_prompt)
                        }
                        if (!ensureVoicePermission(result, language, prompt)) {
                            return@setMethodCallHandler
                        }
                        startVoiceRecognition(language, prompt, result)
                    }
                    "openAppSettings" -> {
                        openAppSettings()
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "glucotrack/device")
            .setMethodCallHandler { call, result ->
                if (call.method != "getDeviceHash") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                val androidId = Settings.Secure.getString(
                    contentResolver,
                    Settings.Secure.ANDROID_ID
                ).orEmpty()
                val source = "$packageName:$androidId:glucotrack-trial-v1"
                val hash = MessageDigest.getInstance("SHA-256")
                    .digest(source.toByteArray(Charsets.UTF_8))
                    .joinToString("") { "%02x".format(it) }
                result.success("android:$hash")
            }
    }

    private fun ensureVoicePermission(
        result: MethodChannel.Result,
        language: String,
        prompt: String
    ): Boolean {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            return true
        }

        pendingVoiceResult = result
        pendingVoiceLanguage = language
        pendingVoicePrompt = prompt
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.RECORD_AUDIO),
            voicePermissionRequestCode
        )
        return false
    }

    private fun startVoiceRecognition(
        language: String,
        prompt: String,
        result: MethodChannel.Result
    ) {
        val recognizer = createSpeechRecognizer() ?: run {
            result.error("unavailable", getString(R.string.voice_unavailable), null)
            return
        }
        val speechLanguage = speechLocale(language)
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, speechLanguage)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, speechLanguage)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
            putExtra(RecognizerIntent.EXTRA_PROMPT, prompt)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
        }
        pendingVoiceResult = result
        speechRecognizer = recognizer
        recognizer.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) = Unit
            override fun onBeginningOfSpeech() = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() = Unit
            override fun onPartialResults(partialResults: Bundle?) = Unit
            override fun onEvent(eventType: Int, params: Bundle?) = Unit

            override fun onResults(results: Bundle?) {
                val matches = results
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull()?.trim().orEmpty()
                finishVoiceRecognition {
                    if (text.isBlank()) {
                        it.error("no_match", getString(R.string.voice_unavailable), null)
                    } else {
                        it.success(text)
                    }
                }
            }

            override fun onError(error: Int) {
                val code = when (error) {
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "permission_denied"
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "busy"
                    SpeechRecognizer.ERROR_NO_MATCH,
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "no_match"
                    else -> "unavailable"
                }
                finishVoiceRecognition { it.error(code, getString(R.string.voice_unavailable), null) }
            }
        })
        try {
            recognizer.startListening(intent)
        } catch (_: Exception) {
            finishVoiceRecognition { it.error("unavailable", getString(R.string.voice_unavailable), null) }
        }
    }

    private fun createSpeechRecognizer(): SpeechRecognizer? {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            val service = Settings.Secure.getString(contentResolver, "voice_recognition_service")
                ?.let { ComponentName.unflattenFromString(it) }
                ?: return null
            return SpeechRecognizer.createSpeechRecognizer(this, service)
        }
        return SpeechRecognizer.createSpeechRecognizer(this)
    }

    private fun speechLocale(language: String): String {
        return when (language.lowercase()) {
            "ru" -> "ru-RU"
            "pl" -> "pl-PL"
            "de" -> "de-DE"
            "en" -> "en-US"
            "uk" -> "uk-UA"
            "fr" -> "fr-FR"
            "es" -> "es-ES"
            "it" -> "it-IT"
            "pt" -> "pt-PT"
            else -> language.ifBlank { "en-US" }
        }
    }

    private fun finishVoiceRecognition(complete: (MethodChannel.Result) -> Unit) {
        val result = pendingVoiceResult ?: return
        pendingVoiceResult = null
        speechRecognizer?.destroy()
        speechRecognizer = null
        complete(result)
    }

    private fun openAppSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:$packageName")
        }
        startActivity(intent)
    }

    @Deprecated("Deprecated in Android")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != voiceRequestCode) return
        val result = pendingVoiceResult ?: return
        pendingVoiceResult = null
        if (resultCode != Activity.RESULT_OK) {
            result.success(null)
            return
        }
        val matches = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
        result.success(matches?.firstOrNull())
    }

    private fun showEmergencyAlert(data: Map<*, *>) {
        createNotificationChannel(data)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            pendingEmergencyData = data
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                4102
            )
            return
        }

        val alertIntent = emergencyIntent(data)
        val pendingIntent = PendingIntent.getActivity(
            this,
            4102,
            alertIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val person = data["name"]?.toString().orEmpty()
        val glucose = data["glucose"]?.toString().orEmpty()
        val notification = NotificationCompat.Builder(this, notificationChannelId)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setColor(Color.RED)
            .setContentTitle(data["cardTitle"]?.toString().orEmpty().ifBlank { getString(R.string.sos) })
            .setContentText(listOf(person, glucose).filter { it.isNotBlank() }.joinToString(" · "))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, true)
            .setVibrate(longArrayOf(0, 700, 300, 700, 300, 1000))
            .build()
        NotificationManagerCompat.from(this).notify(4102, notification)
        startActivity(alertIntent)
    }

    private fun updateLockScreenCard(data: Map<*, *>) {
        val manager = NotificationManagerCompat.from(this)
        if (data["enabled"] != true) {
            manager.cancel(4103)
            return
        }
        saveLatestSosCard(data)
        createLockScreenChannel(data)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            pendingLockScreenData = data
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                4102
            )
            return
        }
        val name = data["name"]?.toString().orEmpty().ifBlank { "GlucoTrack" }
        val publicUrl = data["publicUrl"]?.toString().orEmpty()
        val diabetes = data["diabetesText"]?.toString().orEmpty().ifBlank { when (data["diabetesType"]?.toString()) {
            "type1" -> "1"
            "type2" -> "2"
            "gestational" -> getString(R.string.diabetes)
            else -> getString(R.string.diabetes)
        } }
        val allergyLine = allergyStatusText(data).let {
            if (it.isBlank()) "" else "${data["allergiesLabel"]?.toString().orEmpty().ifBlank { "ALLERGY" }}: $it"
        }
        val notificationText = listOf(diabetes, allergyLine)
            .filter { it.isNotBlank() }
            .joinToString(" · ")
        val qrData = publicUrl.ifBlank { emergencyQrText(data, name, diabetes) }
        val pendingIntent = PendingIntent.getActivity(
            this,
            4103,
            emergencyIntent(data),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = NotificationCompat.Builder(this, lockScreenChannelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setColor(Color.rgb(180, 35, 24))
            .setContentTitle("$name · SOS")
            .setContentText(
                "$diabetes · ${data["openCardLabel"]?.toString().orEmpty()}"
            )
            .setContentText(notificationText)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(pendingIntent)
            .addAction(
                android.R.drawable.ic_menu_call,
                data["call112Label"]?.toString().orEmpty().ifBlank { getString(R.string.call_112) },
                PendingIntent.getActivity(
                    this,
                    4112,
                    Intent(Intent.ACTION_DIAL, Uri.parse("tel:112")),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
            )
            .addAction(
                android.R.drawable.ic_menu_view,
                data["openCardLabel"]?.toString().orEmpty().ifBlank { getString(R.string.sos) },
                pendingIntent
            )
        qrBitmap(qrData)?.let { qr ->
            builder
                .setLargeIcon(qr)
                .setStyle(
                    NotificationCompat.BigPictureStyle()
                        .bigPicture(qr)
                        .bigLargeIcon(null as Bitmap?)
                )
        }
        manager.notify(4103, builder.build())
    }

    private fun saveLatestSosCard(data: Map<*, *>) {
        val editor = getSharedPreferences(sosCardPrefsName, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .putString("_payloadVersion", System.currentTimeMillis().toString())
        data.forEach { (key, value) ->
            editor.putString(key.toString(), value?.toString().orEmpty())
        }
        editor.apply()
        sendBroadcast(Intent(sosCardUpdatedAction).setPackage(packageName))
    }

    private fun emergencyQrText(data: Map<*, *>, name: String, diabetes: String): String {
        return listOf(
            "GlucoTrack SOS",
            "${data["nameLabel"]}: $name",
            "${data["diabetesLabel"]}: $diabetes",
            data["glucose"]?.toString().orEmpty().let { if (it.isBlank()) "" else "${data["glucoseLabel"]}: $it" },
            data["glucoseUpdatedAt"]?.toString().orEmpty().let { if (it.isBlank()) "" else "${data["lastUpdatedLabel"]}: $it" },
            data["bloodType"]?.toString().orEmpty().let { if (it.isBlank()) "" else "${data["bloodLabel"]}: $it" },
            data["insulinName"]?.toString().orEmpty().let { if (it.isBlank()) "" else "${data["insulinLabel"]}: $it" },
            allergyStatusText(data).let { if (it.isBlank()) "" else "${data["allergiesLabel"]}: $it" },
            data["contactName"]?.toString().orEmpty().let { if (it.isBlank()) "" else "${data["contactLabel"]}: $it" },
            data["contactPhone"]?.toString().orEmpty().let { if (it.isBlank()) "" else "${data["phoneLabel"]}: $it" },
            data["instructionText"]?.toString().orEmpty()
        ).filter { it.isNotBlank() }.joinToString("\n")
    }

    private fun allergyStatusText(data: Map<*, *>): String {
        val status = data["allergyStatus"]?.toString().orEmpty().trim()
        if (status.isNotBlank()) return status
        return data["allergies"]?.toString().orEmpty().trim()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 4102) {
            val data = pendingEmergencyData
            pendingEmergencyData = null
            if (data != null) {
                val granted = grantResults.isNotEmpty() &&
                    grantResults[0] == PackageManager.PERMISSION_GRANTED
                if (granted) showEmergencyAlert(data) else startActivity(emergencyIntent(data))
            }
            val lockData = pendingLockScreenData
            pendingLockScreenData = null
            if (lockData != null && grantResults.isNotEmpty() &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED
            ) {
                updateLockScreenCard(lockData)
            }
        } else if (requestCode == voicePermissionRequestCode) {
            val result = pendingVoiceResult ?: return
            pendingVoiceResult = null
            val granted = grantResults.isNotEmpty() &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED
            if (granted) {
                startVoiceRecognition(pendingVoiceLanguage, pendingVoicePrompt, result)
            } else if (grantResults.isNotEmpty() &&
                !ActivityCompat.shouldShowRequestPermissionRationale(
                    this,
                    Manifest.permission.RECORD_AUDIO
                )
            ) {
                result.error("permission_permanently_denied", getString(R.string.voice_unavailable), null)
            } else {
                result.error("permission_denied", getString(R.string.voice_unavailable), null)
            }
            pendingVoiceLanguage = ""
            pendingVoicePrompt = ""
        } else if (requestCode == 4105) {
            val result = pendingLocationResult ?: return
            pendingLocationResult = null
            val granted = grantResults.any { it == PackageManager.PERMISSION_GRANTED }
            if (granted) {
                requestFreshLocation(result)
            } else {
                result.success(null)
            }
        }
    }

    private fun getCurrentLocation(result: MethodChannel.Result) {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) !=
            PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            pendingLocationResult = result
            ActivityCompat.requestPermissions(
                this,
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ),
                4105
            )
            return
        }
        requestFreshLocation(result)
    }

    private fun requestFreshLocation(result: MethodChannel.Result) {
        val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val providers = manager.getProviders(true)
        if (providers.isEmpty()) {
            result.success(lastKnownLocationPayload())
            return
        }
        var completed = false
        val handler = Handler(Looper.getMainLooper())
        lateinit var listener: android.location.LocationListener
        fun finish(payload: Map<String, Double>?) {
            if (completed) return
            completed = true
            try {
                manager.removeUpdates(listener)
            } catch (_: Exception) {
            }
            result.success(payload)
        }
        listener = android.location.LocationListener { location ->
            finish(locationPayload(location))
        }
        try {
            providers.forEach { provider ->
                manager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
            }
            handler.postDelayed({ finish(lastKnownLocationPayload()) }, 10000)
        } catch (_: SecurityException) {
            finish(null)
        } catch (_: IllegalArgumentException) {
            finish(lastKnownLocationPayload())
        }
    }

    private fun lastKnownLocationPayload(): Map<String, Double>? {
        val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val providers = manager.getProviders(true)
        val location = providers
            .mapNotNull { provider ->
                try {
                    manager.getLastKnownLocation(provider)
                } catch (_: SecurityException) {
                    null
                }
            }
            .maxByOrNull { it.time }
            ?: return null
        return locationPayload(location)
    }

    private fun locationPayload(location: Location): Map<String, Double> {
        val payload = mutableMapOf(
            "latitude" to location.latitude,
            "longitude" to location.longitude
        )
        if (location.hasAccuracy()) {
            payload["accuracy"] = location.accuracy.toDouble()
        }
        return payload
    }

    private fun emergencyIntent(data: Map<*, *>) =
        Intent(this, EmergencyAlertActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            data.forEach { (key, value) ->
                putExtra(key.toString(), value?.toString().orEmpty())
            }
        }

    private fun qrBitmap(value: String): Bitmap? {
        if (value.isBlank()) return null
        return try {
            val size = 360
            val matrix = QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, size, size)
            Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).apply {
                for (x in 0 until size) {
                    for (y in 0 until size) {
                        setPixel(x, y, if (matrix[x, y]) Color.BLACK else Color.WHITE)
                    }
                }
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun createNotificationChannel(data: Map<*, *>) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .build()
        val channel = NotificationChannel(
            notificationChannelId,
            data["notificationChannelName"]?.toString().orEmpty().ifBlank { getString(R.string.sos) },
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = data["notificationChannelDescription"]?.toString().orEmpty()
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 700, 300, 700, 300, 1000)
            setSound(sound, attributes)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun createLockScreenChannel(data: Map<*, *>) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            lockScreenChannelId,
            data["notificationChannelName"]?.toString().orEmpty().ifBlank { getString(R.string.sos) },
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = data["notificationChannelDescription"]?.toString().orEmpty()
            setSound(null, null)
            enableVibration(false)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}
