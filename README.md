# About Face

About Face is a desktop web MVP for real-time facial reenactment. The webcam user is the motion driver, and an uploaded permitted face photo is the target identity.

Tagline: **Turn. Transform. Stay in control.**

## Current Stack

- React, TypeScript, Vite
- MediaPipe Face Landmarker from local `/public/mediapipe`
- Canvas-based mesh renderer
- Browser `MediaDevices` camera access
- Browser `MediaRecorder` for WebM export where supported
- Local-first consent/session records in `localStorage`
- Optional Supabase configuration placeholders in `.env.example`

## Local Setup

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/` in Chrome or Edge.

## Validation

```bash
npm run test
npm run build
```

## Architecture

Important folders:

- `src/tracking`: facial-performance mapping from MediaPipe blendshapes and landmarks.
- `src/rendering`: renderer interface for later neural or 3D renderers.
- `src/target`: target-face model types and preparation boundary.
- `src/services`: image validation, consent/session audit, recording metadata, report flow, storage mode.
- `src/main.tsx`: current product shell plus the working MediaPipe/canvas prototype.

The pipeline is:

`camera frame -> MediaPipe landmarks/blendshapes -> FacialPerformance -> smoothed motion -> mesh warp -> edge/lighting composite -> canvas output`

## What Is Fully Implemented

- Upload gate for one permitted face photo.
- JPG, PNG, WebP file validation.
- Minimum image-resolution validation.
- One-face/no-face/side-profile rejection where MediaPipe can detect it.
- Camera device selection and live preview.
- MediaPipe dense face landmarks.
- MediaPipe blendshape output enabled.
- Normalized `FacialPerformance` model for head pose, eyes, brows, mouth, cheeks, and confidence.
- Temporal smoothing control.
- Mesh-based target photo warping.
- Edge feathering, eye/mouth cutouts, and basic live lighting match.
- Persistent visible `AI-Generated - About Face` watermark on canvas output.
- Snapshot export.
- Canvas recording, preview, download, delete where browser support exists.
- Local consent/session audit records.
- Delete-all-local-data control.
- Report/removal workflow stub.
- Performance panel for FPS, inference time, render time, dropped frames, and memory where available.

## Prototype Quality

- Target-face segmentation is approximated with MediaPipe face oval landmarks, not a dedicated segmentation model.
- Depth estimation is a placeholder boundary, not true 3D reconstruction.
- Head pose is estimated from landmarks, not a full calibrated camera solve.
- Occlusion handling is limited to confidence fallback and conservative rendering.
- Calibration currently records the user flow steps; it does not yet build a full per-user neutral baseline.
- Supabase Auth, private storage, encryption, and account controls are not enabled in the local personal MVP.

## Simulated or Future Work

- Neural reenactment.
- WebGL/Three.js renderer.
- Web Worker tracking.
- True target-face region reconstruction for teeth, inner mouth, eyelids, ears, hairline, and revealed head turns.
- Virtual camera, OBS, WebRTC, or video-conference output.
- Rate limits and account suspension controls backed by a server.

## Privacy and Consent Flow

The current MVP is browser-local by default. Webcam frames are processed in the browser and are not uploaded. Uploaded photos are object URLs for the current session unless future storage is enabled. Consent and audit records are stored locally and can be deleted from the privacy screen.

The app does not include voice cloning, facial recognition identity matching, authentication bypass tools, or watermark removal.

## Known Limitations

The renderer is mesh-based. It can make a target photo move, blink, speak, and follow head motion, but it will not perfectly reproduce a person from a single image. Results depend heavily on the uploaded photo, camera quality, lighting, CPU/GPU performance, and MediaPipe tracking stability. Model behavior may vary across skin tones, face shapes, glasses, facial hair, occlusions, and lighting conditions.

## Future Roadmap

1. Implement real neutral calibration baselines for each expression channel.
2. Move tracking into a Web Worker and add adaptive frame skipping.
3. Replace 2D canvas mesh with WebGL or Three.js target mesh.
4. Add proper segmentation, depth, occlusion, and region reconstruction.
5. Add optional Supabase Auth, private buckets, signed URLs, encrypted saved projects, and server-backed abuse controls.
6. Add licensed neural reenactment renderer behind the `FaceRenderer` interface.
7. Add desktop virtual-camera output as a separate app, not browser-only.
