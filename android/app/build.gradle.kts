import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    FileInputStream(keystorePropertiesFile).use {
        keystoreProperties.load(it)
    }
}
val releaseSigningKeys = listOf("storeFile", "storePassword", "keyAlias", "keyPassword")
val releaseSigningConfigured = releaseSigningKeys.all {
    !keystoreProperties.getProperty(it).isNullOrBlank()
}
val releaseBuildRequested = gradle.startParameter.taskNames.any {
    it.contains("release", ignoreCase = true) || it.contains("bundle", ignoreCase = true)
}

if (releaseBuildRequested && !releaseSigningConfigured) {
    throw GradleException(
        "Release signing requires android/key.properties with storeFile, storePassword, " +
            "keyAlias and keyPassword."
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
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
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
