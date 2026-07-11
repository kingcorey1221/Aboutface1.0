import type {
  DesktopPairingToken,
  StreamingFps,
  StreamingHealth,
  StreamingResolution,
} from "../types";

export const DESKTOP_PAIRING_TTL_MS = 5 * 60 * 1000;

export const SUPPORTED_ANDROID_FEATURES = [
  "Live generated preview inside About Face",
  "Photo capture",
  "Video recording",
  "Saving generated media",
  "Android share sheet",
  "About Face app-window screen sharing",
  "Streaming generated output to About Face Desktop",
] as const;

export const UNSUPPORTED_ANDROID_FEATURES = [
  "Registering About Face as a normal systemwide Android camera",
  "Replacing Snapchat's live camera feed",
  "Replacing Instagram's live camera feed",
  "Camera injection into unrelated apps",
  "Bypassing liveness or identity checks",
] as const;

export function createDesktopPairingToken(now = Date.now()): DesktopPairingToken {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .match(/.{1,4}/g)!
    .join("-");

  return {
    token,
    createdAt: now,
    expiresAt: now + DESKTOP_PAIRING_TTL_MS,
    persistent: false,
  };
}

export function isPairingTokenValid(token: DesktopPairingToken | null, now = Date.now()) {
  return Boolean(token && now < token.expiresAt);
}

export function createPairingUri(token: DesktopPairingToken, desktopHost: string) {
  const url = new URL("about-face://pair");
  url.searchParams.set("token", token.token);
  url.searchParams.set("host", desktopHost);
  url.searchParams.set("expiresAt", String(token.expiresAt));
  return url.toString();
}

export function defaultStreamingHealth(
  resolution: StreamingResolution = "1280x720",
  fps: StreamingFps = 30,
): StreamingHealth {
  return {
    status: "idle",
    connectionState: "not-created",
    iceState: "not-created",
    bitrateKbps: null,
    framesSent: null,
    droppedFrames: 0,
    resolution,
    fps,
    warning: null,
  };
}

export function assertGeneratedCanvasSource(canvas: HTMLCanvasElement | null) {
  if (!canvas) {
    throw new Error("Generated preview canvas is not available.");
  }
  if (typeof canvas.captureStream !== "function") {
    throw new Error("This WebView cannot stream the generated canvas output.");
  }
  return canvas;
}
