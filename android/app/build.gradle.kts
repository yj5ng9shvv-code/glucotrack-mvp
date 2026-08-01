plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val releaseSigningVariables = mapOf(
    "ANDROID_KEYSTORE_PATH" to System.getenv("ANDROID_KEYSTORE_PATH"),
    "ANDROID_KEYSTORE_PASSWORD" to System.getenv("ANDROID_KEYSTORE_PASSWORD"),
    "ANDROID_KEY_ALIAS" to System.getenv("ANDROID_KEY_ALIAS"),
    "ANDROID_KEY_PASSWORD" to System.getenv("ANDROID_KEY_PASSWORD"),
)
val releaseSigningConfigured = releaseSigningVariables.values.all { !it.isNullOrBlank() }
val releaseBuildRequested = gradle.startParameter.taskNames.any {
    it.contains("release", ignoreCase = true) || it.contains("bundle", ignoreCase = true)
}

if (releaseBuildRequested && !releaseSigningConfigured) {
    throw GradleException(
        "Release signing requires ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, " +
            "ANDROID_KEY_ALIAS and ANDROID_KEY_PASSWORD environment variables."
    )
}

android {
    namespace = "com.glukotrack.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Stable production id. Keep release signing/OAuth/Play Console configured for this package.
        applicationId = "com.glukotrack.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["appLabel"] = "GlukoTrack"
    }

    signingConfigs {
        if (releaseSigningConfigured) {
            create("productionRelease") {
                storeFile = file(releaseSigningVariables.getValue("ANDROID_KEYSTORE_PATH")!!)
                storePassword = releaseSigningVariables.getValue("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = releaseSigningVariables.getValue("ANDROID_KEY_ALIAS")
                keyPassword = releaseSigningVariables.getValue("ANDROID_KEY_PASSWORD")
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
                enableV4Signing = true
            }
        }
    }

    buildTypes {
        debug {
            manifestPlaceholders["appLabel"] = "GlukoTrack"
        }
        release {
            if (releaseSigningConfigured) {
                signingConfig = signingConfigs.getByName("productionRelease")
            }
            manifestPlaceholders["appLabel"] = "GlukoTrack"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    implementation("com.google.zxing:core:3.5.3")
}
