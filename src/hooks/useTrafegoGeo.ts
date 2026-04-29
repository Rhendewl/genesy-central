"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { PortalGeoMetric } from "@/types";

export function useTrafegoGeo(
  platformAccountId?: string | null,
  since?: string | null,
  until?: string | null,
) {
  const [geo, setGeo] = useState<PortalGeoMetric[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchGeo = useCallback(async () => {
    if (!since || !until) return;
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();

      let campaignsQuery = supabase.from("campaigns").select("id");
      if (platformAccountId) {
        campaignsQuery = campaignsQuery.eq("platform_account_id", platformAccountId);
      }

      const { data: campaigns } = await campaignsQuery;
      const campaignIds = (campaigns ?? []).map((c: { id: string }) => c.id);

      if (campaignIds.length === 0) {
        setGeo([]);
        return;
      }

      const { data: geoMetrics } = await supabase
        .from("campaign_geo_metrics")
        .select("region, spend, leads, clicks, link_clicks, impressions, reach")
        .in("campaign_id", campaignIds)
        .gte("date", since)
        .lte("date", until)
        .not("region", "is", null)
        .neq("region", "");

      const geoMap = new Map<string, PortalGeoMetric>();

      for (const g of geoMetrics ?? []) {
        const key = (g.region as string).trim();
        if (!key) continue;
        const e = geoMap.get(key) ?? { region: key, spend: 0, leads: 0, clicks: 0, impressions: 0, reach: 0 };
        geoMap.set(key, {
          region:      key,
          spend:       e.spend       + (g.spend       ?? 0),
          leads:       e.leads       + (g.leads        ?? 0),
          clicks:      e.clicks      + (g.link_clicks  ?? g.clicks ?? 0),
          impressions: e.impressions + (g.impressions  ?? 0),
          reach:       e.reach       + (g.reach        ?? 0),
        });
      }

      const result = Array.from(geoMap.values())
        .sort((a, b) => b.leads - a.leads || b.clicks - a.clicks || b.reach - a.reach)
        .slice(0, 10);

      setGeo(result);
    } finally {
      setIsLoading(false);
    }
  }, [platformAccountId, since, until]);

  useEffect(() => { fetchGeo(); }, [fetchGeo]);

  return { geo, isLoading };
}
