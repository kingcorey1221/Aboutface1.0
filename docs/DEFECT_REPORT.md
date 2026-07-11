# MP4 Defect Analysis and Root Cause Report

Sample inspected:

`C:\Users\kingc\Videos\Screen Recordings\Screen Recording 2026-07-11 051644.mp4`

Extracted audit frames:

- `docs/audit-frames/frame_0.png`
- `docs/audit-frames/frame_25.png`
- `docs/audit-frames/frame_50.png`
- `docs/audit-frames/frame_75.png`
- `docs/audit-frames/frame_95.png`

Video metadata observed through browser playback:

- Duration: about 1.4 seconds
- Video size: 668 x 310

## Visible Defects

| Symptom | Responsible module/code path | Root cause | Fixable in current renderer? | Required corrective action |
| --- | --- | --- | --- | --- |
| Rubber-mask appearance | `drawWarpedFaceMesh` in `src/main.tsx` | Uploaded face pixels are triangle-warped over the live frame without real 3D structure or generated hidden regions. | Only slightly | Move realism path to neural or advanced 3D renderer; keep mesh as Fast Preview. |
| Face texture stretching | `drawTriangleImagePatch`, Delaunator triangles | Source image texture is stretched to driver landmarks; target and driver face shapes differ. | Partially | Add head-pose limits and target canonicalization; real fix requires identity-preserving renderer. |
| Mouth appears painted on | Eye/mouth cutout pass in `drawWarpedFaceMesh` | The current renderer erases parts of the warped target mouth to reveal driver motion; it does not synthesize lips, teeth, or inner mouth. | No | Neural or 3D mouth model with target lip identity, inner-mouth generation, and temporal mouth stabilization. |
| Missing inner mouth and teeth | Current mesh renderer | A single closed-mouth target photo does not contain pixels for inner mouth/teeth. | No | Add target enrollment and renderer capable of generating unseen mouth content. |
| Eye-size changes and eye sliding | Triangle warp around eye landmarks | Eye region is warped by driver geometry instead of preserving target eye shape. | Partially | Add eye-specific stabilization and target eye masks; final fix requires renderer that models eyelids and gaze. |
| Flat facial depth | Canvas 2D texture warp | No depth model, 3D morphable face, or neural latent geometry. | No | Add depth/canonical 3D estimate or neural reenactment. |
| Head-turn failure | `transformTargetLandmarks` and face oval clipping | Single target image only contains frontal pixels. Turning stretches those pixels. | Partially | Clamp one-photo head pose; future multi-image enrollment or 3D/neural renderer. |
| Lighting mismatch | Basic `soft-light` video overlay | Webcam lighting is reused as a crude compositing pass, not physically estimated. | Partially | Dedicated compositor for exposure, white balance, shadows, and face/background consistency. |
| Hair-boundary artifacts | Face oval mask only | Hair is not segmented separately; mask excludes/warps hair inconsistently. | No in current mask | Add target segmentation for face, hair, neck, and background. |
| Background bleeding | Canvas overlay on live webcam background | Output is not a full generated portrait scene; it composites target face onto live camera context. | Partially | Add compositor with explicit background and occlusion handling. |
| Identity drift | Raw landmark warp | Driver geometry can dominate target geometry. | No | Use identity embedding/canonical target representation in future renderer. |
| Low-resolution look | Sample output 668 x 310 and canvas capture | Screen recording and preview are low resolution; renderer itself also uses browser canvas source resolution. | Partially | Use high-res target enrollment and explicit 720p/1080p output targets. |

## Root Cause Summary

The visible defects are not primarily CSS or blend-weight problems. They come from the rendering approach:

```text
target photo pixels + driver landmarks -> 2D triangle warp
```

That approach is useful for proving tracking and alignment, but it cannot reconstruct unseen facial structure or synthesize temporally stable mouth/eye content. The next realism step must be a new renderer path, not more canvas tweaking.

## MP4 Inspection Notes

The sample is short, so it does not prove long-session flicker, drift, or latency. It does show the central failure mode: the target identity is a flattened texture and the mouth/eye regions do not behave like generated anatomy.
