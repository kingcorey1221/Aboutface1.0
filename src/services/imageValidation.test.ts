import { describe, expect, it } from "vitest";
import {
  validateFaceLandmarks,
  validateImageDimensions,
  validateImageFile,
} from "./imageValidation";

describe("image validation", () => {
  it("rejects invalid file types", () => {
    const file = new File(["x"], "face.gif", { type: "image/gif" });
    expect(validateImageFile(file).valid).toBe(false);
  });

  it("rejects low resolution images", () => {
    expect(validateImageDimensions(320, 320).valid).toBe(false);
  });

  it("rejects multiple faces", () => {
    expect(validateFaceLandmarks(2).errors).toContain("Exactly one face is required.");
  });

  it("rejects no detectable face", () => {
    expect(validateFaceLandmarks(0).errors).toContain("No detectable face found.");
  });

  it("warns about likely side profiles", () => {
    const landmarks = Array.from({ length: 455 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
    landmarks[234] = { x: 0.2, y: 0.5, z: 0, visibility: 1 };
    landmarks[454] = { x: 0.8, y: 0.5, z: 0, visibility: 1 };
    landmarks[1] = { x: 0.72, y: 0.5, z: 0, visibility: 1 };
    expect(validateFaceLandmarks(1, landmarks).valid).toBe(false);
  });
});
