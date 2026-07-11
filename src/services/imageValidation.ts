import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MIN_IMAGE_WIDTH = 480;
export const MIN_IMAGE_HEIGHT = 480;

export type ImageValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateImageFile(file: File): ImageValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    errors.push("Unsupported file type. Use JPG, PNG, or WebP.");
  }

  if (file.size > 12 * 1024 * 1024) {
    warnings.push("Large images may slow down browser-only processing.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateImageDimensions(width: number, height: number): ImageValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
    errors.push(`Image must be at least ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT}px.`);
  }

  const aspect = width / height;
  if (aspect < 0.62 || aspect > 1.62) {
    warnings.push("Extreme crop detected. A centered, front-facing face works best.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateFaceLandmarks(faceCount: number, landmarks?: NormalizedLandmark[]): ImageValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (faceCount === 0) {
    errors.push("No detectable face found.");
  }

  if (faceCount > 1) {
    errors.push("Exactly one face is required.");
  }

  if (landmarks?.length) {
    const left = landmarks[234];
    const right = landmarks[454];
    const nose = landmarks[1];
    if (left && right && nose) {
      const center = (left.x + right.x) / 2;
      if (Math.abs(nose.x - center) > 0.08) {
        errors.push("The face appears to be a side profile. Use a clear front-facing image.");
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function combineValidationResults(...results: ImageValidationResult[]): ImageValidationResult {
  const errors = results.flatMap((result) => result.errors);
  const warnings = results.flatMap((result) => result.warnings);
  return { valid: errors.length === 0, errors, warnings };
}
