import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Camera,
  CameraOff,
  Download,
  Eye,
  EyeOff,
  ImagePlus,
  Info,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Redo2,
  Undo2,
} from "lucide-react";
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import Delaunator from "delaunator";
import type {
  AppStep,
  CalibrationPose,
  ConsentRecord,
  FacialPerformance,
  PerformanceStats,
  SessionAuditRecord,
} from "./types";
import {
  combineValidationResults,
  validateFaceLandmarks,
  validateImageDimensions,
  validateImageFile,
} from "./services/imageValidation";
import { createConsentRecord, createSessionAudit, deleteAllLocalData } from "./services/consentLog";
import { submitLocalReport } from "./services/errorReporting";
import {
  browserSupportsCanvasRecording,
  createProvenanceMetadata,
  EXPORT_WATERMARK,
} from "./services/recording";
import { getSecureStorageStatus } from "./services/secureStorage";
import { mapBlendshapesToPerformance, smoothPerformance } from "./tracking/BlendshapeMapper";
import "./styles.css";

type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "soft-light";
type OverlayMode = "portrait" | "mesh" | "flat";

type Point = {
  x: number;
  y: number;
};

type SourceMesh = {
  landmarks: NormalizedLandmark[];
  triangles: number[];
};

type PhotoAsset = {
  id: string;
  name: string;
  url: string;
  image: HTMLImageElement;
  mesh: SourceMesh | null;
  meshStatus: "ready" | "no-face" | "multiple-faces" | "side-profile" | "error";
  consentTimestamp: string;
  validationWarnings: string[];
};

type BlendPenPoint = {
  x: number;
  y: number;
  radius: number;
  strength: number;
};

type HairMotion = {
  x: number;
  y: number;
  rotation: number;
};

const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
];

const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133];
const RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263];
const LIPS = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317,
  14, 87, 178, 88, 95,
];
const LEFT_BROW = [70, 63, 105, 66, 107];
const RIGHT_BROW = [336, 296, 334, 293, 300];
const IDENTITY_LOCK_LANDMARKS = new Set([...FACE_OVAL, 127, 162, 21, 54, 103, 67, 109, 356, 389, 251, 284, 332, 297, 338]);
const EXPRESSION_LANDMARKS = new Set([...LEFT_EYE, ...RIGHT_EYE, ...LEFT_BROW, ...RIGHT_BROW, ...LIPS]);

const CALIBRATION_POSES: CalibrationPose[] = [
  "Neutral",
  "Smile",
  "Frown",
  "Blink",
  "Mouth open",
  "Lips closed",
  "Eyebrows raised",
  "Turn left",
  "Turn right",
  "Tilt up",
  "Tilt down",
  "Tilt side to side",
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const blendModeToComposite: Record<BlendMode, GlobalCompositeOperation> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  "soft-light": "soft-light",
};

const MODEL_PATH = "/mediapipe/models/face_landmarker.task";

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function friendlyErrorMessage(err: unknown, fallback: string) {
  if (!(err instanceof Error)) return fallback;
  if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
    return "Camera permission was blocked. Allow camera access in the browser, then start the camera again.";
  }
  if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
    return "No webcam was found. Connect a camera or choose another browser camera source.";
  }
  if (err.message.toLowerCase().includes("fetch")) {
    return "Face tracking model failed to load. The app now expects the local model at /mediapipe/models/face_landmarker.task.";
  }
  return err.message || fallback;
}

function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const padding = Math.max(18, width * 0.018);
  ctx.save();
  ctx.font = `700 ${Math.max(18, width * 0.018)}px Inter, system-ui, sans-serif`;
  const textWidth = ctx.measureText(EXPORT_WATERMARK).width;
  const boxWidth = textWidth + padding * 1.3;
  const boxHeight = padding * 1.7;
  const x = width - boxWidth - padding;
  const y = height - boxHeight - padding;
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = "rgba(16, 20, 14, 0.78)";
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#f1d28a";
  ctx.fillText(EXPORT_WATERMARK, x + padding * 0.65, y + boxHeight * 0.65);
  ctx.restore();
}

