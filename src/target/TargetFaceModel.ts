export type TargetFaceRegion = "eyes" | "eyelids" | "eyebrows" | "mouth" | "lips" | "jaw" | "cheeks";

export type TargetFaceModel = {
  id: string;
  sourceImageName: string;
  preparedAt: string;
  regions: TargetFaceRegion[];
  depthMode: "single-image-estimate";
  limitations: string[];
};
