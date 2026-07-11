import type { Classifications, NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { FacialPerformance } from "../types";

type BlendCategory = {
  categoryName: string;
  score: number;
};

function score(categories: BlendCategory[], name: string) {
  return categories.find((category) => category.categoryName === name)?.score ?? 0;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function estimateHeadPose(landmarks?: NormalizedLandmark[]): FacialPerformance["headPose"] {
  if (!landmarks?.length) {
    return { pitch: 0, yaw: 0, roll: 0, translationX: 0, translationY: 0, translationZ: 0 };
  }

  const left = landmarks[234];
  const right = landmarks[454];
  const nose = landmarks[1];
  const chin = landmarks[152];
  const forehead = landmarks[10];
  const eyeCenterX = (left.x + right.x) / 2;
  const eyeCenterY = (left.y + right.y) / 2;
  const roll = Math.atan2(right.y - left.y, right.x - left.x);
  const yaw = (nose.x - eyeCenterX) * 2.8;
  const pitch = ((nose.y - eyeCenterY) - (chin.y - forehead.y) * 0.22) * 3.2;

  return {
    pitch,
    yaw,
    roll,
    translationX: nose.x - 0.5,
    translationY: nose.y - 0.5,
    translationZ: clamp01(1 - Math.abs(right.x - left.x)) || 0,
  };
}

export function mapBlendshapesToPerformance(
  blendshapes: Classifications[] | undefined,
  landmarks?: NormalizedLandmark[],
  frameId = 0,
): FacialPerformance {
  const categories = (blendshapes?.[0]?.categories ?? []) as BlendCategory[];
  const leftBlink = score(categories, "eyeBlinkLeft");
  const rightBlink = score(categories, "eyeBlinkRight");
  const mouthOpen = Math.max(score(categories, "jawOpen"), score(categories, "mouthFunnel"));
  const smileLeft = score(categories, "mouthSmileLeft");
  const smileRight = score(categories, "mouthSmileRight");
  const confidence = landmarks?.length ? 1 : 0;

  return {
    frameId,
    timestamp: performance.now(),
    headPose: estimateHeadPose(landmarks),
    eyes: {
      leftBlink: clamp01(leftBlink),
      rightBlink: clamp01(rightBlink),
      leftOpen: clamp01(1 - leftBlink),
      rightOpen: clamp01(1 - rightBlink),
      gazeX: score(categories, "eyeLookOutLeft") - score(categories, "eyeLookOutRight"),
      gazeY: score(categories, "eyeLookUpLeft") - score(categories, "eyeLookDownLeft"),
      leftSquint: score(categories, "eyeSquintLeft"),
      rightSquint: score(categories, "eyeSquintRight"),
    },
    brows: {
      leftOuterRaise: score(categories, "browOuterUpLeft"),
      rightOuterRaise: score(categories, "browOuterUpRight"),
      innerRaise: score(categories, "browInnerUp"),
      lower: Math.max(score(categories, "browDownLeft"), score(categories, "browDownRight")),
      compress: Math.max(score(categories, "browDownLeft"), score(categories, "browDownRight")),
    },
    mouth: {
      jawOpen: score(categories, "jawOpen"),
      mouthOpen: clamp01(mouthOpen),
      lipClose: Math.max(score(categories, "mouthClose"), score(categories, "mouthPressLeft"), score(categories, "mouthPressRight")),
      smileLeft,
      smileRight,
      frownLeft: score(categories, "mouthFrownLeft"),
      frownRight: score(categories, "mouthFrownRight"),
      pucker: score(categories, "mouthPucker"),
      funnel: score(categories, "mouthFunnel"),
      stretchLeft: score(categories, "mouthStretchLeft"),
      stretchRight: score(categories, "mouthStretchRight"),
      pressLeft: score(categories, "mouthPressLeft"),
      pressRight: score(categories, "mouthPressRight"),
    },
    cheeks: {
      leftRaise: score(categories, "cheekSquintLeft"),
      rightRaise: score(categories, "cheekSquintRight"),
      puff: 0,
    },
    trackingConfidence: confidence,
  };
}

export function smoothPerformance(
  previous: FacialPerformance | null,
  next: FacialPerformance,
  smoothingPercent: number,
): FacialPerformance {
  if (!previous) return next;
  const alpha = 1 - smoothingPercent / 100;
  const mix = (a: number, b: number) => a + (b - a) * alpha;

  return {
    ...next,
    headPose: {
      pitch: mix(previous.headPose.pitch, next.headPose.pitch),
      yaw: mix(previous.headPose.yaw, next.headPose.yaw),
      roll: mix(previous.headPose.roll, next.headPose.roll),
      translationX: mix(previous.headPose.translationX, next.headPose.translationX),
      translationY: mix(previous.headPose.translationY, next.headPose.translationY),
      translationZ: mix(previous.headPose.translationZ, next.headPose.translationZ),
    },
    eyes: {
      leftBlink: mix(previous.eyes.leftBlink, next.eyes.leftBlink),
      rightBlink: mix(previous.eyes.rightBlink, next.eyes.rightBlink),
      leftOpen: mix(previous.eyes.leftOpen, next.eyes.leftOpen),
      rightOpen: mix(previous.eyes.rightOpen, next.eyes.rightOpen),
      gazeX: mix(previous.eyes.gazeX, next.eyes.gazeX),
      gazeY: mix(previous.eyes.gazeY, next.eyes.gazeY),
      leftSquint: mix(previous.eyes.leftSquint, next.eyes.leftSquint),
      rightSquint: mix(previous.eyes.rightSquint, next.eyes.rightSquint),
    },
    brows: {
      leftOuterRaise: mix(previous.brows.leftOuterRaise, next.brows.leftOuterRaise),
      rightOuterRaise: mix(previous.brows.rightOuterRaise, next.brows.rightOuterRaise),
      innerRaise: mix(previous.brows.innerRaise, next.brows.innerRaise),
      lower: mix(previous.brows.lower, next.brows.lower),
      compress: mix(previous.brows.compress, next.brows.compress),
    },
    mouth: {
      jawOpen: mix(previous.mouth.jawOpen, next.mouth.jawOpen),
      mouthOpen: mix(previous.mouth.mouthOpen, next.mouth.mouthOpen),
      lipClose: mix(previous.mouth.lipClose, next.mouth.lipClose),
      smileLeft: mix(previous.mouth.smileLeft, next.mouth.smileLeft),
      smileRight: mix(previous.mouth.smileRight, next.mouth.smileRight),
      frownLeft: mix(previous.mouth.frownLeft, next.mouth.frownLeft),
      frownRight: mix(previous.mouth.frownRight, next.mouth.frownRight),
      pucker: mix(previous.mouth.pucker, next.mouth.pucker),
      funnel: mix(previous.mouth.funnel, next.mouth.funnel),
      stretchLeft: mix(previous.mouth.stretchLeft, next.mouth.stretchLeft),
      stretchRight: mix(previous.mouth.stretchRight, next.mouth.stretchRight),
      pressLeft: mix(previous.mouth.pressLeft, next.mouth.pressLeft),
      pressRight: mix(previous.mouth.pressRight, next.mouth.pressRight),
    },
    cheeks: {
      leftRaise: mix(previous.cheeks.leftRaise, next.cheeks.leftRaise),
      rightRaise: mix(previous.cheeks.rightRaise, next.cheeks.rightRaise),
      puff: mix(previous.cheeks.puff, next.cheeks.puff),
    },
    trackingConfidence: mix(previous.trackingConfidence, next.trackingConfidence),
  };
}
