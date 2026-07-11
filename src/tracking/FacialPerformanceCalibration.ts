import type {
  FacialCalibrationProfile,
  FacialPerformanceFrame,
  FacialPerformanceProvider,
} from "../types";

export type CalibrationStepId =
  | "position"
  | "neutral"
  | "blink"
  | "gaze"
  | "smile"
  | "mouth"
  | "brows"
  | "head"
  | "combo"
  | "review";

export type CalibrationStepDefinition = {
  id: CalibrationStepId;
  title: string;
  instruction: string;
  minimumFrames: number;
};

export type CaptureQuality = {
  passed: boolean;
  score: number;
  messages: string[];
};

export const CALIBRATION_STEPS: CalibrationStepDefinition[] = [
  {
    id: "position",
    title: "Position and lighting",
    instruction: "Center your face inside the guide and look directly at the camera.",
    minimumFrames: 24,
  },
  {
    id: "neutral",
    title: "Neutral expression",
    instruction: "Relax your face and look naturally at the camera.",
    minimumFrames: 30,
  },
  {
    id: "blink",
    title: "Blink calibration",
    instruction: "Blink normally three times.",
    minimumFrames: 45,
  },
  {
    id: "gaze",
    title: "Eye movement",
    instruction: "Look left, right, up, and down without turning your head.",
    minimumFrames: 45,
  },
  {
    id: "smile",
    title: "Smile",
    instruction: "Give a natural smile, then relax.",
    minimumFrames: 36,
  },
  {
    id: "mouth",
    title: "Mouth and jaw",
    instruction: "Open your mouth, close it, purse your lips, then say: About Face.",
    minimumFrames: 48,
  },
  {
    id: "brows",
    title: "Eyebrows",
    instruction: "Raise your eyebrows, lower them, then bring them together.",
    minimumFrames: 36,
  },
  {
    id: "head",
    title: "Head movement",
    instruction: "Slowly turn left and right, look up and down, then tilt left and right.",
    minimumFrames: 54,
  },
  {
    id: "combo",
    title: "Expression combination",
    instruction: "Speak naturally for five seconds while making normal facial expressions.",
    minimumFrames: 90,
  },
  {
    id: "review",
    title: "Calibration review",
    instruction: "Review quality scores and continue when the performance profile is ready.",
    minimumFrames: 0,
  },
];

export function normalizeExpression(raw: number, neutral: number, maximum: number) {
  const denominator = Math.max(maximum - neutral, 0.0001);
  return clamp01((raw - neutral) / denominator);
}

export function normalizeInverseExpression(raw: number, neutral: number, minimum: number) {
  const denominator = Math.max(neutral - minimum, 0.0001);
  return clamp01((neutral - raw) / denominator);
}

export function evaluateFrameQuality(frame: FacialPerformanceFrame | null): CaptureQuality {
  if (!frame) {
    return { passed: false, score: 0, messages: ["No face detected"] };
  }

  const messages: string[] = [];
  if (frame.trackingConfidence < 0.72) messages.push("Improve tracking confidence");
  if (Math.abs(frame.headPose.translationX) > 0.22) messages.push("Center your face");
  if (Math.abs(frame.headPose.translationY) > 0.24) messages.push("Move your face into the guide");
  if (Math.abs(frame.headPose.yaw) > 0.62) messages.push("Turn your head less sharply");
  if (Math.abs(frame.headPose.pitch) > 0.62) messages.push("Look more directly at the camera");
  if (frame.eyes.leftOpen < 0.16 || frame.eyes.rightOpen < 0.16) messages.push("Remove anything blocking your eyes");

  const score = clamp01(
    frame.trackingConfidence * 0.5 +
      (1 - Math.min(1, Math.abs(frame.headPose.translationX) / 0.3)) * 0.16 +
      (1 - Math.min(1, Math.abs(frame.headPose.translationY) / 0.32)) * 0.14 +
      (1 - Math.min(1, Math.abs(frame.headPose.yaw) / 0.8)) * 0.1 +
      (1 - Math.min(1, Math.abs(frame.headPose.pitch) / 0.8)) * 0.1,
  );

  return {
    passed: score >= 0.68 && messages.length <= 1,
    score,
    messages: messages.length ? messages : ["Tracking quality is usable"],
  };
}

