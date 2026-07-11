package com.aboutface.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Bundle
import android.os.PowerManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.util.concurrent.Executors
import kotlin.math.roundToInt

enum class PerformanceMode(val label: String) {
    BatterySaver("Battery Saver"),
    Balanced("Balanced"),
    Quality("Quality")
}

data class NativeMetrics(
    val trackingFps: Int = 0,
    val renderingFps: Int = 0,
    val droppedFrames: Int = 0,
    val latencyMs: Int = 0,
    val thermalStatus: String = "Unknown",
    val batteryPercent: Int = 0,
    val frameCount: Long = 0
)

class MainActivity : ComponentActivity() {
    private var cameraGranted by mutableStateOf(false)

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            cameraGranted = granted
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        cameraGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED

        setContent {
            AboutFaceNativeApp(
                cameraGranted = cameraGranted,
                requestCamera = { permissionLauncher.launch(Manifest.permission.CAMERA) }
            )
        }
    }
}

@Composable
fun AboutFaceNativeApp(cameraGranted: Boolean, requestCamera: () -> Unit) {
    var consentAccepted by remember { mutableStateOf(false) }
    var streaming by remember { mutableStateOf(false) }
    var recording by remember { mutableStateOf(false) }
    var performanceMode by remember { mutableStateOf(PerformanceMode.Balanced) }
    var metrics by remember { mutableStateOf(NativeMetrics()) }
    var status by remember { mutableStateOf("Native Android preview ready") }

    MaterialTheme {
        Surface(color = Color(0xFF171810), modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Header()
                ConsentPanel(
                    consentAccepted = consentAccepted,
                    onAccept = { consentAccepted = true }
                )
                CapabilityPanel()
                PerformanceModePanel(performanceMode) { performanceMode = it }

                if (!cameraGranted) {
                    Button(onClick = requestCamera, enabled = consentAccepted) {
                        Text("Allow Camera")
                    }
                } else {
                    NativeGeneratedPreview(
                        enabled = consentAccepted,
                        performanceMode = performanceMode,
                        onMetrics = { metrics = it },
                        onStatus = { status = it }
                    )
                }

                StatusPanel(
                    metrics = metrics,
                    status = status,
                    cameraActive = cameraGranted && consentAccepted,
                    streaming = streaming,
                    recording = recording
                )

                ActionPanel(
                    streaming = streaming,
                    recording = recording,
                    onToggleStream = {
                        streaming = !streaming
                        status = if (streaming) {
                            "Connect to About Face Desktop: pairing scaffold active"
                        } else {
                            "Desktop streaming stopped"
                        }
                    },
                    onToggleRecording = {
                        recording = !recording
                        status = if (recording) {
                            "Recording scaffold active: generated output only"
                        } else {
                            "Recording stopped"
                        }
                    },
                    onStop = {
                        streaming = false
                        recording = false
                        status = "Stopped immediately"
                    }
                )
            }
        }
    }
}

@Composable
private fun Header() {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("About Face", color = Color(0xFFF1D28A), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineMedium)
        Text("Native Android capture path. Fast Preview - reduced realism.", color = Color(0xFFD8CFB3))
    }
}

@Composable
private fun ConsentPanel(consentAccepted: Boolean, onAccept: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF242718), RoundedCornerShape(8.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text("Consent and privacy", color = Color(0xFFF0EAD8), fontWeight = FontWeight.Bold)
        Text(
            "Local processing by default. No cloud upload, no facial recognition, no raw camera-frame storage by default.",
            color = Color(0xFFC9C0A4)
        )
        Button(onClick = onAccept, enabled = !consentAccepted) {
            Text(if (consentAccepted) "Consent accepted" else "Accept camera and facial-processing consent")
        }
    }
}

@Composable
private fun NativeGeneratedPreview(
    enabled: Boolean,
    performanceMode: PerformanceMode,
    onMetrics: (NativeMetrics) -> Unit,
    onStatus: (String) -> Unit
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    var frameCount by remember { mutableLongStateOf(0L) }
    var dropped by remember { mutableStateOf(0) }
    var lastSecond by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var framesThisSecond by remember { mutableStateOf(0) }
    val executor = remember { Executors.newSingleThreadExecutor() }

    DisposableEffect(Unit) {
        onDispose { executor.shutdown() }
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(460.dp)
            .background(Color.Black, RoundedCornerShape(8.dp))
    ) {
        AndroidView(
            factory = { viewContext ->
                val previewView = PreviewView(viewContext)
                val cameraProviderFuture = ProcessCameraProvider.getInstance(viewContext)
                cameraProviderFuture.addListener({
                    val cameraProvider = cameraProviderFuture.get()
                    val preview = Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }
                    val analysis = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()
                        .also {
                            it.setAnalyzer(executor) { imageProxy ->
                                processLatestFrame(
                                    context = viewContext,
                                    imageProxy = imageProxy,
                                    enabled = enabled,
                                    mode = performanceMode,
                                    frameCount = frameCount,
                                    droppedFrames = dropped,
                                    onFrame = { nextFrame, nextDropped ->
                                        frameCount = nextFrame
                                        dropped = nextDropped
                                        framesThisSecond += 1
                                        val now = System.currentTimeMillis()
                                        if (now - lastSecond >= 1000) {
                                            val thermal = viewContext.thermalLabel()
                                            val battery = viewContext.batteryPercent()
                                            onMetrics(
                                                NativeMetrics(
                                                    trackingFps = framesThisSecond,
                                                    renderingFps = framesThisSecond,
                                                    droppedFrames = dropped,
                                                    latencyMs = 0,
                                                    thermalStatus = thermal,
                                                    batteryPercent = battery,
                                                    frameCount = nextFrame
                                                )
                                            )
                                            framesThisSecond = 0
                                            lastSecond = now
                                        }
                                    }
                                )
                            }
                        }
                    cameraProvider.unbindAll()
                    cameraProvider.bindToLifecycle(
                        lifecycleOwner,
                        CameraSelector.DEFAULT_FRONT_CAMERA,
                        preview,
                        analysis
                    )
                    onStatus("CameraX ImageAnalysis running with keep-only-latest frames")
                }, ContextCompat.getMainExecutor(viewContext))
                previewView
            },
            modifier = Modifier.fillMaxSize()
        )
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(10.dp)
                .background(Color(0xAA171810), RoundedCornerShape(4.dp))
                .padding(horizontal = 10.dp, vertical = 6.dp)
        ) {
            Text("AI-Generated - About Face", color = Color(0xFFF1D28A), fontWeight = FontWeight.Bold)
        }
        Box(
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(10.dp)
                .background(Color(0xAA171810), RoundedCornerShape(4.dp))
                .padding(horizontal = 10.dp, vertical = 6.dp)
        ) {
            Text("Fast Preview - reduced realism", color = Color(0xFFF0EAD8))
        }
    }
}

