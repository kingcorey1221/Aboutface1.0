# Android Build

About Face now has a Capacitor Android wrapper.

## What Works

- Builds the existing Vite/React app into an Android WebView shell.
- Includes Android camera permission for browser `getUserMedia`.
- Packages local MediaPipe wasm/model assets inside the app.
- Produces a debug APK for side-loading.

## Important Android Limitations

- This does not create a systemwide Android virtual camera. Android does not allow a normal app to replace the camera for unrelated apps.
- Performance depends on the device WebView, camera support, and MediaPipe wasm performance.
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
- APK generated at `android/app/build/outputs/apk/debug/app-debug.apk`
