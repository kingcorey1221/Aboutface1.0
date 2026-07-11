# Target Architecture

```mermaid
flowchart TD
  A["Physical Webcam"] --> B["Face Detection"]
  B --> C["Dense Landmark and Blendshape Tracking"]
  C --> D["Driver Calibration"]
  D --> E["Normalized FacialPerformanceFrame"]
  F["Uploaded Target Photo"] --> G["Target Identity Preparation"]
  G --> H["TargetIdentity"]
  E --> I["FaceReenactmentRenderer"]
  H --> I
  F --> P["FasterLivePortrait Source Image"]
  A --> Q["Short Driving Clip"]
  P --> R["Local FasterLivePortrait API"]
  Q --> R
  R --> S["Generated Neural MP4"]
  S --> M
  I --> J["Temporal Stabilization"]
  J --> K["Face, Hair, Neck, Background Compositor"]
  K --> L["AI-Generated - About Face Disclosure"]
  L --> M["Preview"]
  L --> N["Recording"]
  L --> O["Virtual Camera Publisher"]
```

## Implemented Today

- Physical webcam capture.
- MediaPipe Face Landmarker tracking.
- Dense landmarks.
- Blendshape mapping to `FacialPerformanceFrame`.
- Capture My Performance stage with session consent, guided calibration, neutral profile, movement ranges, quality scores, and normalized output.
- `FacialCalibrationProfile` and `FacialPerformanceProvider` models.
- Basic upload and target mesh preparation.
- Fast Preview canvas renderer.
- FasterLivePortrait API integration for neural render samples.
- Visible disclosure watermark.
- Preview and recording.
- Android native launch path using Kotlin, Compose, and CameraX Preview/ImageAnalysis.
- Android keep-latest frame strategy with reliable `ImageProxy` closing.
- Android thermal, battery, camera-active, streaming-active, recording-active, and performance-mode indicators.
- Android desktop-streaming policy scaffolding with short-lived non-persistent pairing tokens.

## Prototype Quality

- Web driver calibration computes a session calibration profile from multiple frames; Android still needs native parity.
- Smoothing is not yet region-specific in the live loop.
- Target identity preparation does not yet include masks, depth, canonical pose, or embeddings.
- Mesh and locked-portrait previews still render in `main.tsx`.
- Neural rendering currently uses a short captured driving clip, not a persistent frame stream.
- Android native path currently tracks CameraX frame flow but does not yet run native MediaPipe Face Landmarker inference.
- Android recording, Sharesheet, MediaProjection, and WebRTC paths are product scaffolds, not completed media pipelines.

## Not Yet Implemented

- 3D renderer.
- Persistent neural frame-streaming service.
- Dedicated compositor.
- Frame transport.
- Desktop app.
- Windows virtual camera.
- macOS camera extension.
- Android systemwide virtual-camera replacement. This is intentionally unsupported by normal Android app APIs.
