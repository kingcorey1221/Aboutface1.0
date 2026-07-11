# Neural Renderer Model Comparison

This is a research document only. No neural model is integrated yet.

Primary sources checked:

- MediaPipe Face Landmarker: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker
- LivePortrait official repository: https://github.com/KlingAIResearch/LivePortrait
- LivePortrait project page: https://liveportrait.github.io/
- First Order Motion Model repository: https://github.com/Aliaksandrsiarohin/first-order-model
- First Order Motion Model project page: https://aliaksandrsiarohin.github.io/first-order-model-website/
- SadTalker repository: https://github.com/OpenTalker/SadTalker
- SadTalker project page: https://sadtalker.github.io/

## Candidate Summary

| Candidate | One-shot target image | Driven by video/performance | Mouth quality | Eye/head support | Real-time potential | License risk | Fit for About Face |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LivePortrait | Yes | Video-driven portrait animation | Good relative to older image animation approaches | Supports retargeting controls and head motion | Promising, but needs local GPU testing | Must verify code and model-weight licenses before use | Best first research target |
| First Order Motion Model | Yes | Driving video | Older, less controllable mouth/eyes | General keypoint animation, not expression-specific | Possible at low resolution with optimization | MIT for code; checkpoints/datasets still need review | Useful baseline, likely not final |
| SadTalker | Yes | Audio-driven talking head | Strong audio-driven talking mouth | Not designed for live driver-face performance | Usually offline/near-real-time, not webcam-driver-first | License must be checked; audio-driven only | Poor first fit because MVP excludes voice cloning/audio driving |

## Recommendation

Do not integrate any model yet.

First implementation target should be a local inference-service prototype around LivePortrait or another actively maintained video-driven reenactment model, after verifying:

- source license
- model weight license
- dataset restrictions
- Windows CUDA path
- ONNX/TensorRT availability
- achievable FPS at 720p
- temporal stability over at least 60 seconds

## Why Not Browser Neural Rendering First

The current browser app is useful for tracking and preview. Realistic portrait reenactment will likely need PyTorch/CUDA, ONNX Runtime, TensorRT, DirectML, or Metal/Core ML before it can hit stable 24-30 FPS with acceptable quality. That belongs in a local inference service or desktop app layer, not inside the current React component tree.

## License Gate

Before integration, create a per-model license record with:

- repository license
- model-weight license
- permitted commercial use
- attribution requirements
- dataset usage restrictions
- redistribution restrictions
- whether generated output is restricted

No model should ship until both code and weights are acceptable for the intended use.
