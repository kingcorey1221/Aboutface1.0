import { describe, expect, it } from "vitest";
import { computeSafeRoll } from "./safeRoll";

function landmark(x: number, y: number) {
  return { x, y, z: 0, visibility: 1 };
}

describe("computeSafeRoll", () => {
  it("does not flip to 180 degrees when mirrored landmarks reverse left and right", () => {
    const points = Array.from({ length: 468 }, () => landmark(0.5, 0.5));
    points[234] = landmark(0.72, 0.42);
    points[454] = landmark(0.28, 0.44);

    expect(Math.abs(computeSafeRoll(points, 1280, 720, true))).toBeLessThan(0.1);
  });

  it("returns zero when rotation is disabled", () => {
    const points = Array.from({ length: 468 }, () => landmark(0.5, 0.5));
    points[234] = landmark(0.2, 0.3);
    points[454] = landmark(0.8, 0.7);

    expect(computeSafeRoll(points, 1280, 720, false)).toBe(0);
  });
});
