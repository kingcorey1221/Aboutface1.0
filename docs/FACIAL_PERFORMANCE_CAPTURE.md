# Facial Performance Capture

About Face now starts with `Capture My Performance`.

This stage measures the motion driver. It is not facial recognition and is not identity verification. The output is a normalized facial-performance stream used by Stage 2 renderers.

## Stage 1 Output

- `FacialPerformanceFrame`: normalized head pose, eyes, brows, mouth, cheeks, confidence, timestamp, and frame id.
- `FacialCalibrationProfile`: neutral baseline, movement ranges, and quality scores.
- `FacialPerformanceProvider`: renderer-independent interface for subscribing to normalized performance frames.

Expression values use `0.0 = no calibrated activation` and `1.0 = maximum calibrated activation`. Head pitch, yaw, and roll are normalized signed values after calibration, with raw estimation based on landmark geometry before normalization.

## Calibration Sequence

1. Position and lighting
2. Neutral expression
3. Blink calibration
4. Eye movement
5. Smile
6. Mouth and jaw
7. Eyebrows
8. Head movement
9. Expression combination
10. Calibration review

The app does not let Stage 2 upload/rendering start until calibration quality passes the threshold.

Each calibration item is rendered as its own wizard page with a focused title, instruction, checklist, progress indicator, quality messages, back/retry/restart controls, and a final review page.

## Storage

Default behavior keeps calibration in memory for the current session. The optional `Save my calibration on this device` setting stores only the calibration profile with AES-GCM encryption in browser local storage. Raw camera frames and raw video are not stored.

## Current Limits

This web implementation uses the existing MediaPipe Face Landmarker camera stack. Android has CameraX scaffolding, but full native Stage 1 parity still requires MediaPipe inference, native calibration state, and instrumentation tests.
