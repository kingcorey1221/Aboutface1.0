import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function computeSafeRoll(points: NormalizedLandmark[], width: number, height: number, enabled: boolean) {
  if (!enabled) return 0;
  const left = points[234];
  const right = points[454];
  if (!left || !right) return 0;
  const roll = Math.atan2((right.y - left.y) * height, Math.abs((right.x - left.x) * width));
  return Number.isFinite(roll) ? clamp(roll, -0.55, 0.55) : 0;
}
