import type { FacialPerformance } from "../types";

export interface FaceRenderer {
  initialize(targetImage: ImageData): Promise<void>;
  render(performance: FacialPerformance, sourceFrame?: VideoFrame): Promise<ImageBitmap>;
  dispose(): Promise<void>;
}
