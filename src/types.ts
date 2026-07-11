import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "soft-light";
export type OverlayMode = "mesh" | "flat";
export type AppStep = "welcome" | "upload" | "camera" | "live" | "recording" | "privacy";

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

export interface FacialPerformance {
  timestamp: number;
  headPose: {
    pitch: number;
    yaw: number;
    roll: number;
    x: number;
    y: number;
    z: number;
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
    leftRaise: number;
    rightRaise: number;
    innerRaise: number;
    lower: number;
  };
  mouth: {
    open: number;
    jawOpen: number;
    smileLeft: number;
    smileRight: number;
    frownLeft: number;
    frownRight: number;
    pucker: number;
    stretch: number;
    press: number;
  };
  cheeks: {
    leftRaise: number;
    rightRaise: number;
  };
  trackingConfidence: number;
}
