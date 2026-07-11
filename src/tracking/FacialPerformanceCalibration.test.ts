import { describe, expect, it } from "vitest";
import type { FacialPerformanceFrame } from "../types";
import {
  buildCalibrationProfile,
  evaluateFrameQuality,
  normalizeExpression,
  normalizePerformanceFrame,
} from "./FacialPerformanceCalibration";

type FrameOverride = Partial<Omit<FacialPerformanceFrame, "headPose" | "eyes" | "brows" | "mouth" | "cheeks">> & {
  headPose?: Partial<FacialPerformanceFrame["headPose"]>;
  eyes?: Partial<FacialPerformanceFrame["eyes"]>;
  brows?: Partial<FacialPerformanceFrame["brows"]>;
  mouth?: Partial<FacialPerformanceFrame["mouth"]>;
  cheeks?: Partial<FacialPerformanceFrame["cheeks"]>;
};

function frame(overrides: FrameOverride = {}): FacialPerformanceFrame {
  const base: FacialPerformanceFrame = {
    frameId: 1,
    timestamp: 100,
    headPose: { pitch: 0, yaw: 0, roll: 0, translationX: 0, translationY: 0, translationZ: 0.4 },
    eyes: {
      leftBlink: 0,
      rightBlink: 0,
      leftOpen: 0.8,
      rightOpen: 0.8,
      gazeX: 0,
      gazeY: 0,
      leftSquint: 0,
      rightSquint: 0,
    },
    brows: { leftOuterRaise: 0.05, rightOuterRaise: 0.05, innerRaise: 0.02, lower: 0, compress: 0 },
    mouth: {
      jawOpen: 0.02,
      mouthOpen: 0.02,
      lipClose: 0,
      smileLeft: 0.02,
      smileRight: 0.02,
      frownLeft: 0,
      frownRight: 0,
      pucker: 0,
      funnel: 0,
      stretchLeft: 0,
      stretchRight: 0,
      pressLeft: 0,
      pressRight: 0,
    },
    cheeks: { leftRaise: 0, rightRaise: 0, puff: 0 },
    trackingConfidence: 0.95,
  };
  return {
    ...base,
    ...overrides,
    headPose: { ...base.headPose, ...overrides.headPose },
    eyes: { ...base.eyes, ...overrides.eyes },
    brows: { ...base.brows, ...overrides.brows },
    mouth: { ...base.mouth, ...overrides.mouth },
    cheeks: { ...base.cheeks, ...overrides.cheeks },
  };
}

describe("facial performance calibration", () => {
  it("normalizes expressions with zero-range protection", () => {
    expect(normalizeExpression(0.7, 0.4, 0.4)).toBe(1);
    expect(normalizeExpression(0.2, 0.4, 0.4)).toBe(0);
  });

  it("rejects low-quality centered capture states with actionable messages", () => {
    const quality = evaluateFrameQuality(frame({
      trackingConfidence: 0.4,
      headPose: { translationX: 0.4, yaw: 0.8 },
    }));

    expect(quality.passed).toBe(false);
    expect(quality.messages).toContain("Center your face");
  });

  it("builds a calibration profile and normalizes mouth movement", () => {
    const neutral = Array.from({ length: 30 }, (_, index) => frame({ frameId: index }));
    const mouth = Array.from({ length: 60 }, (_, index) => frame({
      frameId: index + 30,
      mouth: { mouthOpen: 0.08 + index / 80, jawOpen: 0.06 + index / 90 },
    }));
    const blink = Array.from({ length: 45 }, (_, index) => frame({
      frameId: index + 100,
      eyes: { leftOpen: index % 10 < 5 ? 0.22 : 0.8, rightOpen: index % 10 < 5 ? 0.22 : 0.8 },
    }));
    const profile = buildCalibrationProfile({ neutral, mouth, blink });

    expect(profile).not.toBeNull();
    const normalized = normalizePerformanceFrame(frame({ mouth: { mouthOpen: 0.7, jawOpen: 0.6 } }), profile!);
    expect(normalized.mouth.mouthOpen).toBeGreaterThan(0.7);
    expect(normalized.mouth.jawOpen).toBeGreaterThan(0.7);
  });
});