function landmarkBounds(points: NormalizedLandmark[], width: number, height: number) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = 0;
  let maxY = 0;

  FACE_OVAL.forEach((index) => {
    const point = points[index];
    minX = Math.min(minX, point.x * width);
    minY = Math.min(minY, point.y * height);
    maxX = Math.max(maxX, point.x * width);
    maxY = Math.max(maxY, point.y * height);
  });

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function drawLandmarkPath(
  ctx: CanvasRenderingContext2D,
  points: NormalizedLandmark[],
  indexes: number[],
  width: number,
  height: number,
  closed = true,
) {
  ctx.beginPath();
  indexes.forEach((index, position) => {
    const point = points[index];
    const x = point.x * width;
    const y = point.y * height;
    if (position === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  if (closed) ctx.closePath();
  ctx.stroke();
}

function drawClosedLandmarkFill(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  indexes: number[],
) {
  ctx.beginPath();
  indexes.forEach((index, position) => {
    const point = points[index];
    if (position === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fill();
}

function toPixelPoint(point: NormalizedLandmark, width: number, height: number): Point {
  return { x: point.x * width, y: point.y * height };
}

function pointBounds(points: Point[], indexes: number[]) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  indexes.forEach((index) => {
    const point = points[index];
    if (!point) return;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function clampRectToImage(
  rect: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number,
) {
  const x = clamp(rect.x, 0, imageWidth - 1);
  const y = clamp(rect.y, 0, imageHeight - 1);
  const right = clamp(rect.x + rect.width, x + 1, imageWidth);
  const bottom = clamp(rect.y + rect.height, y + 1, imageHeight);
  return { x, y, width: right - x, height: bottom - y };
}

function createIdentityLockedTargetPoints(sourcePoints: Point[], driverPoints: Point[]) {
  const sourceFace = pointBounds(sourcePoints, FACE_OVAL);
  const driverFace = pointBounds(driverPoints, FACE_OVAL);
  if (sourceFace.width <= 0 || sourceFace.height <= 0 || driverFace.width <= 0 || driverFace.height <= 0) {
    return driverPoints;
  }

  const sourceCenter = {
    x: sourceFace.minX + sourceFace.width / 2,
    y: sourceFace.minY + sourceFace.height / 2,
  };
  const driverCenter = {
    x: driverFace.minX + driverFace.width / 2,
    y: driverFace.minY + driverFace.height / 2,
  };
  const scale = Math.min(driverFace.width / sourceFace.width, driverFace.height / sourceFace.height);

  return driverPoints.map((driverPoint, index) => {
    const sourcePoint = sourcePoints[index];
    if (!sourcePoint) return driverPoint;

    const sourceShapedPoint = {
      x: driverCenter.x + (sourcePoint.x - sourceCenter.x) * scale,
      y: driverCenter.y + (sourcePoint.y - sourceCenter.y) * scale,
    };
    const identityWeight = IDENTITY_LOCK_LANDMARKS.has(index)
      ? 0.84
      : EXPRESSION_LANDMARKS.has(index)
        ? 0.48
        : 0.68;

    return {
      x: sourceShapedPoint.x * identityWeight + driverPoint.x * (1 - identityWeight),
      y: sourceShapedPoint.y * identityWeight + driverPoint.y * (1 - identityWeight),
    };
  });
}

function transformTargetLandmarks(
  points: NormalizedLandmark[],
  width: number,
  height: number,
  scalePercent: number,
  offsetPercent: number,
) {
  const bounds = landmarkBounds(points, width, height);
  const scaleFactor = scalePercent / 100;
  const centerX = bounds.minX + bounds.width / 2;
  const centerY = bounds.minY + bounds.height / 2;
  const targetCenterY = centerY + (offsetPercent / 100) * bounds.height;

  return points.map((point) => {
    const x = point.x * width;
    const y = point.y * height;
    return {
      x: centerX + (x - centerX) * scaleFactor,
      y: targetCenterY + (y - centerY) * scaleFactor,
    };
  });
}

function drawTriangleImagePatch(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  source: [Point, Point, Point],
  target: [Point, Point, Point],
) {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = target;
  const denominator =
    s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);

  if (Math.abs(denominator) < 0.001) return;

  const a =
    (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) /
    denominator;
  const b =
    (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) /
    denominator;
  const c =
    (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) /
    denominator;
  const d =
    (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) /
    denominator;
  const e =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    denominator;
  const f =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    denominator;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

function drawExpandedHeadPlate(
  layerCtx: CanvasRenderingContext2D,
  photo: PhotoAsset,
  sourcePoints: Point[],
  targetPoints: Point[],
  imageWidth: number,
  imageHeight: number,
  edgeSoftness: number,
  hairMotion: HairMotion,
) {
  const width = layerCtx.canvas.width;
  const height = layerCtx.canvas.height;
  const sourceFace = pointBounds(sourcePoints, FACE_OVAL);
  const targetFace = pointBounds(targetPoints, FACE_OVAL);
  if (sourceFace.width <= 0 || sourceFace.height <= 0 || targetFace.width <= 0 || targetFace.height <= 0) {
    return null;
  }

  const sourceRect = clampRectToImage(
    {
      x: sourceFace.minX - sourceFace.width * 0.58,
      y: sourceFace.minY - sourceFace.height * 0.96,
      width: sourceFace.width * 2.16,
      height: sourceFace.height * 2.88,
    },
    imageWidth,
    imageHeight,
  );
  const targetRect = {
    x: targetFace.minX - targetFace.width * 0.58 + hairMotion.x,
    y: targetFace.minY - targetFace.height * 0.9 + hairMotion.y,
    width: targetFace.width * 2.16,
    height: targetFace.height * 2.72,
  };

  const plate = document.createElement("canvas");
  const plateCtx = plate.getContext("2d");
  const mask = document.createElement("canvas");
  const maskCtx = mask.getContext("2d");
  if (!plateCtx || !maskCtx) return null;

  plate.width = width;
  plate.height = height;
  mask.width = width;
  mask.height = height;

  plateCtx.save();
  plateCtx.translate(targetRect.x + targetRect.width / 2, targetRect.y + targetRect.height / 2);
  plateCtx.rotate(hairMotion.rotation);
  plateCtx.drawImage(
    photo.image,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    -targetRect.width / 2,
    -targetRect.height / 2,
    targetRect.width,
    targetRect.height,
  );
  plateCtx.restore();

  maskCtx.save();
  maskCtx.filter = `blur(${Math.max(10, edgeSoftness * 1.8)}px)`;
  maskCtx.fillStyle = "#fff";
  maskCtx.translate(targetRect.x + targetRect.width / 2, targetRect.y + targetRect.height / 2);
  maskCtx.rotate(hairMotion.rotation);
  maskCtx.beginPath();
  maskCtx.ellipse(
    0,
    0,
    targetRect.width / 2,
    targetRect.height / 2,
    0,
    0,
    Math.PI * 2,
  );
  maskCtx.fill();
  maskCtx.restore();

  plateCtx.save();
  plateCtx.globalCompositeOperation = "destination-in";
  plateCtx.drawImage(mask, 0, 0);
  plateCtx.restore();

  layerCtx.drawImage(plate, 0, 0);
  return targetRect;
}

function drawGeneratedMask(
  maskCtx: CanvasRenderingContext2D,
  targetPoints: Point[],
  edgeSoftness: number,
  headPlateRect: { x: number; y: number; width: number; height: number } | null,
) {
  maskCtx.save();
  maskCtx.filter = `blur(${edgeSoftness}px)`;
  maskCtx.fillStyle = "#fff";
  if (headPlateRect) {
    maskCtx.beginPath();
    maskCtx.ellipse(
      headPlateRect.x + headPlateRect.width / 2,
      headPlateRect.y + headPlateRect.height / 2,
      headPlateRect.width / 2,
      headPlateRect.height / 2,
      0,
      0,
      Math.PI * 2,
    );
    maskCtx.fill();
  }
  drawClosedLandmarkFill(maskCtx, targetPoints, FACE_OVAL);
  maskCtx.restore();
}

function applyBlendPen(
  layerCtx: CanvasRenderingContext2D,
  points: BlendPenPoint[],
) {
  if (points.length === 0) return;

  layerCtx.save();
  layerCtx.globalCompositeOperation = "destination-out";
  points.forEach((point) => {
    layerCtx.filter = `blur(${Math.max(2, point.radius * 0.35)}px)`;
    layerCtx.fillStyle = `rgba(0, 0, 0, ${point.strength})`;
    layerCtx.beginPath();
    layerCtx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
    layerCtx.fill();
  });
  layerCtx.restore();
}

function drawLockedPortrait(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  photo: PhotoAsset,
  targetPoints: Point[],
  opacity: number,
  blendMode: BlendMode,
  edgeSoftness: number,
  lightingStrength: number,
  blendPenPoints: BlendPenPoint[],
  hairMotion: HairMotion,
) {
  if (!photo.mesh) return false;

  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;
  const layer = document.createElement("canvas");
  const layerCtx = layer.getContext("2d");
  const mask = document.createElement("canvas");
  const maskCtx = mask.getContext("2d");
  if (!layerCtx || !maskCtx) return false;

  layer.width = width;
  layer.height = height;
  mask.width = width;
  mask.height = height;

  const imageWidth = photo.image.naturalWidth || photo.image.width;
  const imageHeight = photo.image.naturalHeight || photo.image.height;
  const sourcePoints = photo.mesh.landmarks.map((point) => toPixelPoint(point, imageWidth, imageHeight));
  const sourceFace = pointBounds(sourcePoints, FACE_OVAL);
  const targetFace = pointBounds(targetPoints, FACE_OVAL);
  if (sourceFace.width <= 0 || sourceFace.height <= 0 || targetFace.width <= 0 || targetFace.height <= 0) {
    return false;
  }

  const sourceRect = clampRectToImage(
    {
      x: sourceFace.minX - sourceFace.width * 0.62,
      y: sourceFace.minY - sourceFace.height * 1.02,
      width: sourceFace.width * 2.24,
      height: sourceFace.height * 2.98,
    },
    imageWidth,
    imageHeight,
  );
  const targetRect = {
    x: targetFace.minX - targetFace.width * 0.62 + hairMotion.x,
    y: targetFace.minY - targetFace.height * 1 + hairMotion.y,
    width: targetFace.width * 2.24,
    height: targetFace.height * 2.92,
  };
  const left = targetPoints[234];
  const right = targetPoints[454];
  const angle = left && right ? Math.atan2(right.y - left.y, right.x - left.x) + hairMotion.rotation : hairMotion.rotation;

  layerCtx.save();
  layerCtx.translate(targetRect.x + targetRect.width / 2, targetRect.y + targetRect.height / 2);
  layerCtx.rotate(angle);
  layerCtx.drawImage(
    photo.image,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    -targetRect.width / 2,
    -targetRect.height / 2,
    targetRect.width,
    targetRect.height,
  );
  layerCtx.restore();

  maskCtx.save();
  maskCtx.filter = `blur(${Math.max(10, edgeSoftness * 1.8)}px)`;
  maskCtx.fillStyle = "#fff";
  maskCtx.translate(targetRect.x + targetRect.width / 2, targetRect.y + targetRect.height / 2);
  maskCtx.rotate(angle);
  maskCtx.beginPath();
  maskCtx.ellipse(0, 0, targetRect.width / 2, targetRect.height / 2, 0, 0, Math.PI * 2);
  maskCtx.fill();
  maskCtx.restore();

  layerCtx.save();
  layerCtx.globalCompositeOperation = "destination-in";
  layerCtx.drawImage(mask, 0, 0);
  layerCtx.restore();

  if (lightingStrength > 0) {
    layerCtx.save();
    layerCtx.globalCompositeOperation = "soft-light";
    layerCtx.globalAlpha = Math.min(0.45, lightingStrength / 140);
    layerCtx.filter = "grayscale(1) contrast(1.16) brightness(0.98)";
    layerCtx.drawImage(video, 0, 0, width, height);
    layerCtx.restore();

    layerCtx.save();
    layerCtx.globalCompositeOperation = "destination-in";
    layerCtx.drawImage(mask, 0, 0);
    layerCtx.restore();
  }

  applyBlendPen(layerCtx, blendPenPoints);

  ctx.save();
  ctx.globalAlpha = opacity / 100;
  ctx.globalCompositeOperation = blendModeToComposite[blendMode];
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
  return true;
}

function drawWarpedFaceMesh(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  photo: PhotoAsset,
  targetPoints: Point[],
  opacity: number,
  blendMode: BlendMode,
  edgeSoftness: number,
  lightingStrength: number,
  blendPenPoints: BlendPenPoint[],
  hairMotion: HairMotion,
) {
  if (!photo.mesh) return false;

  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;
  const layer = document.createElement("canvas");
  const layerCtx = layer.getContext("2d");
  const mask = document.createElement("canvas");
  const maskCtx = mask.getContext("2d");
  if (!layerCtx || !maskCtx) return false;

  layer.width = width;
  layer.height = height;
  mask.width = width;
  mask.height = height;

  const imageWidth = photo.image.naturalWidth || photo.image.width;
  const imageHeight = photo.image.naturalHeight || photo.image.height;
  const sourcePoints = photo.mesh.landmarks.map((point) =>
    toPixelPoint(point, imageWidth, imageHeight),
  );
  const identityTargetPoints = createIdentityLockedTargetPoints(sourcePoints, targetPoints);

  const headPlateRect = drawExpandedHeadPlate(
    layerCtx,
    photo,
    sourcePoints,
    identityTargetPoints,
    imageWidth,
    imageHeight,
    edgeSoftness,
    hairMotion,
  );

  for (let index = 0; index < photo.mesh.triangles.length; index += 3) {
    const a = photo.mesh.triangles[index];
    const b = photo.mesh.triangles[index + 1];
    const c = photo.mesh.triangles[index + 2];
    const sourceTriangle: [Point, Point, Point] = [
      sourcePoints[a],
      sourcePoints[b],
      sourcePoints[c],
    ];
    const targetTriangle: [Point, Point, Point] = [
      identityTargetPoints[a],
      identityTargetPoints[b],
      identityTargetPoints[c],
    ];
    drawTriangleImagePatch(layerCtx, photo.image, sourceTriangle, targetTriangle);
  }

  drawGeneratedMask(maskCtx, identityTargetPoints, edgeSoftness, headPlateRect);

  layerCtx.save();
  layerCtx.globalCompositeOperation = "destination-in";
  layerCtx.drawImage(mask, 0, 0);
  layerCtx.restore();

  if (lightingStrength > 0) {
    layerCtx.save();
    layerCtx.globalCompositeOperation = "soft-light";
    layerCtx.globalAlpha = lightingStrength / 100;
    layerCtx.filter = "grayscale(1) contrast(1.34) brightness(0.96)";
    layerCtx.drawImage(video, 0, 0, width, height);
    layerCtx.restore();

    layerCtx.save();
    layerCtx.globalCompositeOperation = "destination-in";
    layerCtx.drawImage(mask, 0, 0);
    layerCtx.restore();
  }

  applyBlendPen(layerCtx, blendPenPoints);

  ctx.save();
  ctx.globalAlpha = opacity / 100;
  ctx.globalCompositeOperation = blendModeToComposite[blendMode];
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
  return true;
}

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sourcePreviewRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const sourceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const wasmFilesetRef = useRef<Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null>(
    null,
  );
  const lastVideoTimeRef = useRef(-1);
  const frameIdRef = useRef(0);
  const lastResultRef = useRef<FaceLandmarkerResult | null>(null);
  const lastPerformanceRef = useRef<FacialPerformance | null>(null);
  const fpsTimesRef = useRef<number[]>([]);
  const photosRef = useRef<PhotoAsset[]>([]);
  const blendPenPointsRef = useRef<BlendPenPoint[]>([]);
  const blendPenUndoRef = useRef<BlendPenPoint[][]>([]);
  const blendPenRedoRef = useRef<BlendPenPoint[][]>([]);
  const previousHeadCenterRef = useRef<Point | null>(null);
  const hairSwayRef = useRef<HairMotion>({ x: 0, y: 0, rotation: 0 });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const hiddenAtRef = useRef<number | null>(null);

  const [step, setStep] = useState<AppStep>("welcome");
  const [consentRecord, setConsentRecord] = useState<ConsentRecord | null>(null);
  const [sessionAudit, setSessionAudit] = useState<SessionAuditRecord | null>(null);
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [showOriginal, setShowOriginal] = useState(true);
  const [calibrationIndex, setCalibrationIndex] = useState(0);
  const [calibrationComplete, setCalibrationComplete] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingMetadata, setRecordingMetadata] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [status, setStatus] = useState("Camera idle");
  const [fps, setFps] = useState(0);
  const [perfStats, setPerfStats] = useState<PerformanceStats>({
    fps: 0,
    inferenceMs: 0,
    renderMs: 0,
    droppedFrames: 0,
    memoryMb: null,
  });
  const [facialPerformance, setFacialPerformance] = useState<FacialPerformance | null>(null);
  const [opacity, setOpacity] = useState(100);
  const [scale, setScale] = useState(109);
  const [offsetY, setOffsetY] = useState(-2);
  const [edgeSoftness, setEdgeSoftness] = useState(14);
  const [lightingStrength, setLightingStrength] = useState(26);
  const [smoothing, setSmoothing] = useState(45);
  const [blendPenEnabled, setBlendPenEnabled] = useState(false);
  const [blendPenSize, setBlendPenSize] = useState(38);
  const [blendPenStrength, setBlendPenStrength] = useState(36);
  const [blendPenPointCount, setBlendPenPointCount] = useState(0);
  const [blendPenUndoCount, setBlendPenUndoCount] = useState(0);
  const [blendPenRedoCount, setBlendPenRedoCount] = useState(0);
  const [hairMotionStrength, setHairMotionStrength] = useState(55);
  const [rotation, setRotation] = useState(true);
  const [mirror, setMirror] = useState(true);
  const [debug, setDebug] = useState(false);
  const [blendMode, setBlendMode] = useState<BlendMode>("normal");
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("portrait");
  const [error, setError] = useState<string | null>(null);

  const selectedPhoto = useMemo(
    () => photos.find((photo) => photo.id === selectedId) ?? null,
    [photos, selectedId],
  );
  const selectedPhotoStatus = selectedPhoto
    ? `${selectedPhoto.name} · ${
        selectedPhoto.meshStatus === "ready" ? "mesh warp" : "flat fallback"
      }`
    : "No active photo";

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      landmarkerRef.current?.close();
      sourceLandmarkerRef.current?.close();
    };
  }, [recordingUrl]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((items) => {
        const videoInputs = items.filter((item) => item.kind === "videoinput");
        setDevices(videoInputs);
        setSelectedDeviceId((current) => current || videoInputs[0]?.deviceId || "");
      })
      .catch(() => setDevices([]));
  }, [cameraOn]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && cameraOn) {
        hiddenAtRef.current = Date.now();
        stopCamera();
        setStatus("Paused while tab is hidden");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [cameraOn]);

  const ensureFileset = useCallback(async () => {
    if (!wasmFilesetRef.current) {
      wasmFilesetRef.current = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    }
    return wasmFilesetRef.current;
  }, []);

  const ensureLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setIsLoadingModel(true);
    setStatus("Loading face tracker");
    const fileset = await ensureFileset();
    const landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_PATH,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
    landmarkerRef.current = landmarker;
    setIsLoadingModel(false);
    return landmarker;
  }, [ensureFileset]);

  const ensureSourceLandmarker = useCallback(async () => {
    if (sourceLandmarkerRef.current) return sourceLandmarkerRef.current;
    const fileset = await ensureFileset();
    const landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_PATH,
        delegate: "CPU",
      },
      runningMode: "IMAGE",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
    });
    sourceLandmarkerRef.current = landmarker;
    return landmarker;
  }, [ensureFileset]);

  const analyzePhotoMesh = useCallback(
    async (image: HTMLImageElement): Promise<Pick<PhotoAsset, "mesh" | "meshStatus">> => {
      try {
        const landmarker = await ensureSourceLandmarker();
        const result = landmarker.detect(image);
        const faceCount = result.faceLandmarks?.length ?? 0;
        const landmarks = result.faceLandmarks?.[0];
        if (!landmarks) return { mesh: null, meshStatus: "no-face" };
        if (faceCount > 1) return { mesh: null, meshStatus: "multiple-faces" };

        const landmarkValidation = validateFaceLandmarks(faceCount, landmarks);
        if (!landmarkValidation.valid) {
          const isSideProfile = landmarkValidation.errors.some((item) => item.includes("side profile"));
          return { mesh: null, meshStatus: isSideProfile ? "side-profile" : "error" };
        }

        const points = landmarks.map((point) => [point.x, point.y] as [number, number]);
        const triangles = Array.from(Delaunator.from(points).triangles);
        return { mesh: { landmarks, triangles }, meshStatus: "ready" };
      } catch (err) {
        console.error("Source photo mesh analysis failed", err);
        return { mesh: null, meshStatus: "error" };
      }
    },
    [ensureSourceLandmarker],
  );

  const drawFrame = useCallback(() => {
    const renderStart = performance.now();
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!video || !canvas || !ctx || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    if (mirror) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();

    const landmarker = landmarkerRef.current;
    let inferenceMs = perfStats.inferenceMs;
    if (landmarker && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const inferenceStart = performance.now();
      lastResultRef.current = landmarker.detectForVideo(video, performance.now());
      inferenceMs = performance.now() - inferenceStart;
    }

    const face = lastResultRef.current?.faceLandmarks?.[0];
    if (face) {
      setStatus(selectedPhoto ? "Face locked" : "Face locked - upload a photo");
      const mappedPerformance = mapBlendshapesToPerformance(
        lastResultRef.current?.faceBlendshapes,
        face,
        frameIdRef.current++,
      );
      const smoothedPerformance = smoothPerformance(
        lastPerformanceRef.current,
        mappedPerformance,
        smoothing,
      );
      lastPerformanceRef.current = smoothedPerformance;
      setFacialPerformance(smoothedPerformance);

      const mappedFace = mirror
        ? face.map((point) => ({ ...point, x: 1 - point.x }))
        : face;
      const bounds = landmarkBounds(mappedFace, width, height);
      const targetPoints = transformTargetLandmarks(mappedFace, width, height, scale, offsetY);
      const targetFaceBounds = pointBounds(targetPoints, FACE_OVAL);
      const headCenter = {
        x: targetFaceBounds.minX + targetFaceBounds.width / 2,
        y: targetFaceBounds.minY + targetFaceBounds.height / 2,
      };
      const previousHeadCenter = previousHeadCenterRef.current ?? headCenter;
      const velocity = {
        x: headCenter.x - previousHeadCenter.x,
        y: headCenter.y - previousHeadCenter.y,
      };
      previousHeadCenterRef.current = headCenter;
      const targetHairSway = {
        x: clamp(-velocity.x * 1.85 * (hairMotionStrength / 100), -targetFaceBounds.width * 0.16, targetFaceBounds.width * 0.16),
        y: clamp(-velocity.y * 1.2 * (hairMotionStrength / 100), -targetFaceBounds.height * 0.08, targetFaceBounds.height * 0.08),
        rotation: clamp(-velocity.x * 0.0028 * (hairMotionStrength / 100), -0.08, 0.08),
      };
      hairSwayRef.current = {
        x: hairSwayRef.current.x * 0.66 + targetHairSway.x * 0.34,
        y: hairSwayRef.current.y * 0.7 + targetHairSway.y * 0.3,
        rotation: hairSwayRef.current.rotation * 0.62 + targetHairSway.rotation * 0.38,
      };
      const left = mappedFace[234];
      const right = mappedFace[454];
      const angle = rotation
        ? Math.atan2((right.y - left.y) * height, (right.x - left.x) * width)
        : 0;
      const drawWidth = bounds.width * (scale / 100);
      const drawHeight = bounds.height * (scale / 100);
      const centerX = bounds.minX + bounds.width / 2;
      const centerY = bounds.minY + bounds.height / 2 + (offsetY / 100) * bounds.height;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);
      if (selectedPhoto && overlayMode === "portrait" && selectedPhoto.mesh) {
        ctx.restore();
        drawLockedPortrait(
          ctx,
          video,
          selectedPhoto,
          targetPoints,
          opacity,
          blendMode,
          edgeSoftness,
          lightingStrength,
          blendPenPointsRef.current,
          hairSwayRef.current,
        );
      } else if (selectedPhoto && overlayMode === "mesh" && selectedPhoto.mesh) {
        ctx.restore();
        drawWarpedFaceMesh(
          ctx,
          video,
          selectedPhoto,
          targetPoints,
          opacity,
          blendMode,
          edgeSoftness,
          lightingStrength,
          blendPenPointsRef.current,
          hairSwayRef.current,
        );
      } else if (selectedPhoto) {
        ctx.globalAlpha = opacity / 100;
        ctx.globalCompositeOperation = blendModeToComposite[blendMode];
        ctx.drawImage(
          selectedPhoto.image,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight,
        );
        ctx.restore();
      } else {
        ctx.strokeStyle = "rgba(45, 212, 191, 0.72)";
        ctx.lineWidth = 5;
        ctx.setLineDash([14, 12]);
        ctx.strokeRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();
      }

      if (debug) {
        ctx.save();
        ctx.strokeStyle = "rgba(45, 212, 191, 0.92)";
        ctx.lineWidth = 2;
        drawLandmarkPath(ctx, mappedFace, FACE_OVAL, width, height);
        ctx.strokeStyle = "rgba(251, 191, 36, 0.92)";
        drawLandmarkPath(ctx, mappedFace, LEFT_EYE, width, height);
        drawLandmarkPath(ctx, mappedFace, RIGHT_EYE, width, height);
        ctx.strokeStyle = "rgba(248, 113, 113, 0.92)";
        drawLandmarkPath(ctx, mappedFace, LIPS, width, height);
        ctx.restore();
      }
    } else if (cameraOn) {
      setStatus("Searching for face");
      if (lastPerformanceRef.current) {
        setFacialPerformance({
          ...lastPerformanceRef.current,
          trackingConfidence: Math.max(0, lastPerformanceRef.current.trackingConfidence - 0.08),
        });
      }
    }

    drawWatermark(ctx, width, height);

    const now = performance.now();
    fpsTimesRef.current = fpsTimesRef.current.filter((time) => now - time < 1000);
    fpsTimesRef.current.push(now);
    const nextFps = fpsTimesRef.current.length;
    const renderMs = now - renderStart;
    const memory = performance as Performance & { memory?: { usedJSHeapSize: number } };
    const memoryMb = memory.memory ? Math.round(memory.memory.usedJSHeapSize / 1024 / 1024) : null;
    const droppedFrame = renderMs > 42 ? 1 : 0;
    setFps(nextFps);
    setPerfStats((current) => ({
      fps: nextFps,
      inferenceMs: Math.round(inferenceMs),
      renderMs: Math.round(renderMs),
      droppedFrames: current.droppedFrames + droppedFrame,
      memoryMb,
    }));
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [
    blendMode,
    cameraOn,
    debug,
    edgeSoftness,
    hairMotionStrength,
    lightingStrength,
    mirror,
    offsetY,
    opacity,
    overlayMode,
    perfStats.inferenceMs,
    rotation,
    scale,
    selectedPhoto,
    smoothing,
  ]);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      await ensureLandmarker();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          facingMode: "user",
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (sourcePreviewRef.current) {
        sourcePreviewRef.current.srcObject = stream;
        await sourcePreviewRef.current.play();
      }
      setCameraOn(true);
      setStep((current) => (current === "camera" ? "live" : current));
      setStatus("Searching for face");
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(drawFrame);
    } catch (err) {
      setError(friendlyErrorMessage(err, "Camera failed to start"));
      setStatus("Camera blocked");
      setCameraOn(false);
      setIsLoadingModel(false);
    }
  }, [drawFrame, ensureLandmarker, selectedDeviceId]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (sourcePreviewRef.current) sourcePreviewRef.current.srcObject = null;
    setCameraOn(false);
    setStatus("Camera idle");
    setFps(0);
  }, []);

  const handleUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    if (files.length > 1) {
      setError("Upload one face photo at a time for this MVP.");
      event.target.value = "";
      return;
    }

    const record =
      consentRecord ??
      createConsentRecord({
        photoName: files[0].name,
        ownsOrHasPermission: true,
        notPublicFigure: true,
        notMinorWithoutConsent: true,
      });
    setConsentRecord(record);
    if (!sessionAudit) {
      setSessionAudit(createSessionAudit(record.id));
    }

    const loaded = await Promise.all(
      files.map(async (file) => {
        const fileValidation = validateImageFile(file);
        if (!fileValidation.valid) {
          throw new Error(fileValidation.errors.join(" "));
        }
        const url = URL.createObjectURL(file);
        const image = await loadImage(url);
        const dimensionValidation = validateImageDimensions(
          image.naturalWidth || image.width,
          image.naturalHeight || image.height,
        );
        const basicValidation = combineValidationResults(fileValidation, dimensionValidation);
        if (!basicValidation.valid) {
          URL.revokeObjectURL(url);
          throw new Error(basicValidation.errors.join(" "));
        }
        const meshResult = await analyzePhotoMesh(image);
        if (meshResult.meshStatus !== "ready") {
          URL.revokeObjectURL(url);
          throw new Error(
            meshResult.meshStatus === "multiple-faces"
              ? "Exactly one face is required."
              : meshResult.meshStatus === "side-profile"
                ? "Use a clear front-facing image, not a side profile."
                : "No usable face mesh was detected.",
          );
        }
        return {
          id: crypto.randomUUID(),
          name: file.name,
          url,
          image,
          consentTimestamp: record.confirmedAt,
          validationWarnings: basicValidation.warnings,
          ...meshResult,
        };
      }),
    ).catch((err) => {
      setError(friendlyErrorMessage(err, "Upload failed"));
      return [];
    });

    setPhotos((current) => [...current, ...loaded]);
    setSelectedId((current) => current ?? loaded[0]?.id ?? null);
    if (loaded.length > 0) {
      setStep("camera");
      setError(null);
    }
    event.target.value = "";
  }, [
    analyzePhotoMesh,
    consentRecord,
    sessionAudit,
  ]);

  const takeSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `about-face-ai-generated-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !browserSupportsCanvasRecording(canvas)) {
      setError("This browser cannot record the canvas preview. Use current Chrome or Edge.");
      return;
    }
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
    }
    recordingChunksRef.current = [];
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordingChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordingChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setRecordingUrl(url);
      setRecordingMetadata(
        JSON.stringify(createProvenanceMetadata(sessionAudit?.id ?? "local-session"), null, 2),
      );
      setRecording(false);
      setStep("recording");
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    setStep("recording");
  }, [recordingUrl, sessionAudit]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  const deleteRecording = useCallback(() => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setRecordingUrl(null);
    setRecordingMetadata(null);
    recordingChunksRef.current = [];
  }, [recordingUrl]);

  const downloadRecording = useCallback(() => {
    if (!recordingUrl) return;
    const link = document.createElement("a");
    link.download = `about-face-ai-generated-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
    link.href = recordingUrl;
    link.click();
  }, [recordingUrl]);

  const completeCalibrationStep = useCallback(() => {
    setCalibrationIndex((current) => {
      const next = current + 1;
      if (next >= CALIBRATION_POSES.length) {
        setCalibrationComplete(true);
        setStep("live");
        return current;
      }
      return next;
    });
  }, []);

  const reportUnauthorizedUse = useCallback(() => {
    submitLocalReport(
      "unauthorized-likeness",
      "User opened the report/removal workflow from the MVP interface.",
    );
    setError("Report saved locally. Production should route this to a staffed removal queue.");
  }, []);

  const deleteAllData = useCallback(() => {
    stopCamera();
    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    deleteRecording();
    setPhotos([]);
    setSelectedId(null);
    setConsentRecord(null);
    setSessionAudit(null);
    deleteAllLocalData();
    setStatus("Local data deleted");
    setStep("welcome");
  }, [deleteRecording, stopCamera]);

  const resetControls = useCallback(() => {
    setOpacity(100);
    setScale(109);
    setOffsetY(-2);
    setEdgeSoftness(14);
    setLightingStrength(26);
    setRotation(true);
    setMirror(true);
    setDebug(false);
    setBlendMode("normal");
    setOverlayMode("portrait");
    blendPenPointsRef.current = [];
    blendPenUndoRef.current = [];
    blendPenRedoRef.current = [];
    previousHeadCenterRef.current = null;
    hairSwayRef.current = { x: 0, y: 0, rotation: 0 };
    setBlendPenPointCount(0);
    setBlendPenUndoCount(0);
    setBlendPenRedoCount(0);
  }, []);

  const beginBlendPenStroke = useCallback(() => {
    blendPenUndoRef.current = [...blendPenUndoRef.current, [...blendPenPointsRef.current]].slice(-80);
    blendPenRedoRef.current = [];
    setBlendPenUndoCount(blendPenUndoRef.current.length);
    setBlendPenRedoCount(0);
  }, []);

  const addBlendPenPoint = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!blendPenEnabled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
      const scale = canvas.width / Math.max(1, rect.width);
      blendPenPointsRef.current = [
        ...blendPenPointsRef.current,
        {
          x,
          y,
          radius: blendPenSize * scale,
          strength: blendPenStrength / 100,
        },
      ].slice(-600);
      setBlendPenPointCount(blendPenPointsRef.current.length);
    },
    [blendPenEnabled, blendPenSize, blendPenStrength],
  );

  const clearBlendPen = useCallback(() => {
    if (blendPenPointsRef.current.length > 0) {
      blendPenUndoRef.current = [...blendPenUndoRef.current, [...blendPenPointsRef.current]].slice(-80);
      blendPenRedoRef.current = [];
    }
    blendPenPointsRef.current = [];
    setBlendPenPointCount(0);
    setBlendPenUndoCount(blendPenUndoRef.current.length);
    setBlendPenRedoCount(0);
  }, []);

  const undoBlendPen = useCallback(() => {
    const previous = blendPenUndoRef.current.pop();
    if (!previous) return;
    blendPenRedoRef.current = [...blendPenRedoRef.current, [...blendPenPointsRef.current]].slice(-80);
    blendPenPointsRef.current = previous;
    setBlendPenPointCount(previous.length);
    setBlendPenUndoCount(blendPenUndoRef.current.length);
    setBlendPenRedoCount(blendPenRedoRef.current.length);
  }, []);

  const redoBlendPen = useCallback(() => {
    const next = blendPenRedoRef.current.pop();
    if (!next) return;
    blendPenUndoRef.current = [...blendPenUndoRef.current, [...blendPenPointsRef.current]].slice(-80);
    blendPenPointsRef.current = next;
    setBlendPenPointCount(next.length);
    setBlendPenUndoCount(blendPenUndoRef.current.length);
    setBlendPenRedoCount(blendPenRedoRef.current.length);
  }, []);

  const storageStatus = getSecureStorageStatus();

  if (step === "welcome") {
    return (
      <main className="welcome-shell">
        <section className="welcome-panel">
          <div className="brand-row large">
            <div className="brand-mark"><Sparkles size={24} /></div>
            <div>
              <h1>About Face</h1>
              <p>Turn. Transform. Stay in control.</p>
            </div>
          </div>
          <h2>Animate a face photo with your own facial movement.</h2>
          <p>
            This MVP runs in your browser with MediaPipe face tracking. Webcam frames are not uploaded,
            and the first renderer is mesh-based, so expect believable alignment rather than perfect photorealism.
          </p>
          <button className="button primary hero-action" onClick={() => setStep("upload")}>
            Create an Avatar
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="side-panel asset-panel">
        <div className="brand-row">
          <div className="brand-mark"><Sparkles size={18} /></div>
          <div>
            <h1>About Face</h1>
            <p>Turn. Transform. Stay in control.</p>
          </div>
        </div>

        <nav className="step-nav">
          {(["upload", "camera", "live", "recording", "privacy"] as AppStep[]).map((item) => (
            <button
              key={item}
              className={step === item ? "active" : ""}
              onClick={() => setStep(item)}
              disabled={item !== "upload" && photos.length === 0}
            >
              {item}
            </button>
          ))}
        </nav>

        <section className="mini-panel">
          <h2>Reference face</h2>
          <label className="upload-drop">
            <ImagePlus size={20} />
            <span>Upload face photo</span>
            <small>JPG, PNG, WebP. One clear front-facing face.</small>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} />
          </label>
        </section>

        <div className="asset-list">
          {photos.length === 0 ? (
            <div className="empty-state">No avatar photo loaded yet.</div>
          ) : (
            photos.map((photo) => (
              <button
                className={`asset-item ${photo.id === selectedId ? "selected" : ""}`}
                key={photo.id}
                onClick={() => setSelectedId(photo.id)}
              >
                <img src={photo.url} alt="" />
                <span>
                  {photo.name}
                  <small>{photo.meshStatus === "ready" ? "Mesh ready" : photo.meshStatus}</small>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="stage">
        <header className="stage-header">
          <div>
            <h2>
              {step === "upload" && "Upload a face"}
              {step === "camera" && "Camera setup and calibration"}
              {step === "live" && "Live transformation"}
              {step === "recording" && "Recording"}
              {step === "privacy" && "Privacy settings"}
            </h2>
            <p>{storageStatus.message}</p>
          </div>
          <div className="camera-actions">
            {cameraOn ? (
              <button className="button secondary" onClick={stopCamera}><CameraOff size={18} />Stop</button>
            ) : (
              <button className="button primary" onClick={startCamera} disabled={isLoadingModel || photos.length === 0}>
                <Camera size={18} />{isLoadingModel ? "Loading" : "Start camera"}
              </button>
            )}
            <button className="button secondary" onClick={takeSnapshot} disabled={!cameraOn}><Download size={18} />Snapshot</button>
          </div>
        </header>

        {step === "upload" && (
          <div className="flow-panel">
            <p className="helper-text">
              Upload one clear, front-facing JPG, PNG, or WebP. The app will validate that it can detect exactly one usable face.
            </p>
          </div>
        )}

        {step !== "upload" && (
          <div className={`preview-grid ${showOriginal ? "" : "single"}`}>
            {showOriginal && (
              <div className="camera-frame compact">
                <video ref={sourcePreviewRef} playsInline muted />
                {!cameraOn && <div className="camera-placeholder"><Camera size={32} /><strong>Original preview</strong></div>}
              </div>
            )}
            <div className="camera-frame">
              <video ref={videoRef} playsInline muted />
              <canvas
                ref={canvasRef}
                className={blendPenEnabled ? "blend-pen-active" : ""}
                onPointerDown={(event) => {
                  if (!blendPenEnabled) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  beginBlendPenStroke();
                  addBlendPenPoint(event);
                }}
                onPointerMove={(event) => {
                  if (!blendPenEnabled || event.buttons !== 1) return;
                  addBlendPenPoint(event);
                }}
              />
              {!cameraOn && (
                <div className="camera-placeholder">
                  <Camera size={42} />
                  <strong>Avatar preview is off</strong>
                  <span>Start the camera to track head, eyes, brows, mouth, smile, and basic expressions.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {step === "camera" && (
          <div className="flow-panel horizontal">
            <label className="select-row">
              <span>Webcam</span>
              <select value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)}>
                {devices.length === 0 ? <option value="">Default camera</option> : devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>
                ))}
              </select>
            </label>
            <div className="calibration-card">
              <strong>Calibration</strong>
              <span>{calibrationComplete ? "Complete" : `Pose ${calibrationIndex + 1} of ${CALIBRATION_POSES.length}: ${CALIBRATION_POSES[calibrationIndex]}`}</span>
              <button className="button secondary" onClick={completeCalibrationStep} disabled={!cameraOn}>
                {calibrationComplete ? "Recheck pose" : "Capture pose"}
              </button>
            </div>
          </div>
        )}

        {step === "recording" && (
          <div className="flow-panel recording-panel">
            <div className="camera-actions">
              {recording ? (
                <button className="button primary" onClick={stopRecording}><Square size={17} />Stop recording</button>
              ) : (
                <button className="button primary" onClick={startRecording} disabled={!cameraOn}><Play size={17} />Start recording</button>
              )}
              <button className="button secondary" onClick={downloadRecording} disabled={!recordingUrl}><Download size={17} />Download</button>
              <button className="button secondary" onClick={deleteRecording} disabled={!recordingUrl}><Trash2 size={17} />Delete</button>
            </div>
            {recordingUrl && <video className="recording-preview" src={recordingUrl} controls />}
            {recordingMetadata && <pre className="metadata-box">{recordingMetadata}</pre>}
          </div>
        )}

        {step === "privacy" && (
          <div className="flow-panel">
            <div className="notice"><Info size={18} /><span>Local mode: webcam frames stay in the browser. Uploaded references are object URLs in this session unless future Supabase upload is enabled.</span></div>
            <button className="button secondary" onClick={reportUnauthorizedUse}>Report unauthorized likeness use</button>
            <button className="button secondary" onClick={deleteAllData}><Trash2 size={17} />Delete all my local data</button>
          </div>
        )}

        {error && <div className="error-strip">{error}</div>}

        <footer className="status-bar">
          <span className={`status-dot ${status.includes("locked") ? "active" : ""}`} />
          <span>{status}</span>
          <span>{fps} FPS</span>
          <span>{perfStats.inferenceMs}ms inference</span>
          <span>{perfStats.renderMs}ms render</span>
          <span>{perfStats.droppedFrames} dropped</span>
          <span>{perfStats.memoryMb ?? "n/a"} MB</span>
          <span>{selectedPhotoStatus}</span>
        </footer>
      </section>

      <aside className="side-panel controls-panel">
        <div className="panel-title"><SlidersHorizontal size={19} /><h2>Avatar controls</h2></div>
        <ControlSlider label="Realism strength" value={opacity} min={15} max={100} onChange={setOpacity} />
        <ControlSlider label="Scale" value={scale} min={70} max={170} onChange={setScale} />
        <ControlSlider label="Vertical offset" value={offsetY} min={-35} max={35} onChange={setOffsetY} />
        <ControlSlider label="Edge softness" value={edgeSoftness} min={0} max={34} onChange={setEdgeSoftness} />
        <ControlSlider label="Live lighting" value={lightingStrength} min={0} max={85} onChange={setLightingStrength} />
        <ControlSlider label="Hair motion" value={hairMotionStrength} min={0} max={100} onChange={setHairMotionStrength} />
        <ControlSlider label="Expression smoothing" value={smoothing} min={0} max={100} onChange={setSmoothing} />
        <Toggle label="Edge blend pen" checked={blendPenEnabled} onChange={setBlendPenEnabled} />
        <ControlSlider label="Pen size" value={blendPenSize} min={8} max={90} onChange={setBlendPenSize} />
        <ControlSlider label="Pen strength" value={blendPenStrength} min={8} max={80} onChange={setBlendPenStrength} />
        <div className="button-row">
          <button className="button secondary" onClick={undoBlendPen} disabled={blendPenUndoCount === 0}>
            <Undo2 size={17} />
            Undo
          </button>
          <button className="button secondary" onClick={redoBlendPen} disabled={blendPenRedoCount === 0}>
            <Redo2 size={17} />
            Redo
          </button>
        </div>
        <button className="button full secondary" onClick={clearBlendPen} disabled={blendPenPointCount === 0}>
          Clear blend pen ({blendPenPointCount})
        </button>

        <label className="select-row">
          <span>Overlay mode</span>
          <select value={overlayMode} onChange={(event) => setOverlayMode(event.target.value as OverlayMode)}>
            <option value="portrait">Real photo lock</option>
            <option value="mesh">Expression mesh - experimental</option>
            <option value="flat">Flat photo</option>
          </select>
        </label>
        <label className="select-row">
          <span>Blend mode</span>
          <select value={blendMode} onChange={(event) => setBlendMode(event.target.value as BlendMode)}>
            <option value="normal">Normal</option>
            <option value="multiply">Multiply</option>
            <option value="screen">Screen</option>
            <option value="overlay">Overlay</option>
            <option value="soft-light">Soft light</option>
          </select>
        </label>

        <Toggle label="Show original preview" checked={showOriginal} onChange={setShowOriginal} />
        <Toggle label="Mirror preview" checked={mirror} onChange={setMirror} />
        <Toggle label="Follow head tilt" checked={rotation} onChange={setRotation} />
        <Toggle label="Landmark debug" checked={debug} onChange={setDebug} icon={debug ? Eye : EyeOff} />

        <button className="button full secondary" onClick={resetControls}><RefreshCw size={17} />Reset controls</button>
        <div className="performance-panel">
          <h3>Facial performance</h3>
          <Metric label="Pitch" value={facialPerformance?.headPose.pitch ?? 0} />
          <Metric label="Yaw" value={facialPerformance?.headPose.yaw ?? 0} />
          <Metric label="Roll" value={facialPerformance?.headPose.roll ?? 0} />
          <Metric label="Left blink" value={facialPerformance?.eyes.leftBlink ?? 0} />
          <Metric label="Right blink" value={facialPerformance?.eyes.rightBlink ?? 0} />
          <Metric label="Mouth open" value={facialPerformance?.mouth.mouthOpen ?? 0} />
          <Metric label="Smile L/R" value={((facialPerformance?.mouth.smileLeft ?? 0) + (facialPerformance?.mouth.smileRight ?? 0)) / 2} />
          <Metric label="Confidence" value={facialPerformance?.trackingConfidence ?? 0} />
        </div>
        <div className="note">Use Real photo lock for the most authentic current output. Expression mesh is experimental and can distort the face until a neural renderer is added.</div>
      </aside>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value.toFixed(2)}</strong>
    </div>
  );
}

function ControlSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const percentage = ((value - min) / (max - min)) * 100;
  return (
    <label className="control-slider">
      <span>
        {label}
        <strong>{value}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        style={{ backgroundSize: `${clamp(percentage, 0, 100)}% 100%` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  icon: Icon,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  icon?: React.ComponentType<{ size: number }>;
}) {
  return (
    <label className="toggle-row">
      <span>
        {Icon && <Icon size={16} />}
        {label}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
