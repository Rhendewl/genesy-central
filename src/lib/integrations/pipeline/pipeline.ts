import type { IntegrationEvent, TransformedEvent } from "../types";
import type { TransformContext, TransformFn, TransformPipeline } from "./types";

export function createTransformPipeline(transforms: TransformFn[]): TransformPipeline {
  return {
    run(event: IntegrationEvent, ctx: TransformContext): TransformedEvent {
      let current = event;
      const applied: string[] = [];

      for (const t of transforms) {
        current = t.transform(current, ctx);
        applied.push(t.name);
      }

      return { ...current, transformed: true as const, transforms: applied };
    },
  };
}
