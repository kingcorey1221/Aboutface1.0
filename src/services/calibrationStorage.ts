import type { FacialCalibrationProfile } from "../types";

const KEY_STORAGE = "about-face-calibration-key";
const PROFILE_STORAGE = "about-face-calibration-profile";

export async function saveEncryptedCalibrationProfile(profile: FacialCalibrationProfile) {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(profile));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  localStorage.setItem(
    PROFILE_STORAGE,
    JSON.stringify({
      version: 1,
      iv: toBase64(iv),
      cipher: toBase64(new Uint8Array(cipher)),
    }),
  );
}

export async function loadEncryptedCalibrationProfile(): Promise<FacialCalibrationProfile | null> {
  const stored = localStorage.getItem(PROFILE_STORAGE);
  const rawKey = localStorage.getItem(KEY_STORAGE);
  if (!stored || !rawKey) return null;
  try {
    const payload = JSON.parse(stored) as { iv: string; cipher: string };
    const key = await crypto.subtle.importKey("raw", fromBase64(rawKey), "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(payload.iv) },
      key,
      fromBase64(payload.cipher),
    );
    return JSON.parse(new TextDecoder().decode(plain)) as FacialCalibrationProfile;
  } catch {
    deleteEncryptedCalibrationProfile();
    return null;
  }
}

export function deleteEncryptedCalibrationProfile() {
  localStorage.removeItem(PROFILE_STORAGE);
}

async function getOrCreateKey() {
  const stored = localStorage.getItem(KEY_STORAGE);
  if (stored) {
    return crypto.subtle.importKey("raw", fromBase64(stored), "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  localStorage.setItem(KEY_STORAGE, toBase64(raw));
  return key;
}

function toBase64(bytes: Uint8Array) {
  let value = "";
  bytes.forEach((byte) => {
    value += String.fromCharCode(byte);
  });
  return btoa(value);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
