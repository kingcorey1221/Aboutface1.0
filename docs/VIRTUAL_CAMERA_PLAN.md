# Virtual Camera Plan

Status: not implemented.

## Current State

The current app is browser-only. It can preview and record a canvas but cannot expose `About Face Virtual Camera` to OBS, browsers, or conferencing applications.

## Windows First

Use the supported Windows virtual camera path.

Primary sources:

- Microsoft `MFCreateVirtualCamera`: https://learn.microsoft.com/en-us/windows/win32/api/mfvirtualcamera/nf-mfvirtualcamera-mfcreatevirtualcamera
- Microsoft Windows Camera virtual camera sample: https://github.com/microsoft/Windows-Camera/blob/master/Samples/VirtualCamera/README.md

## Proposed Architecture

```text
Desktop app
  -> physical camera capture
  -> tracking
  -> reenactment renderer
  -> compositor
  -> AI-Generated - About Face watermark
  -> bounded frame publisher
  -> local frame transport
  -> About Face Virtual Camera
  -> OBS / compatible app
```

## Required Controls

- Install Virtual Camera
- Uninstall Virtual Camera
- Start
- Stop
- Output resolution
- Output FPS
- Mirror output
- Test pattern
- Diagnostics
- Connection status
- Emergency stop

## Required Statuses

- Not installed
- Installed
- Starting
- Live
- Waiting for frames
- Receiving client connected
- No camera
- Renderer unavailable
- Error

## Standby Behavior

When the app closes, crashes, pauses, or stops rendering, the virtual camera must publish a standby frame:

`About Face is paused`

It must not freeze indefinitely on the last generated face.

## Browser Limitation

The current browser app cannot install a systemwide virtual camera. This requires a desktop wrapper/native component. Mobile apps also cannot replace the systemwide camera for unrelated apps through normal supported APIs.
