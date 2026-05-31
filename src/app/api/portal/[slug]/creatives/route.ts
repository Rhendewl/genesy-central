import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { decryptToken } from "@/lib/crypto";
import { getAdInsights, getAdsWithCreatives, extractLeads } from "@/lib/meta-api";
import type { MetaAdWithCreative } from "@/lib/meta-api";
import { startOfMonth, format } from "date-fns";
import type { PortalCreative } from "@/types";

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

// Extract the best available image URL from a creative object.
// Priority: thumbnail_url → image_url → effective_object_story_spec (resolved) → object_story_spec
function pickBestImage(creative: MetaAdWithCreative["creative"]): string | null {
  if (!creative) return null;
  if (creative.thumbnail_url) return creative.thumbnail_url;
  if (creative.image_url) return creative.image_url;
  // effective_object_story_spec has fully-resolved URLs (preferred)
  const eff = creative.effective_object_story_spec;
  if (eff?.link_data?.picture) return eff.link_data.picture;
  if (eff?.link_data?.image_url) return eff.link_data.image_url;
  if (eff?.video_data?.image_url) return eff.video_data.image_url;
  if (eff?.photo_data?.images?.[0]?.url) return eff.photo_data.images[0].url;
  // Fallback to object_story_spec
  const spec = creative.object_story_spec;
  if (spec?.link_data?.picture) return spec.link_data.picture;
  if (spec?.link_data?.image_url) return spec.link_data.image_url;
  if (spec?.video_data?.image_url) return spec.video_data.image_url;
  if (spec?.photo_data?.images?.[0]?.url) return spec.photo_data.images[0].url;
  return null;
}

