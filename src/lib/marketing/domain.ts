import { MARKETING_CONTENT_STATUSES, MARKETING_FORMATS, MARKETING_IDEA_STATUSES, MARKETING_PLATFORMS, MARKETING_PRIORITIES, type MarketingContent, type MarketingContentInput, type MarketingIdeaInput } from "@/types/marketing";

const isOneOf = <T extends readonly string[]>(values: T, value: unknown): value is T[number] => typeof value === "string" && values.includes(value);
const cleanText = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const optionalText = (value: unknown, max = 10000) => { const text = cleanText(value, max); return text || null; };
const links = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && /^https?:\/\//i.test(item)).slice(0, 20) : [];
const tagNames = (value: unknown) => Array.isArray(value) ? Array.from(new Set(value.map((item) => cleanText(item, 60)).filter(Boolean))).slice(0, 20) : [];
const optionalUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
const uuidList = (value: unknown, max = 30) => Array.isArray(value)
  ? Array.from(new Set(value.map(optionalUuid).filter((id): id is string => !!id))).slice(0, max)
  : [];

export function parseMarketingContentInput(value: unknown): MarketingContentInput {
  if (!value || typeof value !== "object") throw new Error("Corpo inválido");
  const body = value as Record<string, unknown>;
  const title = cleanText(body.title, 180);
  if (!title) throw new Error("Título é obrigatório");
  const scheduledAt = typeof body.scheduled_at === "string" && !Number.isNaN(Date.parse(body.scheduled_at)) ? new Date(body.scheduled_at).toISOString() : null;
  const deliveryAt = typeof body.delivery_at === "string" && !Number.isNaN(Date.parse(body.delivery_at)) ? new Date(body.delivery_at).toISOString() : null;
  return {
    title,
    description: optionalText(body.description),
    status: isOneOf(MARKETING_CONTENT_STATUSES, body.status) ? body.status : "planned",
    platform: isOneOf(MARKETING_PLATFORMS, body.platform) ? body.platform : "instagram",
    format: isOneOf(MARKETING_FORMATS, body.format) ? body.format : "static_post",
    scheduled_at: scheduledAt,
    delivery_at: deliveryAt,
    published_at: typeof body.published_at === "string" && !Number.isNaN(Date.parse(body.published_at)) ? new Date(body.published_at).toISOString() : null,
    primary_assignee_id: typeof body.primary_assignee_id === "string" ? body.primary_assignee_id : null,
    workspace_task_id: optionalUuid(body.workspace_task_id),
    create_workspace_task: body.create_workspace_task === true,
    workspace_tag_ids: uuidList(body.workspace_tag_ids, 20),
    assignee_ids: uuidList(body.assignee_ids, 30),
    asset_ids: uuidList(body.asset_ids, 50),
    priority: isOneOf(MARKETING_PRIORITIES, body.priority) ? body.priority : "medium",
    caption: optionalText(body.caption), script: optionalText(body.script), cta: optionalText(body.cta, 1000), notes: optionalText(body.notes),
    thumbnail_url: optionalText(body.thumbnail_url, 2000), reference_links: links(body.reference_links), publication_url: optionalText(body.publication_url, 2000),
    manual_publication: body.manual_publication === true, post_publication_notes: optionalText(body.post_publication_notes),
    tag_names: tagNames(body.tag_names),
  };
}

export function parseMarketingIdeaInput(value: unknown): MarketingIdeaInput {
  if (!value || typeof value !== "object") throw new Error("Corpo inválido");
  const body = value as Record<string, unknown>;
  const title = cleanText(body.title, 180);
  if (!title) throw new Error("Título é obrigatório");
  return {
    title, description: optionalText(body.description), category: optionalText(body.category, 100),
    suggested_platform: isOneOf(MARKETING_PLATFORMS, body.suggested_platform) ? body.suggested_platform : null,
    suggested_format: isOneOf(MARKETING_FORMATS, body.suggested_format) ? body.suggested_format : null,
    status: isOneOf(MARKETING_IDEA_STATUSES, body.status) ? body.status : "new",
    priority: isOneOf(MARKETING_PRIORITIES, body.priority) ? body.priority : "medium",
    suggested_assignee_id: typeof body.suggested_assignee_id === "string" ? body.suggested_assignee_id : null,
    reference_links: links(body.reference_links),
    tag_names: tagNames(body.tag_names),
  };
}

export function marketingStats(contents: MarketingContent[], now = new Date()) {
  const active = contents.filter((item) => !item.archived_at && item.status !== "cancelled");
  const overdue = active.filter((item) => item.scheduled_at && new Date(item.scheduled_at) < now && item.status !== "published");
  const published = active.filter((item) => item.status === "published");
  const completed = active.filter((item) => item.status === "published" || item.status === "scheduled");
  return { total: active.length, overdue: overdue.length, published: published.length, completionRate: active.length ? Math.round((completed.length / active.length) * 100) : 0 };
}
