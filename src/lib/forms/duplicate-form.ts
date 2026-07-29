import type { Form } from "@/types";

export type DuplicableForm = Pick<
  Form,
  | "name"
  | "description"
  | "folder_id"
  | "theme"
  | "settings"
  | "steps"
  | "logic_rules"
  | "welcome_screen"
  | "endings"
  | "integrations"
  | "origin"
  | "client_id"
>;

export interface DuplicableIntegration {
  adapter: string;
  enabled: boolean;
  settings: Record<string, unknown> | null;
  secrets: Record<string, unknown> | null;
  event_filter: string[] | null;
  retry_policy: Record<string, unknown> | null;
  rate_limit: Record<string, unknown> | null;
}

export function buildDuplicateFormInsert(
  original: DuplicableForm,
  input: { userId: string; slug: string },
) {
  return {
    user_id:        input.userId,
    created_by:     input.userId,
    updated_by:     input.userId,
    name:           `${original.name} (cópia)`,
    slug:           input.slug,
    description:    original.description,
    folder_id:      original.folder_id,
    theme:          original.theme,
    settings:       original.settings,
    steps:          original.steps,
    logic_rules:    original.logic_rules,
    welcome_screen: original.welcome_screen,
    endings:        original.endings,
    integrations:   original.integrations,
    origin:         original.origin,
    client_id:      original.client_id,
    status:         "draft" as const,
    published_at:   null,
  };
}

export function buildDuplicateIntegrationRows(
  integrations: DuplicableIntegration[],
  input: { formId: string; userId: string },
) {
  return integrations.map(integration => ({
    form_id:      input.formId,
    user_id:      input.userId,
    adapter:      integration.adapter,
    enabled:      integration.enabled,
    settings:     integration.settings ?? {},
    secrets:      integration.secrets ?? {},
    event_filter: integration.event_filter,
    retry_policy: integration.retry_policy,
    rate_limit:   integration.rate_limit,
  }));
}

export function copySlugCandidate(originalSlug: string, attempt: number): string {
  const suffix = attempt === 1 ? "copia" : `copia-${attempt}`;
  return `${originalSlug}-${suffix}`.slice(0, 120);
}
