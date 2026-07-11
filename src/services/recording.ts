export const EXPORT_WATERMARK = "AI-Generated - About Face";

export function createProvenanceMetadata(sessionId: string) {
  return {
    generator: "About Face",
    label: EXPORT_WATERMARK,
    sessionId,
    createdAt: new Date().toISOString(),
    rawWebcamRetained: false,
    voiceCloning: false,
  };
}

export function browserSupportsCanvasRecording(canvas: HTMLCanvasElement) {
  return typeof canvas.captureStream === "function" && typeof MediaRecorder !== "undefined";
}
