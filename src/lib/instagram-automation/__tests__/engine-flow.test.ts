import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "./helpers/fake-supabase";

const mocks = vi.hoisted(() => ({
  reply: vi.fn(async () => ({ id: "public-reply" })),
  sendPayload: vi.fn(async () => ({ message_id: "mid-out" })),
  sendLegacy: vi.fn(async () => ({ message_id: "mid-legacy" })),
  createLead: vi.fn(async () => ({ ok: true, leadId: "lead-1" })),
  senderAction: vi.fn(async () => ({})),
  profile: vi.fn(async () => ({ name: "Maria Eduarda", username: "duda" })),
}));

vi.mock("@/lib/crypto", () => ({ decryptToken: () => "token" }));
vi.mock("@/lib/instagram-api", () => ({
  replyToInstagramComment: mocks.reply,
  sendInstagramMessage: mocks.sendLegacy,
  sendInstagramMessagePayload: mocks.sendPayload,
  sendInstagramSenderAction: mocks.senderAction,
  getInstagramUserProfile: mocks.profile,
}));
vi.mock("@/lib/crm/lead-service", () => ({
  LeadService: class { createLead = mocks.createLead; },
}));

import { driveInstagramRuns, ingestInstagramWebhook, runDueInstagramAutomationJobs } from "../engine";
import type { AutomationFlow, FlowNode } from "../flow";

type Db = Parameters<typeof runDueInstagramAutomationJobs>[0];
const ACCOUNT = "ig-business";
const ORG = "org-1";
const JOBS = "marketing_instagram_automation_jobs";
const RUNS = "marketing_instagram_automation_runs";

function graph(nodes: FlowNode[], edges: Array<[string, string, string]>): AutomationFlow {
  return {
    version: 1,
    nodes: [{ id: "trigger", type: "trigger", position: { x: 0, y: 0 }, data: {} }, ...nodes],
    edges: edges.map(([source, sourceHandle, target], index) => ({ id: `e${index}`, source, sourceHandle, target })),
  };
}
const msg = (id: string, text: string, buttons: Array<{ id: string; label: string; kind: "url" | "reply"; url?: string }> = [], timeoutMinutes: number | null = null): FlowNode =>
  ({ id, type: "message", position: { x: 0, y: 0 }, data: { text, buttons, timeoutMinutes } });

const QUALIFY = graph([
  msg("m1", "Quer a tabela?", [{ id: "yes", label: "Quero", kind: "reply" }], 600),
  msg("m2", "Aqui está a tabela"),
  { id: "w", type: "wait_reply", position: { x: 0, y: 0 }, data: { timeoutMinutes: 120 } },
  { id: "c", type: "condition", position: { x: 0, y: 0 }, data: { kind: "reply_contains", value: "1 mi" } },
  { id: "crm", type: "action", position: { x: 0, y: 0 }, data: { kind: "crm", crm: { pipelineId: "p1", stageId: "s1", originId: null, assignedTo: null, dealValue: 0 } } },
  { id: "tag", type: "action", position: { x: 0, y: 0 }, data: { kind: "add_tag", tag: "Frio" } },
  msg("m3", "Ficou alguma dúvida?"),
], [
  ["trigger", "next", "m1"], ["m1", "button:yes", "m2"], ["m2", "next", "w"],
  ["w", "reply", "c"], ["c", "yes", "crm"], ["c", "no", "tag"], ["w", "timeout", "m3"],
]);

function setup(flow: AutomationFlow | null, overrides: Record<string, unknown> = {}) {
  const fake = new FakeSupabase();
  const connection = fake.seed("marketing_instagram_connections", { organization_id: ORG, instagram_user_id: ACCOUNT, status: "connected", encrypted_access_token: "enc" });
  const automation = fake.seed("marketing_instagram_automations", {
    organization_id: ORG, connection_id: connection.id, name: "Fluxo", status: "active",
    trigger_type: "comment", match_type: "contains", keywords: ["quero"], public_reply_text: "Te mandei no direct!",
    steps: [], flow, crm_enabled: false, crm_pipeline_id: null, crm_stage_id: null, crm_origin_id: null, crm_assigned_to: null, crm_deal_value: 0,
    ...overrides,
  });
  return { fake, db: fake as unknown as Db, automation };
}

