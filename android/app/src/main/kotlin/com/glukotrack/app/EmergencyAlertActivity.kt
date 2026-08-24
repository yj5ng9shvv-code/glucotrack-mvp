package com.glukotrack.app

import android.Manifest
import android.app.Activity
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.ActivityCompat
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter

class EmergencyAlertActivity : Activity() {
    private val locationPermissionRequestCode = 4106
    private val sosCardPrefsName = "glucotrack_sos_card"
    private val sosCardUpdatedAction = "com.glukotrack.app.SOS_CARD_UPDATED"
    private var medicalSection: View? = null
    private var qrSection: View? = null
    private var scrollView: ScrollView? = null
    private var payloadVersion: String = ""
    private val sosCardUpdatedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == sosCardUpdatedAction) refreshIfPayloadChanged(force = true)
        }
    }

    private val red = Color.rgb(180, 35, 24)
    private val redDark = Color.rgb(127, 29, 29)
    private val blue = Color.rgb(7, 91, 187)
    private val page = Color.rgb(246, 248, 252)
    private val ink = Color.rgb(17, 24, 39)
    private val muted = Color.rgb(86, 101, 115)
    private val border = Color.rgb(220, 226, 235)
    private val warningBg = Color.rgb(255, 244, 232)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        payloadVersion = latestPayloadVersion()
        setContentView(buildView())
    }

    override fun onStart() {
        super.onStart()
        val filter = IntentFilter(sosCardUpdatedAction)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(sosCardUpdatedReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(sosCardUpdatedReceiver, filter)
        }
    }

    override fun onResume() {
        super.onResume()
        refreshIfPayloadChanged()
    }

    override fun onStop() {
        super.onStop()
        try {
            unregisterReceiver(sosCardUpdatedReceiver)
        } catch (_: IllegalArgumentException) {
        }
    }

    private fun refreshIfPayloadChanged(force: Boolean = false) {
        val latestVersion = latestPayloadVersion()
        if (!force && latestVersion == payloadVersion) return
        payloadVersion = latestVersion
        setContentView(buildView())
    }

    private fun buildView(): ScrollView {
        val outerPad = dp(12)
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(outerPad, outerPad, outerPad, dp(18))
            setBackgroundColor(page)
        }

        content.addView(heroBlock())
        content.addView(actionGrid())
        content.addView(sectionTitle(extraOr("medicalInfoLabel", "Medical information")))
        content.addView(medicalInfoCard())
        content.addView(instructionCard())
        content.addView(qrCard())

        return ScrollView(this).apply {
            scrollView = this
            isFillViewport = false
            addView(content)
            setBackgroundColor(page)
            overScrollMode = ScrollView.OVER_SCROLL_IF_CONTENT_SCROLLS
        }
    }

    private fun heroBlock(): LinearLayout {
        val hero = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(18), dp(20), dp(18), dp(20))
            background = roundedGradient(intArrayOf(red, Color.rgb(220, 38, 38)), dp(24))
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) elevation = dp(8).toFloat()
            layoutParams = blockParams(bottom = 14)
        }
        hero.addView(label("SOS", 42f, Color.WHITE, true, Gravity.CENTER).apply {
            letterSpacing = 0.08f
            includeFontPadding = false
        })
        hero.addView(label(extraOr("holdToActivateLabel", "Hold for 3 seconds to activate SOS"), 17f, Color.WHITE, true, Gravity.CENTER).apply {
            alpha = 0.94f
            setPadding(0, dp(6), 0, 0)
        })
        hero.animate().alpha(0.92f).setDuration(900).withEndAction {
            hero.animate().alpha(1f).setDuration(900).start()
        }.start()
        return hero
    }

    private fun medicalInfoCard(): LinearLayout {
        val card = cardContainer()
        medicalSection = card
        val rows = listOf(
            Triple("\uD83D\uDC64", extraOr("nameLabel", getString(R.string.patient)), extra("name")),
            Triple("\uD83E\uDE78", extraOr("glucoseLabel", getString(R.string.glucose)), extra("glucose")),
            Triple("\u23F1", extraOr("lastUpdatedLabel", "Last updated"), extra("glucoseUpdatedAt")),
            Triple("\u2695", extraOr("diabetesLabel", getString(R.string.diabetes)), extraOr("diabetesText", extra("diabetesType"))),
            Triple("\uD83E\uDDEC", extraOr("bloodLabel", getString(R.string.blood_type)), extra("bloodType")),
            Triple("\uD83D\uDC89", extraOr("insulinLabel", getString(R.string.insulin)), extra("insulinName")),
            Triple("!", extraOr("allergiesLabel", getString(R.string.allergies)), allergyStatusText()),
            Triple("\u260E", extraOr("contactLabel", getString(R.string.contact)), extra("contactName")),
            Triple("\uD83D\uDCDE", extraOr("phoneLabel", getString(R.string.phone)), extra("contactPhone")),
        )
        val visibleRows = rows.filter { it.third.isNotBlank() }
        visibleRows.forEachIndexed { index, row ->
            card.addView(infoRow(row.first, row.second, row.third))
            if (index != visibleRows.lastIndex) card.addView(divider())
        }
        return card
    }

    private fun instructionCard(): LinearLayout {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(14), dp(14), dp(14))
            background = roundedSolid(warningBg, dp(18), Color.rgb(253, 186, 116), 1)
            layoutParams = blockParams(top = 12, bottom = 14)
        }
        card.addView(label(extraOr("instructionTitle", getString(R.string.emergency_information)), 18f, redDark, true, Gravity.START))
        card.addView(label(extraOr("instructionText", getString(R.string.emergency_instruction)), 16f, ink, false, Gravity.START).apply {
            setLineSpacing(dp(2).toFloat(), 1.03f)
            setPadding(0, dp(8), 0, 0)
        })
        return card
    }

    private fun qrCard(): LinearLayout {
        val card = cardContainer()
        qrSection = card
        card.addView(label(extraOr("emergencyHelpCardLabel", extraOr("qrLabel", getString(R.string.sos))), 19f, ink, true, Gravity.CENTER))
        val publicUrl = extra("publicUrl")
        val qrData = publicUrl.ifBlank { emergencyQrText() }
        qrBitmap(qrData)?.let { qr ->
            card.addView(ImageView(this).apply {
                setImageBitmap(qr)
                adjustViewBounds = true
                background = roundedSolid(Color.WHITE, dp(20), border, 1)
                setPadding(dp(14), dp(14), dp(14), dp(14))
                layoutParams = LinearLayout.LayoutParams(dp(250), dp(250)).apply {
                    gravity = Gravity.CENTER_HORIZONTAL
                    topMargin = dp(12)
                    bottomMargin = dp(10)
                }
            })
            val description = if (publicUrl.isBlank()) {
                extraOr("qrDescription", getString(R.string.emergency_information))
            } else {
                publicUrl
            }
            card.addView(descriptionLabel(description))
        }
        return card
    }

    private fun actionGrid(): LinearLayout {
        val grid = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = blockParams(top = 12)
        }
        grid.addView(actionButton("\u2316", extraOr("myLocationLabel", "My location"), false) { openMap() })
        grid.addView(actionButton("\u260E", extraOr("callContactLabel", getString(R.string.call_contact)), false) {
            dial(extra("contactPhone").ifBlank { "112" })
        })
        grid.addView(actionButton("\u25A6", extraOr("showQrLabel", "Show QR"), false) { scrollToQr() })
        grid.addView(actionButton("\u2695", extraOr("medicalCardLabel", getString(R.string.sos)), false) { scrollToMedical() })
        grid.addView(actionButton("\u27A4", extraOr("sendLocationActionLabel", extraOr("sendSmsLabel", getString(R.string.send_sms))), true) {
            sendSosSmsWithLocation()
        })
        grid.addView(actionButton("\uD83D\uDDFA", extraOr("openMapLabel", "Open map"), false) { openMap() })
        return grid
    }

    private fun actionButton(icon: String, title: String, primary: Boolean, action: () -> Unit): TextView {
        return label("$icon  $title", 15f, if (primary) Color.WHITE else ink, true, Gravity.CENTER_VERTICAL).apply {
            minHeight = dp(54)
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            includeFontPadding = false
            setPadding(dp(18), 0, dp(18), 0)
            background = if (primary) {
                roundedSolid(blue, dp(16), blue, 0)
            } else {
                roundedSolid(Color.WHITE, dp(16), border, 1)
            }
            setOnClickListener { action() }
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(54)
            ).apply {
                topMargin = dp(8)
            }
        }
    }

    private fun infoRow(icon: String, title: String, value: String): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(9), 0, dp(9))
            addView(label(icon, 20f, red, true, Gravity.CENTER).apply {
                layoutParams = LinearLayout.LayoutParams(dp(34), ViewGroup.LayoutParams.WRAP_CONTENT)
            })
            addView(LinearLayout(this@EmergencyAlertActivity).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(8), 0, 0, 0)
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                addView(label(title, 12f, muted, true, Gravity.START).apply { includeFontPadding = false })
                addView(label(value, 16f, ink, true, Gravity.START).apply {
                    setPadding(0, dp(2), 0, 0)
                })
            })
        }
    }

    private fun sectionTitle(title: String) = label(title, 20f, ink, true, Gravity.START).apply {
        setPadding(dp(2), dp(6), dp(2), dp(8))
    }

    private fun cardContainer() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(14), dp(14), dp(14), dp(14))
        background = roundedSolid(Color.WHITE, dp(18), border, 1)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) elevation = dp(2).toFloat()
        layoutParams = blockParams(bottom = 12)
    }

    private fun divider() = View(this).apply {
        setBackgroundColor(Color.rgb(236, 240, 245))
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            1
        ).apply { leftMargin = dp(42) }
    }

    private fun label(value: String, size: Float, color: Int, bold: Boolean, gravityValue: Int) =
        TextView(this).apply {
            text = value
            textSize = size
            setTextColor(color)
            gravity = gravityValue
            if (bold) setTypeface(typeface, Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

    private fun descriptionLabel(value: String) =
        label(value, 12f, muted, false, Gravity.CENTER).apply {
            maxLines = 2
            ellipsize = TextUtils.TruncateAt.END
            setLineSpacing(dp(2).toFloat(), 1f)
        }

    private fun blockParams(top: Int = 0, bottom: Int = 0) = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    ).apply {
        topMargin = dp(top)
        bottomMargin = dp(bottom)
    }

    private fun roundedSolid(color: Int, radius: Int, strokeColor: Int, strokeDp: Int) =
        GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = radius.toFloat()
            setColor(color)
            if (strokeDp > 0) setStroke(dp(strokeDp), strokeColor)
        }

    private fun roundedGradient(colors: IntArray, radius: Int) =
        GradientDrawable(GradientDrawable.Orientation.TL_BR, colors).apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = radius.toFloat()
            setStroke(dp(1), Color.argb(60, 255, 255, 255))
        }

    private fun dial(phone: String) {
        if (phone.isBlank()) return
        startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(phone)}")))
    }

    private fun openMap() {
        val publicUrl = extra("publicUrl")
        val uri = if (publicUrl.isNotBlank()) {
            Uri.parse(publicUrl)
        } else {
            Uri.parse("geo:0,0?q=${Uri.encode(extra("name").ifBlank { "GlucoTrack SOS" })}")
        }
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: Exception) {
            Toast.makeText(this, extraOr("locationUnavailable", getString(R.string.network_error)), Toast.LENGTH_LONG).show()
        }
    }

    private fun scrollToQr() {
        val target = qrSection ?: return
        scrollView?.smoothScrollTo(0, target.top)
    }


    private fun scrollToMedical() {
        val target = medicalSection ?: return
        scrollView?.smoothScrollTo(0, target.top)
    }
    private fun sendSosSmsWithLocation() {
        val hasFine = ActivityCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ActivityCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (!hasFine && !hasCoarse) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ),
                locationPermissionRequestCode
            )
            return
        }

        val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val location = manager.getProviders(true)
            .mapNotNull { provider ->
                try {
                    manager.getLastKnownLocation(provider)
                } catch (_: SecurityException) {
                    null
                }
            }
            .maxByOrNull { it.time }

        if (location == null) {
            Toast.makeText(
                this,
                extraOr("locationUnavailable", getString(R.string.network_error)),
                Toast.LENGTH_LONG
            ).show()
            return
        }
        openSosSms(location)
    }

    private fun openSosSms(location: Location) {
        val phone = extra("contactPhone")
        if (phone.isBlank()) return
        val patient = extra("name").ifBlank { "GlucoTrack" }
        val latitude = String.format(java.util.Locale.US, "%.6f", location.latitude)
        val longitude = String.format(java.util.Locale.US, "%.6f", location.longitude)
        val mapsUrl = "https://maps.google.com/?q=$latitude,$longitude"
        val message = "SOS GlucoTrack: $patient. $mapsUrl"
        val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:${Uri.encode(phone)}"))
            .putExtra("sms_body", message)
        try {
            startActivity(intent)
        } catch (_: Exception) {
            Toast.makeText(this, extraOr("smsUnavailable", getString(R.string.network_error)), Toast.LENGTH_LONG).show()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != locationPermissionRequestCode) return
        if (grantResults.any { it == PackageManager.PERMISSION_GRANTED }) {
            sendSosSmsWithLocation()
        } else {
            Toast.makeText(
                this,
                extraOr("locationPermissionRequired", getString(R.string.location_permission)),
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun qrBitmap(value: String): Bitmap? {
        if (value.isBlank()) return null
        return try {
            val size = 420
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

    private fun emergencyQrText(): String {
        return listOf(
            "GlucoTrack SOS",
            "${extraOr("nameLabel", getString(R.string.patient))}: ${extra("name").ifBlank { getString(R.string.patient) }}",
            "${extraOr("diabetesLabel", getString(R.string.diabetes))}: ${extraOr("diabetesText", extra("diabetesType"))}",
            extra("glucose").let { if (it.isBlank()) "" else "${extraOr("glucoseLabel", getString(R.string.glucose))}: $it" },
            extra("glucoseUpdatedAt").let { if (it.isBlank()) "" else "${extraOr("lastUpdatedLabel", "Last updated")}: $it" },
            extra("bloodType").let { if (it.isBlank()) "" else "${extraOr("bloodLabel", getString(R.string.blood_type))}: $it" },
            extra("insulinName").let { if (it.isBlank()) "" else "${extraOr("insulinLabel", getString(R.string.insulin))}: $it" },
            allergyStatusText().let { if (it.isBlank()) "" else "${extraOr("allergiesLabel", getString(R.string.allergies))}: $it" },
            extra("contactName").let { if (it.isBlank()) "" else "${extraOr("contactLabel", getString(R.string.contact))}: $it" },
            extra("contactPhone").let { if (it.isBlank()) "" else "${extraOr("phoneLabel", getString(R.string.phone))}: $it" },
            extraOr("instructionText", getString(R.string.emergency_instruction))
        ).filter { it.isNotBlank() }.joinToString("\n")
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density + 0.5f).toInt()

    private fun latestPayloadVersion() =
        getSharedPreferences(sosCardPrefsName, Context.MODE_PRIVATE)
            .getString("_payloadVersion", "")
            .orEmpty()

    private fun allergyStatusText(): String {
        val status = extra("allergyStatus").trim()
        if (status.isNotBlank()) return status
        return extra("allergies").trim()
    }

    private fun extra(key: String): String {
        val prefs = getSharedPreferences(sosCardPrefsName, Context.MODE_PRIVATE)
        if (prefs.contains(key)) return prefs.getString(key, "").orEmpty()
        return intent.getStringExtra(key).orEmpty()
    }

    private fun extraOr(key: String, fallback: String) = extra(key).ifBlank { fallback }
}

