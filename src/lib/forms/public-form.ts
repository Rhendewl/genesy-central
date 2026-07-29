import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import type { Form } from "@/types";

const FORM_FIELDS = "id, user_id, name, slug, description, status, theme, settings, steps, logic_rules, welcome_screen, endings";

/**
 * Public forms deliberately bypass Next's data cache.
 *
 * A missing form must never become a cached 404: visitors often open the public
 * URL before the owner clicks Publish. Publication and edits are cheap reads
 * compared with serving a stale or inaccessible form.
 */
export async function getPublicFormBySlug(slug: string): Promise<Form | null> {
  const { data, error } = await createAdminSupabaseClient()
    .from("forms")
    .select(FORM_FIELDS)
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as Form;
}
