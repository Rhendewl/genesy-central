import type { IntegrationEvent, TransformedEvent } from "../types";

export interface TransformContext {
  readonly formSlug:      string;
  readonly correlationId: string;
}

export interface TransformFn {
  readonly name: string;
  transform(event: IntegrationEvent, ctx: TransformContext): IntegrationEvent;
}

export interface TransformPipeline {
  run(event: IntegrationEvent, ctx: TransformContext): TransformedEvent;
}