export function buildCalibrationProfile(framesByStep: Partial<Record<CalibrationStepId, FacialPerformanceFrame[]>>): FacialCalibrationProfile | null {
  const neutralFrames = framesByStep.neutral ?? [];
  if (neutralFrames.length < 12) return null;

  const allFrames = Object.values(framesByStep).flat();
  if (allFrames.length < 60) return null;

  const neutral = averageFrame(trimOutliers(neutralFrames));
  const ranges = {
    headPitch: range(allFrames.map((frame) => frame.headPose.pitch)),
    headYaw: range(allFrames.map((frame) => frame.headPose.yaw)),
    headRoll: range(allFrames.map((frame) => frame.headPose.roll)),
    leftEyeOpen: range(allFrames.map((frame) => frame.eyes.leftOpen)),
    rightEyeOpen: range(allFrames.map((frame) => frame.eyes.rightOpen)),
    jawOpen: range(allFrames.map((frame) => frame.mouth.jawOpen)),
    mouthOpen: range(allFrames.map((frame) => frame.mouth.mouthOpen)),
    smileLeft: range(allFrames.map((frame) => frame.mouth.smileLeft)),
    smileRight: range(allFrames.map((frame) => frame.mouth.smileRight)),
    browLeft: range(allFrames.map((frame) => frame.brows.leftOuterRaise)),
    browRight: range(allFrames.map((frame) => frame.brows.rightOuterRaise)),
  };

  const quality = {
    neutral: scoreFrames(neutralFrames, 24),
    eyes: scoreRange(ranges.leftEyeOpen, 0.2) * 0.45 + scoreRange(ranges.rightEyeOpen, 0.2) * 0.45 + scoreFrames(framesByStep.blink ?? [], 36) * 0.1,
    mouth: scoreRange(ranges.mouthOpen, 0.22) * 0.55 + scoreRange(ranges.jawOpen, 0.18) * 0.35 + scoreFrames(framesByStep.mouth ?? [], 36) * 0.1,
    brows: scoreRange(ranges.browLeft, 0.12) * 0.45 + scoreRange(ranges.browRight, 0.12) * 0.45 + scoreFrames(framesByStep.brows ?? [], 30) * 0.1,
    headPose: scoreRange(ranges.headYaw, 0.22) * 0.42 + scoreRange(ranges.headPitch, 0.18) * 0.36 + scoreRange(ranges.headRoll, 0.12) * 0.22,
    overall: 0,
  };
  quality.overall = clamp01((quality.neutral + quality.eyes + quality.mouth + quality.brows + quality.headPose) / 5);

  return {
    version: 1,
    createdAt: Date.now(),
    neutral,
    ranges,
    quality,
  };
}

export function normalizePerformanceFrame(frame: FacialPerformanceFrame, profile: FacialCalibrationProfile): FacialPerformanceFrame {
  return {
    ...frame,
    headPose: {
      pitch: normalizeSigned(frame.headPose.pitch, profile.neutral.headPose.pitch, profile.ranges.headPitch),
      yaw: normalizeSigned(frame.headPose.yaw, profile.neutral.headPose.yaw, profile.ranges.headYaw),
      roll: normalizeSigned(frame.headPose.roll, profile.neutral.headPose.roll, profile.ranges.headRoll),
      translationX: frame.headPose.translationX,
      translationY: frame.headPose.translationY,
      translationZ: frame.headPose.translationZ,
    },
    eyes: {
      ...frame.eyes,
      leftOpen: normalizeExpression(frame.eyes.leftOpen, profile.ranges.leftEyeOpen.min, profile.ranges.leftEyeOpen.max),
      rightOpen: normalizeExpression(frame.eyes.rightOpen, profile.ranges.rightEyeOpen.min, profile.ranges.rightEyeOpen.max),
      leftBlink: normalizeInverseExpression(frame.eyes.leftOpen, profile.neutral.eyes.leftOpen, profile.ranges.leftEyeOpen.min),
      rightBlink: normalizeInverseExpression(frame.eyes.rightOpen, profile.neutral.eyes.rightOpen, profile.ranges.rightEyeOpen.min),
    },
    brows: {
      ...frame.brows,
      leftOuterRaise: normalizeExpression(frame.brows.leftOuterRaise, profile.neutral.brows.leftOuterRaise, profile.ranges.browLeft.max),
      rightOuterRaise: normalizeExpression(frame.brows.rightOuterRaise, profile.neutral.brows.rightOuterRaise, profile.ranges.browRight.max),
    },
    mouth: {
      ...frame.mouth,
      jawOpen: normalizeExpression(frame.mouth.jawOpen, profile.neutral.mouth.jawOpen, profile.ranges.jawOpen.max),
      mouthOpen: normalizeExpression(frame.mouth.mouthOpen, profile.neutral.mouth.mouthOpen, profile.ranges.mouthOpen.max),
      smileLeft: normalizeExpression(frame.mouth.smileLeft, profile.neutral.mouth.smileLeft, profile.ranges.smileLeft.max),
      smileRight: normalizeExpression(frame.mouth.smileRight, profile.neutral.mouth.smileRight, profile.ranges.smileRight.max),
    },
  };
}