const comment = (text: string, id = "c1") => ({ object: "instagram", entry: [{
  id: ACCOUNT, time: Math.floor(Date.now() / 1000),
  changes: [{ field: "comments", value: { id, text, from: { id: "person-1", username: "maria" }, media: { id: "media-1" } } }],
}] });
const dm = (text: string, mid: string, extra: Record<string, unknown> = {}) => ({ object: "instagram", entry: [{
  id: ACCOUNT, messaging: [{ sender: { id: "person-1" }, recipient: { id: ACCOUNT }, timestamp: Date.now(), message: { mid, text, ...extra } }],
}] });
const tap = (payload: string, mid: string) => ({ object: "instagram", entry: [{
  id: ACCOUNT, messaging: [{ sender: { id: "person-1" }, recipient: { id: ACCOUNT }, timestamp: Date.now(), postback: { mid, title: "Quero", payload } }],
}] });

async function drain(db: Db) {
  for (let round = 0; round < 20; round += 1) {
    const result = await runDueInstagramAutomationJobs(db, 50);
    if (!result.processed) return;
  }
}
function expire(fake: FakeSupabase, actionType?: string) {
  for (const job of fake.rows(JOBS)) {
    if (job.status === "pending" && (!actionType || job.action_type === actionType)) job.scheduled_for = new Date(Date.now() - 1000).toISOString();
  }
}
const run = (fake: FakeSupabase) => fake.rows(RUNS)[0];
const sentTexts = () => mocks.sendPayload.mock.calls.map((call: any[]) => call[2].text ?? call[2].attachment?.payload?.text);