private fun processLatestFrame(
    context: Context,
    imageProxy: ImageProxy,
    enabled: Boolean,
    mode: PerformanceMode,
    frameCount: Long,
    droppedFrames: Int,
    onFrame: (Long, Int) -> Unit
) {
    try {
        val skipModulo = when (mode) {
            PerformanceMode.BatterySaver -> 3
            PerformanceMode.Balanced -> 1
            PerformanceMode.Quality -> 1
        }
        val nextFrame = frameCount + 1
        val skipped = enabled && skipModulo > 1 && nextFrame % skipModulo != 0L
        val nextDropped = if (skipped) droppedFrames + 1 else droppedFrames
        // Native MediaPipe reenactment will consume ImageProxy planes here.
        // This scaffold deliberately does not persist or stream raw camera frames.
        if (!enabled) context.cacheDir.listFiles()?.filter { it.name.startsWith("about-face-temp") }?.forEach { it.delete() }
        onFrame(nextFrame, nextDropped)
    } finally {
        imageProxy.close()
    }
}

@Composable
private fun PerformanceModePanel(selected: PerformanceMode, onSelected: (PerformanceMode) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        PerformanceMode.values().forEach { mode ->
            FilterChip(
                selected = selected == mode,
                onClick = { onSelected(mode) },
                label = { Text(mode.label) }
            )
        }
    }
}

@Composable
private fun StatusPanel(
    metrics: NativeMetrics,
    status: String,
    cameraActive: Boolean,
    streaming: Boolean,
    recording: Boolean
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF242718), RoundedCornerShape(8.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(status, color = Color(0xFFF0EAD8), fontWeight = FontWeight.Bold)
        Text("Camera: ${if (cameraActive) "active" else "off"} | Streaming: ${if (streaming) "active" else "off"} | Recording: ${if (recording) "active" else "off"}", color = Color(0xFFC9C0A4))
        Text("Tracking FPS: ${metrics.trackingFps} | Render FPS: ${metrics.renderingFps} | Dropped: ${metrics.droppedFrames}", color = Color(0xFFC9C0A4))
        Text("Thermal: ${metrics.thermalStatus} | Battery: ${metrics.batteryPercent}%", color = Color(0xFFC9C0A4))
    }
}

@Composable
private fun ActionPanel(
    streaming: Boolean,
    recording: Boolean,
    onToggleStream: () -> Unit,
    onToggleRecording: () -> Unit,
    onStop: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Button(onClick = onToggleRecording) { Text(if (recording) "Stop Recording" else "Record Generated Video") }
            Button(onClick = onToggleStream) { Text(if (streaming) "Stop Streaming" else "Connect to About Face Desktop") }
        }
        Button(onClick = onStop, modifier = Modifier.fillMaxWidth()) { Text("Immediate Stop") }
    }
}

@Composable
private fun CapabilityPanel() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF242718), RoundedCornerShape(8.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text("Supported on Android", color = Color(0xFFF1D28A), fontWeight = FontWeight.Bold)
        listOf(
            "Live generated preview inside About Face",
            "Photo and generated-video capture path",
            "Android Sharesheet export path",
            "App-window screen sharing path",
            "Streaming generated output to About Face Desktop"
        ).forEach { Text("• $it", color = Color(0xFFC9C0A4)) }
        Spacer(Modifier.height(4.dp))
        Text("Unsupported", color = Color(0xFFFFB4A9), fontWeight = FontWeight.Bold)
        listOf(
            "Registering as a normal systemwide Android camera",
            "Replacing Snapchat or Instagram live camera feeds",
            "Camera injection into unrelated apps",
            "Bypassing liveness or identity checks"
        ).forEach { Text("• $it", color = Color(0xFFFFDAD4)) }
    }
}

private fun Context.thermalLabel(): String {
    val power = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return "Unknown"
    return when (power.currentThermalStatus) {
        PowerManager.THERMAL_STATUS_NONE -> "Normal"
        PowerManager.THERMAL_STATUS_LIGHT -> "Light"
        PowerManager.THERMAL_STATUS_MODERATE -> "Moderate"
        PowerManager.THERMAL_STATUS_SEVERE -> "Severe"
        PowerManager.THERMAL_STATUS_CRITICAL -> "Critical"
        PowerManager.THERMAL_STATUS_EMERGENCY -> "Emergency"
        PowerManager.THERMAL_STATUS_SHUTDOWN -> "Shutdown"
        else -> "Unknown"
    }
}

private fun Context.batteryPercent(): Int {
    val battery = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager ?: return 0
    return battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).coerceIn(0, 100)
}