export class InMemoryFacialPerformanceProvider implements FacialPerformanceProvider {
  private profile: FacialCalibrationProfile | null = null;
  private listeners = new Set<(frame: FacialPerformanceFrame) => void>();

  async start() {}
  async stop() {}
  async recalibrate() {
    this.profile = null;
  }
  getCalibrationProfile() {
    return this.profile;
  }
  setCalibrationProfile(profile: FacialCalibrationProfile | null) {
    this.profile = profile;
  }
  emit(frame: FacialPerformanceFrame) {
    this.listeners.forEach((listener) => listener(frame));
  }
  subscribe(listener: (frame: FacialPerformanceFrame) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

function averageFrame(frames: FacialPerformanceFrame[]): FacialPerformanceFrame {
  const first = frames[0];
  const avg = (selector: (frame: FacialPerformanceFrame) => number) =>
    frames.reduce((total, frame) => total + selector(frame), 0) / Math.max(1, frames.length);

  return {
    frameId: first.frameId,
    timestamp: first.timestamp,
    headPose: {
      pitch: avg((frame) => frame.headPose.pitch),
      yaw: avg((frame) => frame.headPose.yaw),
      roll: avg((frame) => frame.headPose.roll),
      translationX: avg((frame) => frame.headPose.translationX),
      translationY: avg((frame) => frame.headPose.translationY),
      translationZ: avg((frame) => frame.headPose.translationZ),
    },
    eyes: {
      leftBlink: avg((frame) => frame.eyes.leftBlink),
      rightBlink: avg((frame) => frame.eyes.rightBlink),
      leftOpen: avg((frame) => frame.eyes.leftOpen),
      rightOpen: avg((frame) => frame.eyes.rightOpen),
      gazeX: avg((frame) => frame.eyes.gazeX),
      gazeY: avg((frame) => frame.eyes.gazeY),
      leftSquint: avg((frame) => frame.eyes.leftSquint),
      rightSquint: avg((frame) => frame.eyes.rightSquint),
    },
    brows: {
      leftOuterRaise: avg((frame) => frame.brows.leftOuterRaise),
      rightOuterRaise: avg((frame) => frame.brows.rightOuterRaise),
      innerRaise: avg((frame) => frame.brows.innerRaise),
      lower: avg((frame) => frame.brows.lower),
      compress: avg((frame) => frame.brows.compress),
    },
    mouth: {
      jawOpen: avg((frame) => frame.mouth.jawOpen),
      mouthOpen: avg((frame) => frame.mouth.mouthOpen),
      lipClose: avg((frame) => frame.mouth.lipClose),
      smileLeft: avg((frame) => frame.mouth.smileLeft),
      smileRight: avg((frame) => frame.mouth.smileRight),
      frownLeft: avg((frame) => frame.mouth.frownLeft),
      frownRight: avg((frame) => frame.mouth.frownRight),
      pucker: avg((frame) => frame.mouth.pucker),
      funnel: avg((frame) => frame.mouth.funnel),
      stretchLeft: avg((frame) => frame.mouth.stretchLeft),
      stretchRight: avg((frame) => frame.mouth.stretchRight),
      pressLeft: avg((frame) => frame.mouth.pressLeft),
      pressRight: avg((frame) => frame.mouth.pressRight),
    },
    cheeks: {
      leftRaise: avg((frame) => frame.cheeks.leftRaise),
      rightRaise: avg((frame) => frame.cheeks.rightRaise),
      puff: avg((frame) => frame.cheeks.puff),
    },
    trackingConfidence: avg((frame) => frame.trackingConfidence),
  };
}

function trimOutliers(frames: FacialPerformanceFrame[]) {
  return frames.filter((frame) => frame.trackingConfidence >= 0.7).slice(-90);
}

function range(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { min: 0, max: 1 };
  return {
    min: percentile(sorted, 0.08),
    max: percentile(sorted, 0.92),
  };
}

function percentile(sorted: number[], p: number) {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index];
}

function normalizeSigned(raw: number, neutral: number, bounds: { min: number; max: number }) {
  const limit = Math.max(Math.abs(bounds.min - neutral), Math.abs(bounds.max - neutral), 0.0001);
  return Math.max(-1, Math.min(1, (raw - neutral) / limit));
}

function scoreFrames(frames: FacialPerformanceFrame[], target: number) {
  if (!frames.length) return 0;
  const confidence = frames.reduce((total, frame) => total + frame.trackingConfidence, 0) / frames.length;
  return clamp01((frames.length / target) * 0.45 + confidence * 0.55);
}

function scoreRange(bounds: { min: number; max: number }, expected: number) {
  return clamp01((bounds.max - bounds.min) / expected);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
