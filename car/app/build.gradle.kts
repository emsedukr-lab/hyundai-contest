import java.util.Properties
import javax.inject.Inject

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

/** Copies the official Pleos tokens and font from /design so that folder stays the single source. */
abstract class SyncPleosRes : DefaultTask() {
    @get:InputDirectory abstract val designRes: DirectoryProperty
    @get:InputFile abstract val font: RegularFileProperty
    @get:OutputDirectory abstract val outputDir: DirectoryProperty
    @get:Inject abstract val fs: FileSystemOperations

    @TaskAction
    fun run() {
        fs.sync {
            from(designRes)
            from(font) { into("font") }
            into(outputDir)
        }
    }
}

val syncPleosRes = tasks.register<SyncPleosRes>("syncPleosRes") {
    designRes.set(rootProject.layout.projectDirectory.dir("../design/android-res"))
    font.set(rootProject.layout.projectDirectory.file("../design/fonts/asta_sans.ttf"))
    outputDir.set(layout.buildDirectory.dir("generated/pleosRes"))
}

fun prop(name: String, default: String) = (findProperty(name) as String?) ?: default
fun requireProp(name: String) = (findProperty(name) as String?) ?: error("Set $name in car/gradle.properties (or -P$name=https://…); the prod flavor must not fall back to a placeholder server")

android {
    namespace = "io.tteonaljido.car"
    compileSdk = 37
    defaultConfig {
        applicationId = "io.tteonaljido.car"
        minSdk = 28
        targetSdk = 34
        versionCode = 2 // Pleos: every review submission needs a new version
        versionName = "0.2.0"
    }
    useLibrary("android.car", false)
    buildFeatures {
        buildConfig = true
        compose = true
    }
    flavorDimensions += "server"
    productFlavors {
        create("dev") {
            dimension = "server"
            // Emulator reaches the host's `wrangler dev` via 10.0.2.2; the QR origin is what the phone opens.
            buildConfigField("String", "API_BASE", "\"${prop("tteonaljido.devApi", "http://10.0.2.2:8787")}\"")
            buildConfigField("String", "WEB_ORIGIN", "\"${prop("tteonaljido.devWeb", "http://localhost:8787")}\"")
        }
        create("prod") {
            dimension = "server"
            buildConfigField("String", "API_BASE", "\"${requireProp("tteonaljido.prodOrigin")}\"")
            buildConfigField("String", "WEB_ORIGIN", "\"${requireProp("tteonaljido.prodOrigin")}\"")
        }
    }
    signingConfigs {
        create("contest") {
            val p = rootProject.file("../.secrets/signing.properties")
            if (p.exists()) {
                val values = Properties().apply { p.inputStream().use { load(it) } }
                storeFile = rootProject.file("../.secrets/tteonaljido.jks")
                storePassword = values.getProperty("password")
                keyAlias = "tteonaljido"
                keyPassword = values.getProperty("password")
                // v3 too: Pleos ties minSdk 28 to signing-key rotation and lineage (APK Signature Scheme v3).
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            if (rootProject.file("../.secrets/signing.properties").exists()) signingConfig = signingConfigs.getByName("contest")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    testOptions { unitTests.isReturnDefaultValues = true }
}

androidComponents {
    onVariants { variant ->
        variant.sources.res?.addGeneratedSourceDirectory(syncPleosRes, SyncPleosRes::outputDir)
    }
}

dependencies {
    implementation(project(":core-trip"))
    implementation(project(":core-pairing"))

    implementation(platform("androidx.compose:compose-bom:2026.09.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.11.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.zxing:core:3.5.4")
    implementation("ai.pleos.playground:NaviHelper:3.0.5")
    implementation("ai.pleos.playground:Vehicle:2.3.2") // read-only energy/fuel (CAR_ENERGY) and range (CAR_DRIVE); real-car check still pending

    testImplementation("junit:junit:4.13.2")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.11.0")
}
