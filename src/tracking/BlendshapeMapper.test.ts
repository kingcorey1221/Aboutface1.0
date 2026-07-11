import { describe, expect, it } from "vitest";
import { mapBlendshapesToPerformance, smoothPerformance } from "./BlendshapeMapper";

function category(categoryName: string, score: number, index = 0) {
  return { categoryName, score, index, displayName: categoryName };
}

describe("BlendshapeMapper", () => {
  it("maps MediaPipe blendshape categories into renderer-independent FacialPerformanceFrame", () => {
    const frame = mapBlendshapesToPerformance(
      [
        {
          categories: [
            category("eyeBlinkLeft", 0.8),
            category("eyeBlinkRight", 0.2),
            category("jawOpen", 0.5),
            category("mouthSmileLeft", 0.3),
            category("mouthSmileRight", 0.4),
            category("browOuterUpLeft", 0.25),
          ],
          headIndex: 0,
          headName: "blendshapes",
        },
      ],
      undefined,
      42,
    );

    expect(frame.frameId).toBe(42);
    expect(frame.eyes.leftBlink).toBe(0.8);
    expect(frame.eyes.rightOpen).toBe(0.8);
    expect(frame.mouth.mouthOpen).toBe(0.5);
    expect(frame.mouth.smileRight).toBe(0.4);
    expect(frame.brows.leftOuterRaise).toBe(0.25);
  });

  it("smooths without changing the shared contract shape", () => {
    const previous = mapBlendshapesToPerformance([], undefined, 1);
    const next = mapBlendshapesToPerformance(
      [{ categories: [category("jawOpen", 1)], headIndex: 0, headName: "blendshapes" }],
      undefined,
      2,
    );
    const smoothed = smoothPerformance(previous, next, 50);
    expect(smoothed.frameId).toBe(2);
    expect(smoothed.mouth.jawOpen).toBeGreaterThan(0);
    expect(smoothed.mouth.jawOpen).toBeLessThan(1);
  });
});
