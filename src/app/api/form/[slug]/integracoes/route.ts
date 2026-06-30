import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import type { IntegrationConfig } from "@/lib/integrations/types";

type Params = { params: Promise<{ slug: string }> };

// GET /api/form/:slug/integracoes
// Returns active integration configs (including secrets) for the public form renderer.
// Admin client: no user session — only published, non-deleted forms are accessible.
// Access token is intentionally included: it's needed by MetaPixelAdapter for CAPI calls
// that run client-side. Scope is limited to the specific form's own integrations.
export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();

  const { data: form } = await supabase
    .from("forms")
    .select("id")
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .single();

  if (!form) {
    return NextResponse.json({ configs: [] });
  }

  const { data: rows } = await supabase
    .from("form_integrations")
    .select("id, adapter, enabled, settings, secrets, event_filter, retry_policy, rate_limit")
    .eq("form_id", form.id)
    .eq("enabled", true);

  const configs: IntegrationConfig[] = (rows ?? []).map(row => ({
    id:          row.id as string,
    adapterName: row.adapter as string,
    enabled:     row.enabled as boolean,
    settings:    (row.settings ?? {}) as Record<string, unknown>,
    secrets:     (row.secrets ?? {}) as Record<string, string>,
    eventFilter: (row.event_filter ?? undefined) as string[] | undefined,
    retryPolicy: (row.retry_policy ?? undefined) as IntegrationConfig["retryPolicy"],
    rateLimit:   (row.rate_limit ?? undefined) as IntegrationConfig["rateLimit"],
  }));

  return NextResponse.json({ configs });
}
