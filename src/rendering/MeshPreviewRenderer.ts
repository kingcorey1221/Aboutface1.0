import type {
  FaceReenactmentRenderer,
  FacialPerformanceFrame,
  RenderedFrame,
  TargetIdentity,
} from "../types";

export class MeshPreviewRenderer implements FaceReenactmentRenderer {
  readonly name = "Fast Preview";
  readonly mode = "mesh-preview" as const;
  private identity: TargetIdentity | null = null;

  async initialize(identity: TargetIdentity) {
    this.identity = identity;
  }

  async render(performance: FacialPerformanceFrame): Promise<RenderedFrame> {
    if (!this.identity) {
      throw new Error("MeshPreviewRenderer must be initialized before rendering.");
    }

    throw new Error(
      `MeshPreviewRenderer adapter is a fallback contract. The current canvas implementation still renders inside main.tsx for frame ${performance.frameId}.`,
    );
  }

  async dispose() {
    this.identity = null;
  }
}
