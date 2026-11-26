import { describe, expect, it } from "vitest";
import {
  assertInstagramCrmAllowed, assertMarketingAccess, canConnectInstagramAccounts, canManageInstagramConnection,
  scopeByConnectionIds, visibleInstagramConnectionIds,
} from "@/lib/marketing/instagram-access";
import { INSTAGRAM_OWN_ACCOUNTS_PERMISSION } from "@/lib/module-permissions";
import type { SupabaseClient } from "@supabase/supabase-js";

const friend = {
  isAdmin: false,
  organizationId: "org",
  user: { id: "friend" },
  permissions: ["marketing", "marketing.instagram", "marketing.instagram.automations", INSTAGRAM_OWN_ACCOUNTS_PERMISSION],
};
const viewer = { isAdmin: false, organizationId: "org", user: { id: "viewer" }, permissions: ["marketing"] };
const admin = { isAdmin: true, organizationId: "org", user: { id: "owner" }, permissions: [] };

describe("instagram access", () => {
  it("lets own-account members manage only their accounts", () => {
    expect(canConnectInstagramAccounts(friend)).toBe(true);
    expect(canManageInstagramConnection(friend, { connected_by: "friend" })).toBe(true);
    expect(canManageInstagramConnection(friend, { connected_by: "owner" })).toBe(false);
    expect(canManageInstagramConnection(friend, { connected_by: null })).toBe(false);
  });

  it("keeps regular marketing members read-only and admins unrestricted", () => {
    expect(canConnectInstagramAccounts(viewer)).toBe(false);
    expect(canManageInstagramConnection(viewer, { connected_by: "viewer" })).toBe(false);
    expect(canManageInstagramConnection(admin, { connected_by: "friend" })).toBe(true);
  });

  it("blocks tabs that were not granted", () => {
    expect(() => assertMarketingAccess(friend, "marketing.instagram.automations")).not.toThrow();
    expect(() => assertMarketingAccess(friend, "marketing.instagram.reports")).toThrow(/não inclui/);
    expect(() => assertMarketingAccess(friend, "marketing.concorrentes")).toThrow(/não inclui/);
    expect(() => assertMarketingAccess(admin, "marketing.concorrentes")).not.toThrow();
  });

  it("refuses CRM actions for members without the CRM module", () => {
    expect(() => assertInstagramCrmAllowed(friend, { crmEnabled: true, flow: null })).toThrow(/CRM/);
    const flow = { nodes: [{ id: "c", type: "action", position: { x: 0, y: 0 }, data: { kind: "crm" } }] } as never;
    expect(() => assertInstagramCrmAllowed(friend, { crmEnabled: false, flow })).toThrow(/CRM/);
    expect(() => assertInstagramCrmAllowed(friend, { crmEnabled: false, flow: null })).not.toThrow();
    expect(() => assertInstagramCrmAllowed({ ...friend, permissions: [...friend.permissions, "crm"] }, { crmEnabled: true, flow: null })).not.toThrow();
  });

  it("filters connection ids only for own-account members", async () => {
    const calls: Array<[string, string]> = [];
    const query = {
      select: () => query,
      eq: (column: string, value: string) => { calls.push([column, value]); return query; },
      then: (resolve: (value: unknown) => void) => resolve({ data: [{ id: "c1" }], error: null }),
    };
    const supabase = { from: () => query } as unknown as SupabaseClient;
    expect(await visibleInstagramConnectionIds(supabase, viewer)).toBeNull();
    expect(await visibleInstagramConnectionIds(supabase, friend)).toEqual(["c1"]);
    expect(calls).toContainEqual(["connected_by", "friend"]);

    const seen: string[][] = [];
    const builder = { in: (_column: string, values: string[]) => { seen.push(values); return builder; } };
    scopeByConnectionIds(builder, null);
    scopeByConnectionIds(builder, []);
    expect(seen).toEqual([["00000000-0000-0000-0000-000000000000"]]);
  });
});