describe("Instagram flow engine", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs a comment flow: public + private reply, button tap, reply branch and CRM", async () => {
    const { fake, db } = setup(QUALIFY);
    expect(await ingestInstagramWebhook(db, comment("QUERO a tabela"))).toMatchObject({ matched: 1 });
    await drain(db);
    expect(mocks.reply).toHaveBeenCalledWith("c1", "Te mandei no direct!", "token");
    const [, recipient, body] = mocks.sendPayload.mock.calls[0] as any[];
    expect(recipient).toEqual({ comment_id: "c1" });
    const payload = body.attachment.payload.buttons[0].payload as string;
    expect(payload).toBe(`igflow:${run(fake).id}:m1:yes`);
    expect(run(fake)).toMatchObject({ status: "waiting", waiting_for: "button", current_node_id: "m1" });

    expect(await ingestInstagramWebhook(db, tap(payload, "tap-1"))).toMatchObject({ matched: 1 });
    await drain(db);
    expect((mocks.sendPayload.mock.calls[1] as any[])[1]).toEqual({ id: "person-1" });
    expect(sentTexts()).toEqual(["Quer a tabela?", "Aqui está a tabela"]);
    expect(run(fake)).toMatchObject({ status: "waiting", waiting_for: "reply", current_node_id: "w" });
    expect(fake.rows(JOBS).find(job => job.action_type === "flow_timeout" && job.payload.nodeId === "m1")?.status).toBe("skipped");

    await ingestInstagramWebhook(db, dm("Até 1 mi, por favor", "m-reply"));
    await drain(db);
    expect(mocks.createLead).toHaveBeenCalledTimes(1);
    // The name comes from the Instagram profile (User Profile API).
    expect((mocks.createLead.mock.calls[0] as any[])[0]).toMatchObject({ stageId: "s1", name: "Maria Eduarda", contact: "instagram:@maria" });
    expect(run(fake)).toMatchObject({ status: "completed", waiting_for: null });
    expect(run(fake).variables.lastReply).toBe("Até 1 mi, por favor");
    const counted = fake.rows(JOBS).filter(job => job.payload?.counted).map(job => job.payload.nodeId);
    expect(counted).toEqual(["trigger", "m1", "m2", "crm"]);
  });

  it("follows the timeout branch when the contact does not answer", async () => {
    const { fake, db } = setup(QUALIFY);
    await ingestInstagramWebhook(db, comment("quero"));
    await drain(db);
    const payload = (mocks.sendPayload.mock.calls[0] as any[])[2].attachment.payload.buttons[0].payload;
    await ingestInstagramWebhook(db, tap(payload, "tap-1"));
    await drain(db);
    expire(fake, "flow_timeout");
    await drain(db);
    expect(sentTexts()).toEqual(["Quer a tabela?", "Aqui está a tabela", "Ficou alguma dúvida?"]);
    expect(run(fake).status).toBe("completed");
  });

  it("tags the contact on the negative branch", async () => {
    const { fake, db } = setup(QUALIFY);
    await ingestInstagramWebhook(db, comment("quero"));
    await drain(db);
    const payload = (mocks.sendPayload.mock.calls[0] as any[])[2].attachment.payload.buttons[0].payload;
    await ingestInstagramWebhook(db, tap(payload, "tap-1"));
    await drain(db);
    await ingestInstagramWebhook(db, dm("só estou olhando", "m-reply"));
    await drain(db);
    expect(mocks.createLead).toHaveBeenCalledTimes(0);
    expect(fake.rows("marketing_instagram_contacts")[0].tags).toEqual(["Frio"]);
  });

  it("does not resume a button wait with free text and ignores stale taps", async () => {
    const { fake, db } = setup(QUALIFY);
    await ingestInstagramWebhook(db, comment("quero"));
    await drain(db);
    const payload = (mocks.sendPayload.mock.calls[0] as any[])[2].attachment.payload.buttons[0].payload;
    expect(await ingestInstagramWebhook(db, dm("oi", "m-free"))).toMatchObject({ matched: 0 });
    expect(run(fake).status).toBe("waiting");
    await ingestInstagramWebhook(db, tap(payload, "tap-1"));
    expect(await ingestInstagramWebhook(db, tap(payload, "tap-2"))).toMatchObject({ matched: 0 });
    expect(fake.rows(RUNS)).toHaveLength(1);
  });

  it("skips a follow-up that falls outside the 24h window", async () => {
    const flow = graph([msg("a", "Oi"), { id: "d", type: "delay", position: { x: 0, y: 0 }, data: { minutes: 30 } as never }, msg("b", "Ainda por aí?")],
      [["trigger", "next", "a"], ["a", "next", "d"], ["d", "next", "b"]]);
    const { fake, db } = setup(flow, { trigger_type: "message", public_reply_text: null });
    await ingestInstagramWebhook(db, dm("quero saber", "m1"));
    await drain(db);
    fake.rows("marketing_instagram_contacts")[0].last_message_at = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expire(fake);
    await drain(db);
    expect(sentTexts()).toEqual(["Oi"]);
    expect(fake.rows(JOBS).find(job => job.payload.nodeId === "b")).toMatchObject({ status: "skipped", last_error: "Janela de mensagens permitida pela Meta encerrada" });
    expect(run(fake).status).toBe("completed");
  });

  it("keeps the 7-day window for conversations started from an ad", async () => {
    const flow = graph([msg("a", "Oi"), { id: "d", type: "delay", position: { x: 0, y: 0 }, data: { minutes: 2880 } as never }, msg("b", "Lembra de mim?")],
      [["trigger", "next", "a"], ["a", "next", "d"], ["d", "next", "b"]]);
    const { fake, db } = setup(flow, { trigger_type: "message", public_reply_text: null });
    await ingestInstagramWebhook(db, dm("quero saber", "m1", { referral: { source: "ADS", ad_id: "ad-9" } }));
    await drain(db);
    fake.rows("marketing_instagram_contacts")[0].last_message_at = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expire(fake);
    await drain(db);
    expect(sentTexts()).toEqual(["Oi", "Lembra de mim?"]);
  });

  it("stores opt-out on the contact and stops matching afterwards", async () => {
    const { fake, db } = setup(graph([msg("a", "Oi")], [["trigger", "next", "a"]]), { trigger_type: "message", public_reply_text: null });
    await ingestInstagramWebhook(db, dm("Parar", "m1"));
    expect(fake.rows("marketing_instagram_contacts")[0].opted_out_at).toBeTruthy();
    expect(await ingestInstagramWebhook(db, dm("quero", "m2"))).toMatchObject({ matched: 0 });
    expect(fake.rows(RUNS)).toHaveLength(0);
  });

  it("still runs automations saved with the linear editor", async () => {
    const { fake, db } = setup(null, {
      trigger_type: "message", public_reply_text: null,
      steps: [{ type: "message", text: "Primeira", delayMinutes: 0 }, { type: "message", text: "Segunda", delayMinutes: 5 }],
      crm_enabled: true, crm_pipeline_id: "p1", crm_stage_id: "s1",
    });
    await ingestInstagramWebhook(db, dm("quero", "m1"));
    await drain(db);
    expect(sentTexts()).toEqual(["Primeira"]);
    expire(fake);
    await drain(db);
    expect(sentTexts()).toEqual(["Primeira", "Segunda"]);
    expect(mocks.createLead).toHaveBeenCalledTimes(1);
    expect(run(fake).status).toBe("completed");
  });

  it("starts right after the webhook, shows typing during short delays and personalizes by name", async () => {
    const flow = graph([
      msg("a", "Oi {primeiro_nome}!"),
      { id: "d", type: "delay", position: { x: 0, y: 0 }, data: { seconds: 1, typing: true } },
      msg("b", "Tudo certo por aí?"),
    ], [["trigger", "next", "a"], ["a", "next", "d"], ["d", "next", "b"]]);
    const { db } = setup(flow, { trigger_type: "message", public_reply_text: null });
    const result = await ingestInstagramWebhook(db, dm("quero", "m1"));
    const started = Date.now();
    await driveInstagramRuns(db, result.runIds);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(sentTexts()).toEqual(["Oi Maria!", "Tudo certo por aí?"]);
    expect(mocks.senderAction).toHaveBeenCalledWith(ACCOUNT, "person-1", "typing_on", "token");
  });

  it("collects a WhatsApp answer, branches on invalid input and fills the CRM lead", async () => {
    const flow = graph([
      msg("ask", "Qual seu WhatsApp?"),
      { id: "w", type: "wait_reply", position: { x: 0, y: 0 }, data: { timeoutMinutes: 10, saveAs: "phone" } },
      msg("again", "Manda só os números, por favor"),
      { id: "w2", type: "wait_reply", position: { x: 0, y: 0 }, data: { timeoutMinutes: 10, saveAs: "phone" } },
      { id: "crm", type: "action", position: { x: 0, y: 0 }, data: { kind: "crm", crm: { pipelineId: "p1", stageId: "s1", originId: null, assignedTo: null, dealValue: 0 } } },
      msg("ok", "Anotado: {whatsapp}"),
    ], [
      ["trigger", "next", "ask"], ["ask", "next", "w"], ["w", "invalid", "again"], ["again", "next", "w2"],
      ["w", "reply", "crm"], ["w2", "reply", "crm"], ["crm", "next", "ok"],
    ]);
    const { fake, db } = setup(flow, { trigger_type: "message", public_reply_text: null });
    await ingestInstagramWebhook(db, dm("quero", "m1"));
    await drain(db);
    await ingestInstagramWebhook(db, dm("não sei", "m2"));
    await drain(db);
    expect(sentTexts()).toEqual(["Qual seu WhatsApp?", "Manda só os números, por favor"]);
    await ingestInstagramWebhook(db, dm("85 99999-0000", "m3"));
    await drain(db);
    expect(sentTexts()[2]).toBe("Anotado: 5585999990000");
    expect((mocks.createLead.mock.calls[0] as any[])[0]).toMatchObject({ contact: "5585999990000", name: "Maria Eduarda" });
    expect(fake.rows("marketing_instagram_contacts")[0].fields).toEqual({ whatsapp: "5585999990000" });
    expect(run(fake).status).toBe("completed");
  });
});
