import { afterEach, expect, it, vi } from "vitest";
import { fetchMetaLead } from "@/lib/meta-leads";
afterEach(() => vi.unstubAllGlobals());
it("preserves standard answers, multiple selections and custom responses", async () => {
  const fields = [{ name: "full_name", values: ["Ana Silva"] }, { name: "phone_number", values: ["85999999999"] }, { name: "email", values: ["ana@example.test"] }, { name: "state", values: ["CE"] }, { name: "interesses", values: ["Casa", "Apartamento"] }];
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ field_data: fields, campaign_name: "Campanha" })));
  vi.stubGlobal("fetch", fetcher); const lead = await fetchMetaLead("123", "secret");
  expect(lead.answers).toEqual(fields); expect(lead.custom_fields).toContainEqual({ label: "State", value: "CE" }); expect(lead.custom_fields).toContainEqual({ label: "Interesses", value: "Casa; Apartamento" }); expect(lead.full_name).toBe("Ana Silva");
  expect(fetcher.mock.calls[0][0]).not.toContain("secret"); expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer secret");
});
