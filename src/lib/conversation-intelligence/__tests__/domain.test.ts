// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import { createHmac } from "crypto";
import {
  contactHash,
  metrics,
  parseWebhook,
  validSignature,
  validateFindings,
  ObservedMessage,
} from "../domain";
afterEach(() => vi.unstubAllEnvs());
describe("Official webhook trust boundary", () => {
  it("accepts only a valid HMAC over the exact bytes", () => {
    const raw = '{"x":1}';
    const signature =
      "sha256=" + createHmac("sha256", "secret").update(raw).digest("hex");
    expect(validSignature(raw, signature, "secret")).toBe(true);
    expect(validSignature(raw + " ", signature, "secret")).toBe(false);
    expect(validSignature(raw, "sha256=ff", "secret")).toBe(false);
    expect(validSignature(raw, null, "secret")).toBe(false);
    expect(validSignature(raw, signature, "")).toBe(false);
  });
  it("normalizes contacts with a keyed hash and rejects invalid phones", () => {
    vi.stubEnv("WHATSAPP_CONTACT_HASH_KEY", "a".repeat(32));
    expect(contactHash("+55 (85) 99999-9999")).toBe(
      contactHash("5585999999999"),
    );
    expect(contactHash("5585999999999")).not.toContain("5585");
    expect(() => contactHash("abc")).toThrow();
    vi.stubEnv("WHATSAPP_CONTACT_HASH_KEY", "");
    expect(() => contactHash("5585999999999")).toThrow();
  });
  it("handles inbound and business app echoes but ignores history and media contents", () => {
    const value = {
      metadata: { phone_number_id: "123" },
      messages: [
        {
          id: "m1",
          from: "5585999999999",
          timestamp: "1793100000",
          type: "text",
          text: { body: "Olá" },
        },
      ],
    };
    const events = parseWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "w1",
          changes: [
            { field: "messages", value },
            { field: "history", value },
            {
              field: "smb_message_echoes",
              value: {
                ...value,
                message_echoes: [
                  {
                    id: "m2",
                    to: "5585999999999",
                    timestamp: "1793100001",
                    type: "image",
                    image: { url: "private" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(events).toHaveLength(2);
    expect(events[0].direction).toBe("inbound");
    expect(events[1]).toMatchObject({ direction: "outbound", body: null });
    expect(JSON.stringify(events)).not.toContain("private");
    expect(parseWebhook({ object: "instagram", entry: [] })).toEqual([]);
  });
  it("drops malformed message timestamps and contacts", () =>
    expect(
      parseWebhook({
        object: "whatsapp_business_account",
        entry: [
          {
            id: "1",
            changes: [
              {
                field: "messages",
                value: {
                  metadata: { phone_number_id: "1" },
                  messages: [{ id: "x", from: "bad", timestamp: "NaN" }],
                },
              },
            ],
          },
        ],
      }),
    ).toEqual([]));
});
describe("Observable metrics, no AI estimates", () => {
  const now = Date.parse("2026-10-27T12:00:00Z");
  const m = (
    id: string,
    c: string,
    d: "inbound" | "outbound",
    hours: number,
  ): ObservedMessage => ({
    id,
    consent_id: c,
    direction: d,
    sent_at: new Date(now - hours * 3600000).toISOString(),
  });
  it("leaves empty denominators and first response absent", () => {
    expect(metrics([], now)).toMatchObject({
      conversations: 0,
      responseRate: null,
      medianFirstResponseSeconds: null,
    });
  });
  it("sorts events, deduplicates retries and uses contact denominators", () => {
    const rows = [
      m("3", "a", "inbound", 72),
      m("1", "a", "inbound", 75),
      m("2", "a", "outbound", 74),
      m("4", "b", "outbound", 73),
      m("4", "b", "outbound", 73),
    ];
    expect(metrics(rows, now)).toMatchObject({
      conversations: 2,
      messages: 4,
      contacted: 2,
      replied: 1,
      responseRate: 0.5,
      medianFirstResponseSeconds: 3600,
      firstResponseSamples: 1,
      awaitingSdr: 1,
      awaitingLead: 1,
    });
  });
  it("only counts followups separated by 24h with no inbound between", () => {
    expect(
      metrics(
        [
          m("1", "a", "outbound", 100),
          m("2", "a", "outbound", 99),
          m("3", "a", "outbound", 74),
          m("4", "a", "inbound", 60),
          m("5", "a", "outbound", 30),
        ],
        now,
      ).followups,
    ).toBe(1);
  });
  it("does not confuse inbound before outreach with a lead reply or count future messages", () =>
    expect(
      metrics(
        [
          m("1", "a", "inbound", 4),
          m("2", "a", "outbound", 3),
          m("3", "b", "outbound", -1),
        ],
        now,
      ),
    ).toMatchObject({ responseRate: 0, conversations: 1 }));
});
describe("AI evidence validation", () => {
  it("rejects hallucinated evidence IDs, confidence and unstructured output", () => {
    expect(() =>
      validateFindings(
        [
          {
            category: "intent",
            label: "Agendar",
            confidence: 0.9,
            evidence_ids: ["invented"],
          },
        ],
        ["real"],
      ),
    ).toThrow();
    expect(() =>
      validateFindings(
        [
          {
            category: "intent",
            label: "Agendar",
            confidence: 2,
            evidence_ids: ["real"],
          },
        ],
        ["real"],
      ),
    ).toThrow();
    expect(() => validateFindings("bad", [])).toThrow();
  });
  it("allows abstention and evidenced interpretations", () => {
    expect(validateFindings([], [])).toEqual([]);
    expect(
      validateFindings(
        [
          {
            category: "objection",
            label: "Preço",
            confidence: 0.8,
            evidence_ids: ["real"],
          },
        ],
        ["real"],
      ),
    ).toHaveLength(1);
  });
});
