export type FaceTrackerMode = "mediapipe-face-landmarker";

export type FaceTrackerConfig = {
  mode: FaceTrackerMode;
  localModelPath: string;
  usesFacialRecognition: false;
  outputsBlendshapes: boolean;
};

export const defaultFaceTrackerConfig: FaceTrackerConfig = {
  mode: "mediapipe-face-landmarker",
  localModelPath: "/mediapipe/models/face_landmarker.task",
  usesFacialRecognition: false,
  outputsBlendshapes: true,
};
