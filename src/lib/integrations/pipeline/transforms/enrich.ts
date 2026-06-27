import type { IntegrationEvent } from "../../types";
import type { TransformContext, TransformFn } from "../types";

export const enrichTransform: TransformFn = {
  name: "enrich",
  transform(event: IntegrationEvent, ctx: TransformContext): IntegrationEvent {
    const pageUrl = (event.meta?.url as string | undefined) ?? undefined;
    return {
      ...event,
      meta: {
        ...event.meta,
        enrichedAt:    new Date(event.timestamp).toISOString(),
        correlationId: ctx.correlationId,
        ...(pageUrl !== undefined ? { page_url: pageUrl } : {}),
      },
    };
  },
};
