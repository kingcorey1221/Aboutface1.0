import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "soft-light";
export type OverlayMode = "mesh" | "flat";
export type AppStep =
  | "welcome"
  | "upload"
  | "camera"
  | "live"
  | "recording"
  | "desktop"
  | "privacy";

export type Point = {
  x: number;
  y: number;
};

export type SourceMesh = {
  landmarks: NormalizedLandmark[];
  triangles: number[];
};

export type PhotoAsset = {
  id: string;
  name: string;
  url: string;
  image: HTMLImageElement;
  mesh: SourceMesh | null;
  meshStatus: "ready" | "no-face" | "multiple-faces" | "side-profile" | "error";
  consentTimestamp: string;
  validationWarnings: string[];
};

export type ConsentRecord = {
  id: string;
  photoName: string;
  confirmedAt: string;
  ownsOrHasPermission: boolean;
  notPublicFigure: boolean;
  notMinorWithoutConsent: boolean;
};

export type SessionAuditRecord = {
  id: string;
  startedAt: string;
  lastUpdatedAt: string;
  rawVideoSaved: false;
  cloudProcessing: false;
  consentRecordId: string | null;
  suspensionFlag: boolean;
};

export type PerformanceStats = {
  fps: number;
  inferenceMs: number;
  renderMs: number;
  droppedFrames: number;
  memoryMb: number | null;
};

export type CalibrationPose =
  | "Neutral"
  | "Smile"
  | "Frown"
  | "Blink"
  | "Mouth open"
  | "Lips closed"
  | "Eyebrows raised"
  | "Turn left"
  | "Turn right"
  | "Tilt up"
  | "Tilt down"
  | "Tilt side to side";

export interface FacialPerformanceFrame {
  frameId: number;
  timestamp: number;
  headPose: {
    pitch: number;
    yaw: number;
    roll: number;
    translationX: number;
    translationY: number;
    translationZ: number;
  };
  eyes: {
    leftBlink: number;
    rightBlink: number;
    leftOpen: number;
    rightOpen: number;
    gazeX: number;
    gazeY: number;
  };
  brows: {
    leftOuterRaise: number;
    rightOuterRaise: number;
    innerRaise: number;
    lower: number;
  };
  mouth: {
    jawOpen: number;
    mouthOpen: number;
    lipClose: number;
    smileLeft: number;
    smileRight: number;
    frownLeft: number;
    frownRight: number;
    pucker: number;
    funnel: number;
    stretchLeft: number;
    stretchRight: number;
    pressLeft: number;
    pressRight: number;
  };
  cheeks: {
    leftRaise: number;
    rightRaise: number;
    puff: number;
  };
  trackingConfidence: number;
}

export type FacialPerformance = FacialPerformanceFrame;

export interface TargetIdentity {
  id: string;
  originalImage: ImageData;
  alignedFace: ImageData;
  faceMask: ImageData;
  hairMask?: ImageData;
  canonicalData?: unknown;
  identityEmbedding?: Float32Array;
}

export interface RenderedFrame {
  frameId: number;
  timestamp: number;
  image: ImageBitmap | VideoFrame;
  width: number;
  height: number;
  confidence: number;
}

export interface FaceReenactmentRenderer {
  readonly name: string;
  readonly mode: "mesh-preview" | "neural" | "3d";
  initialize(identity: TargetIdentity): Promise<void>;
  render(performance: FacialPerformanceFrame, sourceFrame?: VideoFrame): Promise<RenderedFrame>;
  dispose(): Promise<void>;
}

export type SmoothingProfile = {
  headTranslation: number;
  headRotation: number;
  brows: number;
  smile: number;
  mouth: number;
  jaw: number;
  blinks: number;
  gaze: number;
};

export type DesktopStreamingStatus =
  | "idle"
  | "pairing"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "stopped"
  | "error";

export type StreamingResolution = "854x480" | "1280x720" | "1920x1080";

export type StreamingFps = 24 | 30;

export type DesktopPairingToken = {
  token: string;
  expiresAt: number;
  createdAt: number;
  persistent: false;
};

export type StreamingHealth = {
  status: DesktopStreamingStatus;
  connectionState: RTCPeerConnectionState | "not-created";
  iceState: RTCIceConnectionState | "not-created";
  bitrateKbps: number | null;
  framesSent: number | null;
  droppedFrames: number;
  resolution: StreamingResolution;
  fps: StreamingFps;
  warning: string | null;
};

export const DEFAULT_SMOOTHING_PROFILE: SmoothingProfile = {
  headTranslation: 45,
  headRotation: 42,
  brows: 22,
  smile: 18,
  mouth: 8,
  jaw: 8,
  blinks: 2,
  gaze: 38,
};
