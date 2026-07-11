# Neural Renderer Integration

About Face now has a model-backed render path for FasterLivePortrait.

## Why FasterLivePortrait

The canvas mesh renderer cannot make authentic face replacement from one photo. FasterLivePortrait is a LivePortrait-based renderer with ONNX/TensorRT support and documented real-time camera mode on suitable NVIDIA hardware.

## Setup

Run from the project root:

```powershell
scripts\setup-faster-liveportrait.ps1
```

Then start the local API:

```powershell
scripts\run-faster-liveportrait-api.ps1
```

The About Face web app calls:

```text
http://127.0.0.1:9871/predict/
```

## Use In About Face

1. Start the About Face web app.
2. Upload a clear source face photo.
3. Start the camera.
4. Click `Neural render`.

The app records a 2.5 second driver clip, sends the source photo and driver clip to the local FasterLivePortrait API, extracts the generated MP4 from the returned zip, and previews it in the app.

## Current Limitation

This is the first model-backed integration. It produces a neural sample through the FasterLivePortrait API. Full live frame-by-frame streaming still needs either the FasterLivePortrait real-time camera process or a custom WebSocket bridge around its pipeline.
