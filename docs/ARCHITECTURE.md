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
- Basic upload and target mesh preparation.
- Fast Preview canvas renderer.
- Visible disclosure watermark.
- Preview and recording.

## Prototype Quality

- Driver calibration UI exists but does not yet compute a full baseline profile.
- Smoothing is not yet region-specific in the live loop.
- Target identity preparation does not yet include masks, depth, canonical pose, or embeddings.
- Mesh preview still renders in `main.tsx`.

## Not Yet Implemented

- Neural renderer.
- 3D renderer.
- Local inference service.
- Dedicated compositor.
- Frame transport.
- Desktop app.
- Windows virtual camera.
- macOS camera extension.
