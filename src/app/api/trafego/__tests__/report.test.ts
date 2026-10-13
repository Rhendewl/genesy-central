import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: createClient }));
import { GET } from "../report/route";

type Row = Record<string, unknown>;
const calls: Array<{ table: string; field: string; value: unknown }> = [];
let tables: Record<string, Row[]>;
let authenticated: boolean;

function query(table: string) {
  let rows = tables[table] ?? [];
  let single = false;
  const builder = {
    select: () => builder,
    eq: (field: string, value: unknown) => {
      calls.push({ table, field, value });
      rows = rows.filter((row) => row[field] === value);
      return builder;
    },
    in: (field: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[field])); return builder; },
    gte: () => builder,
    lte: () => builder,
    maybeSingle: () => { single = true; return builder; },
    then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve),
  };
  return builder;
}

function request(params: string) {
  return new NextRequest(`https://example.com/api/trafego/report?since=2026-09-01&until=2026-09-30&${params}`);
}

describe("independent traffic reports", () => {
  beforeEach(() => {
    authenticated = true;
    calls.length = 0;
    tables = {
      agency_clients: [{ id: "client", name: "Cliente" }],
      ad_platform_accounts: [
        { id: "unlinked", account_name: "Conta sem vínculo", client_id: null, user_id: "owner", platform: "meta", status: "connected" },
        { id: "linked", account_name: "Conta vinculada", client_id: "client", user_id: "owner", platform: "meta", status: "connected" },
        { id: "foreign", account_name: "Outra pessoa", client_id: null, user_id: "other", platform: "meta", status: "connected" },
        { id: "disconnected", account_name: "Desconectada", user_id: "owner", platform: "meta", status: "disconnected" },
      ],
      campaigns: [
        { id: "campaign", platform_account_id: "unlinked", name: "Campanha", status: "ativa" },
        { id: "linked-campaign", platform_account_id: "linked", name: "Campanha vinculada", status: "ativa" },
      ],
      campaign_metrics: [
        { campaign_id: "campaign", spend: 100, leads: 5, impressions: 1000, reach: 800, clicks: 50, conversions: 0 },
        { campaign_id: "linked-campaign", spend: 200, leads: 10, impressions: 2000, reach: 1600, clicks: 100, conversions: 0 },
      ],
    };
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: "owner" } : null } }) }, from: vi.fn(query) });
  });

  it("generates a report from an unlinked account without commercial settings", async () => {
    const response = await GET(request("platform_account_id=unlinked"));
    expect(response.status).toBe(200);
    const { report } = await response.json();
    expect(report.clientName).toBe("Conta sem vínculo");
    expect(report.metrics.spend).toBe(100);
    expect(calls.some((call) => call.table === "commercial_intelligence_settings")).toBe(false);
    expect(calls).toContainEqual({ table: "ad_platform_accounts", field: "user_id", value: "owner" });
  });

  it("uses an optional client as the report label without requiring a saved connection", async () => {
    const response = await GET(request("platform_account_id=unlinked&client_id=client"));
    expect(response.status).toBe(200);
    expect((await response.json()).report.clientName).toBe("Cliente");
    expect(calls).not.toContainEqual({ table: "ad_platform_accounts", field: "client_id", value: "client" });
  });

  it("loads campaign choices for an account without a client", async () => {
    const response = await GET(request("platform_account_id=unlinked&campaign_options=1"));
    expect(response.status).toBe(200);
    expect((await response.json()).campaigns.map((row: { id: string }) => row.id)).toEqual(["campaign"]);
  });

  it("preserves consolidation of accounts already linked to a client", async () => {
    const response = await GET(request("client_id=client"));
    expect(response.status).toBe(200);
    expect((await response.json()).report.metrics.spend).toBe(200);
  });

  it.each(["foreign", "disconnected", "missing"])("rejects unavailable account %s", async (id) => {
    expect((await GET(request(`platform_account_id=${id}`))).status).toBe(400);
  });

  it("rejects requests with no account or client", async () => {
    expect((await GET(request(""))).status).toBe(400);
  });

  it("requires authentication", async () => {
    authenticated = false;
    expect((await GET(request("platform_account_id=unlinked"))).status).toBe(401);
  });
});