// GET /api/portal/[slug]/creatives — public endpoint, no auth required
// Query params: since, until (YYYY-MM-DD)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const sp = req.nextUrl.searchParams;

    let admin;
    let db: ReturnType<typeof createAnonClient>;
    try {
      admin = createAdminSupabaseClient();
      db = admin;
    } catch {
      console.warn("[portal/creatives] service role key not configured");
      db = createAnonClient();
    }

    // 1. Load portal
    const { data: rawPortal } = await db
      .from("portals")
      .select("id, user_id, status")
      .eq("slug", slug)
      .maybeSingle();

    if (!rawPortal || rawPortal.status === "pausado") {
      console.log(`[portal/creatives] portal "${slug}" not found or paused`);
      return NextResponse.json({ creatives: [] });
    }

    if (!admin) {
      console.error("[portal/creatives] admin client unavailable (service role key missing)");
      return NextResponse.json({ creatives: [] });
    }

    // 2. Allowed ad account IDs for this portal
    const { data: portalAccounts } = await admin
      .from("portal_accounts")
      .select("ad_account_id")
      .eq("portal_id", rawPortal.id);

    const allowedAccountIds = (portalAccounts ?? []).map(
      (pa: { ad_account_id: string }) => pa.ad_account_id
    );

    if (allowedAccountIds.length === 0) {
      console.log(`[portal/creatives] no account IDs linked to portal "${slug}"`);
      return NextResponse.json({ creatives: [] });
    }

    // 3. Platform accounts scoped to portal owner
    const { data: platformAccounts } = await admin
      .from("ad_platform_accounts")
      .select("id, account_id")
      .eq("user_id", rawPortal.user_id)
      .in("account_id", allowedAccountIds);

    if (!platformAccounts?.length) {
      console.log("[portal/creatives] no platform accounts matched:", allowedAccountIds);
      return NextResponse.json({ creatives: [] });
    }

    const platformAccountIds = platformAccounts.map((pa: { id: string }) => pa.id);

    // 4. Meta tokens (encrypted)
    const { data: tokens } = await admin
      .from("meta_tokens")
      .select("platform_account_id, encrypted_token")
      .in("platform_account_id", platformAccountIds);

    if (!tokens?.length) {
      console.log("[portal/creatives] no Meta tokens found for platform accounts");
      return NextResponse.json({ creatives: [] });
    }

    const tokenMap = new Map<string, string>();
    for (const t of tokens) {
      try {
        tokenMap.set(t.platform_account_id, decryptToken(t.encrypted_token));
      } catch {
        console.warn(`[portal/creatives] failed to decrypt token for ${t.platform_account_id}`);
      }
    }

    if (tokenMap.size === 0) {
      console.log("[portal/creatives] all tokens failed decryption");
      return NextResponse.json({ creatives: [] });
    }

    // 5. Parse date range (default: current month to today)
    const now = new Date();
    const since = sp.get("since") || format(startOfMonth(now), "yyyy-MM-dd");
    const until = sp.get("until") || format(now, "yyyy-MM-dd");

    console.log(`[portal/creatives] slug="${slug}" range=${since}→${until} accounts=${platformAccounts.length}`);

    // 6. Fetch ad-level data from Meta API
    type AdInsightEntry = {
      leads: number;
      spend: number;
      reach: number;
      clicks: number;
      ctr: number;
      cpc: number;
      campaign_name: string;
    };

    const adInsightMap = new Map<string, AdInsightEntry>();
    const adInfoMap = new Map<string, {
      name: string;
      image_url: string | null;
      status: "ativa" | "pausada";
    }>();

    for (const pa of platformAccounts as { id: string; account_id: string }[]) {
      const token = tokenMap.get(pa.id);
      if (!token) continue;

      // ── Fetch insights ──────────────────────────────────────────
      let insights: Awaited<ReturnType<typeof getAdInsights>> = [];
      try {
        insights = await getAdInsights(pa.account_id, token, since, until);
      } catch (err) {
        console.error(`[portal/creatives] getAdInsights failed for account ${pa.account_id}:`, err);
      }

      // ── Fetch ads + creatives ───────────────────────────────────
      let ads: Awaited<ReturnType<typeof getAdsWithCreatives>> = [];
      try {
        ads = await getAdsWithCreatives(pa.account_id, token);
      } catch (err) {
        console.error(`[portal/creatives] getAdsWithCreatives failed for account ${pa.account_id}:`, err);
      }

      // ── DIAGNOSTIC LOGS ──────────────────────────────────────────
      console.log(`[portal/creatives] account ${pa.account_id}: ${insights.length} insight rows, ${ads.length} ads`);

      if (insights.length > 0) {
        console.log(`[portal/creatives] insight sample[0]:`, {
          ad_id:              insights[0].ad_id,
          ad_name:            insights[0].ad_name,
          campaign_name:      insights[0].campaign_name,
          spend:              insights[0].spend,
          impressions:        insights[0].impressions,
          reach:              insights[0].reach,
          clicks:             insights[0].clicks,
          inline_link_clicks: insights[0].inline_link_clicks,
          ctr:                insights[0].ctr,
          cpc:                insights[0].cpc,
          actions_count:      insights[0].actions?.length ?? 0,
          actions:            insights[0].actions?.slice(0, 5),
        });
      } else {
        console.log(`[portal/creatives] ⚠ getAdInsights returned 0 rows for ${pa.account_id} (${since}→${until})`);
      }

      if (ads.length > 0) {
        console.log(`[portal/creatives] ad sample[0]:`, {
          id:                          ads[0].id,
          name:                        ads[0].name,
          status:                      ads[0].status,
          creative_id:                 ads[0].creative?.id,
          thumbnail_url:               ads[0].creative?.thumbnail_url,
          image_url:                   ads[0].creative?.image_url,
          has_effective_spec:          !!ads[0].creative?.effective_object_story_spec,
          has_spec:                    !!ads[0].creative?.object_story_spec,
          eff_link_picture:            ads[0].creative?.effective_object_story_spec?.link_data?.picture,
          picked_image:                pickBestImage(ads[0].creative),
        });
      }
      // ── END DIAGNOSTIC LOGS ──────────────────────────────────────

      // Index ad creative / status data
      for (const ad of ads) {
        adInfoMap.set(ad.id, {
          name:      ad.name,
          image_url: pickBestImage(ad.creative),
          status:    ad.status === "ACTIVE" ? "ativa" : "pausada",
        });
      }

      // Aggregate ad-level insights into adInsightMap
      for (const row of insights) {
        if (!row.ad_id) {
          console.warn("[portal/creatives] insight row missing ad_id — skipping:", {
            ad_name:      row.ad_name,
            campaign_name: row.campaign_name,
            spend:         row.spend,
          });
          continue;
        }

        const leads  = extractLeads(row.actions);
        const spend  = parseFloat(row.spend  ?? "0");
        const reach  = parseInt(row.reach    ?? "0", 10);
        const clicks = parseInt(row.inline_link_clicks ?? row.clicks ?? "0", 10);
        const ctr    = parseFloat(row.ctr    ?? "0");
        const cpc    = parseFloat(row.cpc    ?? "0");

        const existing = adInsightMap.get(row.ad_id);
        adInsightMap.set(row.ad_id, {
          leads:         (existing?.leads  ?? 0) + leads,
          spend:         (existing?.spend  ?? 0) + spend,
          reach:         (existing?.reach  ?? 0) + reach,
          clicks:        (existing?.clicks ?? 0) + clicks,
          ctr,
          cpc,
          campaign_name: row.campaign_name,
        });
      }
    }

    console.log(`[portal/creatives] adInsightMap=${adInsightMap.size} adInfoMap=${adInfoMap.size}`);

    // 7. Merge insights + creative info → PortalCreative[]
    const creatives: PortalCreative[] = [];
    let skippedZero = 0;

    for (const [adId, insight] of Array.from(adInsightMap)) {
      // Skip only if there is absolutely no engagement (no spend, no clicks, no leads)
      if (insight.leads === 0 && insight.spend < 0.01 && insight.clicks === 0) {
        skippedZero++;
        continue;
      }

      const adInfo = adInfoMap.get(adId);
      const cpl    = insight.leads > 0 ? insight.spend / insight.leads : 0;

      creatives.push({
        ad_id:         adId,
        creative_name: adInfo?.name ?? `Anúncio ${adId}`,
        campaign_name: insight.campaign_name,
        image_url:     adInfo?.image_url ?? null,
        status:        adInfo?.status ?? "pausada",
        leads:         insight.leads,
        cpl,
        spend:         insight.spend,
        reach:         insight.reach,
        clicks:        insight.clicks,
        ctr:           insight.ctr,
        cpc:           insight.cpc,
        ranking:       0,
      });
    }

    // 8. Rank: leads desc → spend desc → CPL asc
    creatives.sort((a, b) => {
      if (b.leads !== a.leads) return b.leads - a.leads;
      if (b.spend !== a.spend) return b.spend - a.spend;
      if (a.cpl !== b.cpl)    return a.cpl - b.cpl;
      return b.ctr - a.ctr;
    });
    creatives.forEach((c, i) => { c.ranking = i + 1; });

    console.log(`[portal/creatives] result: ${creatives.length} creatives (${skippedZero} skipped zero-engagement), returning top ${Math.min(creatives.length, 8)}`);

    if (creatives.length > 0) {
      console.log(`[portal/creatives] top 3:`, creatives.slice(0, 3).map(c => ({
        name:   c.creative_name,
        leads:  c.leads,
        spend:  c.spend,
        clicks: c.clicks,
        has_thumbnail: !!c.image_url,
      })));
    }

    return NextResponse.json({ creatives: creatives.slice(0, 8) });

  } catch (err) {
    console.error("[portal/creatives] unhandled error:", err);
    return NextResponse.json({ creatives: [] });
  }
}
