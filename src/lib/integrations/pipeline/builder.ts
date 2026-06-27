import type { TransformFn, TransformPipeline } from "./types";
import { createTransformPipeline } from "./pipeline";

export class PipelineBuilder {
  private readonly transforms: TransformFn[] = [];

  use(transform: TransformFn): this {
    this.transforms.push(transform);
    return this;
  }

  build(): TransformPipeline {
    return createTransformPipeline([...this.transforms]);
  }
}
