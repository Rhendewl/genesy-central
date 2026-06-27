import type { IntegrationEvent } from "../../types";
import type { TransformContext, TransformFn } from "../types";

export const normalizeTransform: TransformFn = {
  name: "normalize",
  transform(event: IntegrationEvent, _ctx: TransformContext): IntegrationEvent {
    return {
      ...event,
      type:    event.type.toLowerCase().trim(),
      payload: (event.payload ?? {}) as Record<string, unknown>,
      meta:    (event.meta   ?? {}) as Record<string, unknown>,
      version: event.version ?? 1,
    };
  },
};
