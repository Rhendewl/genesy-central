import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";
import { decryptToken } from "@/lib/crypto";
import { getInstagramAccountDailyExactMetrics, getInstagramAccountDailyInsights, getInstagramAccountTotals, type InstagramAccountMetrics } from "@/lib/instagram-api";

export const dynamic = "force-dynamic";

const metricKeys: Array<keyof InstagramAccountMetrics> = [
  "reach", "views", "profile_views", "accounts_engaged", "total_interactions",
  "likes", "comments", "shares", "saves", "profile_links_taps", "follower_count",
];

function emptyTotals(): InstagramAccountMetrics {
  return Object.fromEntries(metricKeys.map((key) => [key, 0])) as InstagramAccountMetrics;
}

function addTotals(target: InstagramAccountMetrics, source: Partial<InstagramAccountMetrics>) {
  for (const key of metricKeys) target[key] += Number(source[key] ?? 0);
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    const start = req.nextUrl.searchParams.get("start");
    const end = req.nextUrl.searchParams.get("end");
    const compareStart = req.nextUrl.searchParams.get("compareStart");
    const compareEnd = req.nextUrl.searchParams.get("compareEnd");
    const historyStart = req.nextUrl.searchParams.get("historyStart") ?? compareStart ?? start;
    const [connections, media, previousMedia, insights] = await Promise.all([
      supabase
        .from("marketing_instagram_connections")
        .select("id,instagram_user_id,username,display_name,profile_picture_url,followers_count,media_count,status,last_sync_at,sync_error,token_expires_at,created_at,encrypted_access_token,requested_scopes,webhook_subscribed,webhook_fields,webhook_error")
        .eq("organization_id", context.organizationId)
        .order("created_at"),
      (() => {
        let query = supabase
          .from("marketing_instagram_media")
          .select("id,connection_id,marketing_content_id,instagram_media_id,media_type,media_product_type,caption,media_url,thumbnail_url,permalink,published_at,reach,views,plays,likes,comments,saved,shares,total_interactions,average_watch_time,total_watch_time,last_synced_at")
          .eq("organization_id", context.organizationId)
          .order("published_at", { ascending: false });
        if (start) query = query.gte("published_at", `${start}T00:00:00`);
        if (end) query = query.lte("published_at", `${end}T23:59:59.999`);
        return query.limit(250);
      })(),
      (() => {
        let query = supabase
          .from("marketing_instagram_media")
          .select("id,connection_id,marketing_content_id,instagram_media_id,media_type,media_product_type,caption,media_url,thumbnail_url,permalink,published_at,reach,views,plays,likes,comments,saved,shares,total_interactions,average_watch_time,total_watch_time,last_synced_at")
          .eq("organization_id", context.organizationId)
          .order("published_at", { ascending: false });
        if (compareStart) query = query.gte("published_at", `${compareStart}T00:00:00`);
        if (compareEnd) query = query.lte("published_at", `${compareEnd}T23:59:59.999`);
        return query.limit(250);
      })(),
      (() => {
        let query = supabase
          .from("marketing_instagram_account_insights")
          .select("insight_date,followers_count,reach,views,profile_views,accounts_engaged,total_interactions,likes,comments,shares,saves,profile_links_taps")
          .eq("organization_id", context.organizationId)
          .order("insight_date");
        if (historyStart) query = query.gte("insight_date", historyStart);
        if (end) query = query.lte("insight_date", end);
        return query.limit(1000);
      })(),
    ]);
    if (connections.error) throw new Error(connections.error.message);
    if (media.error) throw new Error(media.error.message);
    if (previousMedia.error) throw new Error(previousMedia.error.message);

    const currentTotals = emptyTotals();
    const previousTotals = emptyTotals();
    const liveDaily = new Map<string, InstagramAccountMetrics>();
    let metricsSource: "account" | "content_fallback" = "account";
    if (start && end && connections.data?.length) {
      const live = await Promise.allSettled(connections.data.map(async (connection) => {
        const accessToken = decryptToken(connection.encrypted_access_token);
        const [current, previous, daily, exactDaily] = await Promise.all([
          getInstagramAccountTotals(connection.instagram_user_id, accessToken, start, end),
          compareStart && compareEnd
            ? getInstagramAccountTotals(connection.instagram_user_id, accessToken, compareStart, compareEnd)
            : Promise.resolve(emptyTotals()),
          getInstagramAccountDailyInsights(connection.instagram_user_id, accessToken, start, end),
          getInstagramAccountDailyExactMetrics(connection.instagram_user_id, accessToken, start, end),
        ]);
        const exactByDate = new Map(exactDaily.map((item) => [item.insight_date, item]));
        const mergedDaily = daily.map((item) => ({
          ...item,
          views: exactByDate.get(item.insight_date)?.views ?? item.views,
          follower_count: exactByDate.get(item.insight_date)?.follower_count ?? 0,
        }));
        for (const exact of exactDaily) {
          if (!mergedDaily.some((item) => item.insight_date === exact.insight_date)) {
            mergedDaily.push({ insight_date: exact.insight_date, ...emptyTotals(), views: exact.views, follower_count: exact.follower_count });
          }
        }
        return { current, previous, daily: mergedDaily };
      }));
      for (const result of live) {
        if (result.status !== "fulfilled") continue;
        addTotals(currentTotals, result.value.current);
        addTotals(previousTotals, result.value.previous);
        for (const insight of result.value.daily) {
          const row = liveDaily.get(insight.insight_date) ?? emptyTotals();
          addTotals(row, insight);
          liveDaily.set(insight.insight_date, row);
        }
      }
    }

    if (!currentTotals.reach && !currentTotals.views && !currentTotals.total_interactions) {
      metricsSource = "content_fallback";
      const aggregateMedia = (rows: typeof media.data, totals: InstagramAccountMetrics) => {
        for (const item of rows ?? []) {
          totals.reach += Number(item.reach || 0);
          totals.views += Math.max(Number(item.views || 0), Number(item.plays || 0));
          totals.total_interactions += Number(item.total_interactions || 0);
          totals.likes += Number(item.likes || 0);
          totals.comments += Number(item.comments || 0);
          totals.shares += Number(item.shares || 0);
          totals.saves += Number(item.saved || 0);
        }
      };
      aggregateMedia(media.data, currentTotals);
      aggregateMedia(previousMedia.data, previousTotals);
    }
    currentTotals.follower_count = (connections.data ?? []).reduce((sum, item) => sum + Number(item.followers_count || 0), 0);
    const sanitizedConnections = (connections.data ?? []).map(({ encrypted_access_token: _token, ...connection }) => connection);
    return NextResponse.json({
      connections: sanitizedConnections,
      media: media.data ?? [],
      previous_media: previousMedia.data ?? [],
      account_totals: currentTotals,
      previous_account_totals: previousTotals,
      daily_insights: liveDaily.size
        ? Array.from(liveDaily, ([insight_date, metrics]) => ({ insight_date, ...metrics }))
        : insights.error ? [] : (insights.data ?? []).map(({ followers_count, ...row }) => ({ ...row, follower_count: followers_count })),
      metrics_source: metricsSource,
      is_admin: context.isAdmin,
    });
  } catch (error) {
    const parsed = apiError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    if (!context.isAdmin) throw Object.assign(new Error("Apenas administradores podem desconectar contas"), { status: 403 });
    const body = await req.json().catch(() => ({})) as { connectionId?: string };
    if (!body.connectionId) throw Object.assign(new Error("Conta não informada"), { status: 400 });
    const { error } = await supabase
      .from("marketing_instagram_connections")
      .delete()
      .eq("id", body.connectionId)
      .eq("organization_id", context.organizationId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    const parsed = apiError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}
