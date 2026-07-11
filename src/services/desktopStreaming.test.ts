import { describe, expect, it, vi } from "vitest";
import {
  createDesktopPairingToken,
  createPairingUri,
  defaultStreamingHealth,
  DESKTOP_PAIRING_TTL_MS,
  isPairingTokenValid,
  SUPPORTED_ANDROID_FEATURES,
  UNSUPPORTED_ANDROID_FEATURES,
} from "./desktopStreaming";

describe("desktop streaming service", () => {
  it("creates short-lived non-persistent pairing tokens", () => {
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      const bytes = array as Uint8Array;
      bytes.fill(7);
      return array;
    });

    const token = createDesktopPairingToken(1000);
    expect(token.persistent).toBe(false);
    expect(token.expiresAt).toBe(1000 + DESKTOP_PAIRING_TTL_MS);
    expect(isPairingTokenValid(token, 2000)).toBe(true);
    expect(isPairingTokenValid(token, token.expiresAt + 1)).toBe(false);
  });

  it("creates local pairing URIs without cloud signaling", () => {
    const token = { token: "abcd", createdAt: 1, expiresAt: 2, persistent: false as const };
    expect(createPairingUri(token, "192.168.1.20:8787")).toContain("about-face://pair");
    expect(createPairingUri(token, "192.168.1.20:8787")).toContain("token=abcd");
  });

  it("labels supported and unsupported Android behaviors explicitly", () => {
    expect(SUPPORTED_ANDROID_FEATURES).toContain("Streaming generated output to About Face Desktop");
    expect(UNSUPPORTED_ANDROID_FEATURES).toContain("Replacing Snapchat's live camera feed");
  });

  it("defaults to 720p 30fps streaming health", () => {
    const health = defaultStreamingHealth();
    expect(health.resolution).toBe("1280x720");
    expect(health.fps).toBe(30);
    expect(health.status).toBe("idle");
  });
});
