import { unstable_cache } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import type { Form } from "@/types";

const FORM_FIELDS = "id, user_id, name, slug, description, status, theme, settings, steps, logic_rules, welcome_screen, endings";

export const getPublicFormBySlug = unstable_cache(
  async (slug: string): Promise<Form | null> => {
    const { data, error } = await createAdminSupabaseClient()
      .from("forms")
      .select(FORM_FIELDS)
      .eq("slug", slug)
      .eq("status", "published")
      .is("deleted_at", null)
      .single();

    if (error || !data) return null;
    return data as unknown as Form;
  },
  ["public-form-by-slug-v1"],
  { revalidate: 60 },
);
