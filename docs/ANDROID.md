# Android Build

About Face now has a native Android launch path inside the generated Android project.

## What Works

- Launches a Kotlin `ComponentActivity`, not the Capacitor `BridgeActivity`.
- Uses Jetpack Compose for the Android UI.
- Uses CameraX `Preview`.
- Uses CameraX `ImageAnalysis`.
- Uses `ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST` so frames do not accumulate.
- Closes every `ImageProxy` after processing.
- Shows a full-screen generated-preview surface with a persistent `AI-Generated - About Face` disclosure.
- Displays camera, streaming, recording, tracking FPS, render FPS, dropped-frame, thermal, battery, and performance-mode indicators.
- Adds Android capability labels for supported and unsupported behavior.
- Adds native short-lived desktop-pairing token policy and tests.
- Produces a debug APK for side-loading.

## Important Android Limitations

- This does not create a systemwide Android virtual camera. Android does not allow a normal app to replace the camera for unrelated apps.
- The current Android renderer is still `Fast Preview - reduced realism`.
- Native MediaPipe Face Landmarker integration is not wired yet.
- Target identity enrollment is not native yet.
- The current native ImageAnalysis path counts/analyzes frames but does not yet run full facial landmark inference on Android.
- Recording, Sharesheet, MediaProjection, and WebRTC controls are present as product paths/scaffolds, but completed generated-media implementation still needs native MediaCodec, FileProvider share intents, MediaProjection foreground service, and WebRTC library wiring.
- Physical-device camera behavior has not yet been validated on Pixel, Samsung, or low-powered Android hardware.
- This is a debug APK, not a Play Store release build.

## Build Requirements

- Android Studio installed.
- Android SDK at `C:\Users\kingc\AppData\Local\Android\Sdk`.
- Java 21. On this machine, Android Studio provides it at:

```text
C:\Program Files\Android\Android Studio\jbr
```

The local `android/local.properties` file points Gradle at the SDK. It is intentionally ignored by git.

## Build Commands

From the repo root:

```bash
npm install
npm run android:build:windows
```

Output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

A copy of the latest local debug APK was also written to:

```text
C:\Users\kingc\Desktop\AboutFace-debug.apk
```

## Install on Android

Option 1: Copy the APK to the phone and open it from Files. Android will ask you to allow installation from that source.

Option 2: If `adb` is installed and USB debugging is enabled:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Last Verified

On 2026-07-11:

- `npm run test`: passed
- `npm run build`: passed
- `gradlew assembleDebug` with Android Studio JBR Java 21: passed
- Native Kotlin/Compose/CameraX Android build: passed
- APK generated at `android/app/build/outputs/apk/debug/app-debug.apk`

## Supported Android Features Label

The native UI labels these as supported product paths:

- Live generated preview inside About Face
- Photo capture
- Video recording
- Saving generated media
- Android share sheet
- About Face app-window screen sharing
- Streaming generated output to About Face Desktop

## Unsupported Android Features Label

The native UI labels these as unsupported:

- Registering About Face as a normal systemwide Android camera
- Replacing Snapchat's live camera feed
- Replacing Instagram's live camera feed
- Camera injection into unrelated apps
- Bypassing liveness or identity checks

## Native Work Remaining

- Wire MediaPipe Face Landmarker Android tasks into CameraX `ImageAnalysis`.
- Convert native landmarks and blendshapes into the shared `FacialPerformanceFrame` shape.
- Port target identity enrollment to native Android.
- Render generated output to a real GPU surface rather than CameraX preview plus overlay.
- Record completed generated output with MediaCodec and microphone audio.
- Implement secure `FileProvider` Sharesheet export for completed media.
- Implement MediaProjection with required foreground service.
- Add WebRTC Android dependency and send the generated renderer surface, not the raw camera texture.
- Build the About Face Desktop receiver and virtual-camera publisher.
- Run physical-device validation on a recent Pixel, recent Samsung Galaxy, and lower-powered Android device or emulator profile.
