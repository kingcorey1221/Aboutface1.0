# About Face Migration Plan

This plan preserves working code while moving toward the requested architecture.

## Stage 1: Preserve and Label Current Renderer

Status: in progress.

- Keep camera access, device selection, upload validation, MediaPipe tracking, snapshot, recording, and consent flow.
- Label the current renderer as `Fast Preview`.
- Do not call the current renderer realistic or photorealistic.
- Keep it for calibration, tracking verification, debugging, and low-power fallback.

## Stage 2: Finish Tracking Separation

- Move MediaPipe setup and `detectForVideo` out of `main.tsx` into a concrete `FaceTracker` class.
- Emit only `FacialPerformanceFrame` plus optional debug landmarks from the tracking layer.
- Add region-specific smoothing using `SmoothingProfile`.
- Add confidence-aware interpolation:
  - hold last reliable expression briefly
  - ease toward neutral
  - warn user
  - resume smoothly

## Stage 3: Driver Calibration

- Capture the required calibration poses:
  - neutral
  - blink
  - smile
  - frown
  - jaw open
  - lips closed
  - eyebrows raised
  - turn left/right
  - look up/down
  - tilt left/right
- Store neutral baselines and min/max ranges.
- Normalize expression values relative to the driver baseline.

## Stage 4: Target Enrollment

- Create `TargetIdentity` from uploaded image.
- Add canonical face alignment.
- Add target quality score.
- Add explicit rejection reasons:
  - no face
  - multiple faces
  - face too small
  - image too blurry
  - face turned too far
  - eyes obstructed
  - mouth obstructed
  - lighting too dark
  - low resolution
  - unsupported format

## Stage 5: Renderer Abstraction

- Use `FaceReenactmentRenderer` as the shared contract.
- Implement:
  - `MeshPreviewRenderer` for Fast Preview
  - future `NeuralRenderer`
  - future `ThreeDFaceRenderer`
- Main UI should select a renderer mode:
  - Fast Preview
  - Balanced Live
  - Quality Recording

## Stage 6: Local Inference Service

Use a local service if realistic rendering cannot meet targets in-browser.

Initial API:

```text
POST /identity/enroll
POST /session/start
POST /session/stop
WS   /session/frames
GET  /health
GET  /metrics
```

Frame queue behavior:

- bounded queue
- drop stale frames
- preserve newest frame
- monotonic frame IDs and timestamps
- record dropped-frame metrics

## Stage 7: Compositor

- Create a dedicated compositor for:
  - face mask
  - hair mask
  - neck/jaw boundary
  - color matching
  - exposure matching
  - edge handling
  - occlusion response
  - watermark

## Stage 8: Desktop and Virtual Camera

- Browser-only app cannot provide a dependable system virtual camera.
- Wrap or migrate to a desktop app after the renderer path is stable.
- Recommended first path: Tauri or Electron for UI plus native Windows virtual camera component.
- Use Microsoft-supported virtual camera APIs for Windows 11 rather than legacy hacks.

## Regression Control

Every stage must keep:

- `npm run test`
- `npm run build`
- browser smoke test

Major renderer changes should include before/after recordings and measured performance.
