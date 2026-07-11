import { describe, expect, it } from "vitest";
import {
  browserSupportsCanvasRecording,
  createProvenanceMetadata,
  EXPORT_WATERMARK,
} from "./recording";

describe("recording helpers", () => {
  it("creates disclosure metadata", () => {
    const metadata = createProvenanceMetadata("session-1");
    expect(metadata.label).toBe(EXPORT_WATERMARK);
    expect(metadata.voiceCloning).toBe(false);
  });

  it("reports missing canvas recorder support", () => {
    const canvas = document.createElement("canvas");
    expect(browserSupportsCanvasRecording(canvas)).toBe(false);
  });
});
