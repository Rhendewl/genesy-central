import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConversationFlowExecutor } from "../flow-executor";

// ── WhatsApp provider mock ───────────────────────────────────────────────────

const sendMessageMock = vi.fn();
vi.mock("@/lib/conversations/providers", () => ({
  getWhatsAppProvider: () => ({ id: "qr_code", sendMessage: sendMessageMock }),
}));

// ── Fake Supabase client (thenable chain, ver trigger-service.test.ts) ──────

function makeChain(resolveValue: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: Record<string, any> = {};
  for (const m of ["select", "eq", "neq", "in", "or", "order", "gt", "lte", "limit", "update", "insert", "upsert"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(resolveValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolveValue);
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(resolveValue).then(resolve, reject);
  return chain;
}

function makeFakeDb(tables: Record<string, unknown>) {
  const chains: Record<string, ReturnType<typeof makeChain>[]> = {};
  const from = vi.fn((table: string) => {
    const chain = makeChain(tables[table] ?? { data: null, error: null });
    (chains[table] ??= []).push(chain);
    return chain;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: { from } as any, chains };
}

// .from(table) é chamado várias vezes ao longo de runJob() (select do job,
// update pra "processing", update final via finishJob/cancelJob/failJob) —
// cada chamada cria uma chain nova, então procura o .update() em todas elas
// em vez de assumir um índice fixo.
function allUpdateCalls(chains: ReturnType<typeof makeChain>[] | undefined) {
  return (chains ?? []).flatMap((c) => (c.update as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0]));
}

const baseJob = {
  id: "job-1",
  user_id: "user-1",
  flow_id: "flow-1",
  node_id: null,
  lead_id: "lead-1",
  thread_id: "thread-1",
  whatsapp_account_id: "account-1",
  owner_profile_id: "profile-1",
  status: "pending",
  scheduled_for: new Date(Date.now() - 1000).toISOString(),
  trigger_event_type: "form_submitted",
  trigger_snapshot: {},
  graph_snapshot: null,
  attempts: 0,
  max_attempts: 3,
};

const activeFlow = { id: "flow-1", user_id: "user-1", status: "active", trigger_config: {} };

beforeEach(() => {
  sendMessageMock.mockReset();
  sendMessageMock.mockResolvedValue({ ok: true, providerMessageId: "wamid-1" });
});

// ── Snapshot do grafo (Cenário 8) ─────────────────────────────────────────────

describe("runDueJobs() — graph_snapshot", () => {
  it("uses the frozen graph_snapshot instead of querying live nodes/edges when present", async () => {
    const job = {
      ...baseJob,
      graph_snapshot: {
        nodes: [
          { id: "n1", node_key: "trigger", node_type: "trigger", label: "Gatilho", config: {} },
          { id: "n2", node_key: "end", node_type: "end", label: "Fim", config: {} },
        ],
        edges: [{ source_key: "trigger", target_key: "end" }],
      },
    };

    const { db, chains } = makeFakeDb({
      conversation_flow_jobs: { data: [job], error: null },
      conversation_flow_runs: { data: { id: "run-1" }, error: null },
      conversation_flows: { data: activeFlow, error: null },
    });

    const executor = new ConversationFlowExecutor(db);
    const result = await executor.runDueJobs(5);

    expect(result.ok).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    // Grafo veio do snapshot — as tabelas ao vivo nunca deveriam ser consultadas.
    expect(chains.conversation_flow_nodes).toBeUndefined();
    expect(chains.conversation_flow_edges).toBeUndefined();

    expect(allUpdateCalls(chains.conversation_flow_jobs)).toContainEqual(
      expect.objectContaining({ status: "executed" }),
    );
  });
});

// ── Reavaliação defensiva (Cenário 3) ─────────────────────────────────────────

describe("runDueJobs() — cancelamento por agendamento já realizado", () => {
  it("cancels a pending send_message action instead of sending it when the lead already has an upcoming booking", async () => {
    const job = {
      ...baseJob,
      trigger_event_type: "form_submitted", // não é appointment_created — reavaliação se aplica
      graph_snapshot: {
        nodes: [
          { id: "n1", node_key: "trigger", node_type: "trigger", label: "Gatilho", config: {} },
          { id: "n2", node_key: "action1", node_type: "action", label: "Recuperação", config: { action_type: "send_message", message: "Ainda dá tempo de agendar!" } },
        ],
        edges: [{ source_key: "trigger", target_key: "action1" }],
      },
    };

    const { db, chains } = makeFakeDb({
      conversation_flow_jobs: { data: [job], error: null },
      conversation_flow_runs: { data: { id: "run-1" }, error: null },
      conversation_flows: { data: activeFlow, error: null },
      appointment_bookings: { data: { id: "booking-1" }, error: null }, // reunião futura encontrada
    });

    const executor = new ConversationFlowExecutor(db);
    const result = await executor.runDueJobs(5);

    expect(result.ok).toBe(true);
    expect(result.failed).toBe(0);
    expect(sendMessageMock).not.toHaveBeenCalled();
    // Cancelado antes de sequer buscar a thread/contato — nunca deveria enviar.
    expect(chains.conversation_threads).toBeUndefined();

    expect(allUpdateCalls(chains.conversation_flow_jobs)).toContainEqual(
      expect.objectContaining({ status: "cancelled" }),
    );
  });

  it("does NOT re-check bookings for a job whose own trigger is appointment_created (the booking IS the event being processed)", async () => {
    const job = {
      ...baseJob,
      trigger_event_type: "appointment_created",
      lead_id: null, // evita precisar mockar a tabela leads no resolvedor de variáveis
      graph_snapshot: {
        nodes: [
          { id: "n1", node_key: "trigger", node_type: "trigger", label: "Gatilho", config: {} },
          { id: "n2", node_key: "action1", node_type: "action", label: "Confirmação", config: { action_type: "send_message", message: "Reunião confirmada!" } },
        ],
        edges: [{ source_key: "trigger", target_key: "action1" }],
      },
    };

    const { db, chains } = makeFakeDb({
      conversation_flow_jobs: { data: [job], error: null },
      conversation_flow_runs: { data: { id: "run-1" }, error: null },
      conversation_flows: { data: activeFlow, error: null },
      conversation_threads: { data: { id: "thread-1", user_id: "user-1", whatsapp_account_id: "account-1", contact_id: "contact-1", owner_profile_id: "profile-1", lead_id: null }, error: null },
      conversation_contacts: { data: { id: "contact-1", phone: "+5511999990000" }, error: null },
      conversation_whatsapp_accounts: { data: { id: "account-1", provider: "qr_code" }, error: null },
      conversation_messages: { data: { id: "msg-1", status: "queued" }, error: null },
    });

    const executor = new ConversationFlowExecutor(db);
    await executor.runDueJobs(5);

    // Não deveria ter consultado appointment_bookings pra reavaliação — o
    // próprio evento sendo processado É o agendamento.
    expect(chains.appointment_bookings).toBeUndefined();
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
  });
});

// ── Trava de telefone ausente ─────────────────────────────────────────────────

describe("runDueJobs() — telefone ausente", () => {
  it("never calls the WhatsApp provider when the contact has no valid phone", async () => {
    const job = {
      ...baseJob,
      trigger_event_type: "appointment_created",
      lead_id: null,
      graph_snapshot: {
        nodes: [
          { id: "n1", node_key: "trigger", node_type: "trigger", label: "Gatilho", config: {} },
          { id: "n2", node_key: "action1", node_type: "action", label: "Confirmação", config: { action_type: "send_message", message: "Reunião confirmada!" } },
        ],
        edges: [{ source_key: "trigger", target_key: "action1" }],
      },
    };

    const { db } = makeFakeDb({
      conversation_flow_jobs: { data: [job], error: null },
      conversation_flow_runs: { data: { id: "run-1" }, error: null },
      conversation_flows: { data: activeFlow, error: null },
      conversation_threads: { data: { id: "thread-1", user_id: "user-1", whatsapp_account_id: "account-1", contact_id: "contact-1", owner_profile_id: "profile-1", lead_id: null }, error: null },
      conversation_contacts: { data: { id: "contact-1", phone: "" }, error: null },
      conversation_whatsapp_accounts: { data: { id: "account-1", provider: "qr_code" }, error: null },
      conversation_messages: { data: { id: "msg-1", status: "queued" }, error: null },
    });

    const executor = new ConversationFlowExecutor(db);
    await executor.runDueJobs(5);

    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});

// ── Fluxo pausado (Cenário 6) ─────────────────────────────────────────────────

describe("runDueJobs() — fluxo pausado", () => {
  it("cancels the job without executing any node when the flow is no longer active", async () => {
    const job = { ...baseJob, graph_snapshot: { nodes: [], edges: [] } };
    const { db, chains } = makeFakeDb({
      conversation_flow_jobs: { data: [job], error: null },
      conversation_flow_runs: { data: { id: "run-1" }, error: null },
      conversation_flows: { data: { ...activeFlow, status: "paused" }, error: null },
    });

    const executor = new ConversationFlowExecutor(db);
    await executor.runDueJobs(5);

    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(allUpdateCalls(chains.conversation_flow_jobs)).toContainEqual(
      expect.objectContaining({ status: "cancelled" }),
    );
  });
});
