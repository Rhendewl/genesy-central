import { describe, it, expect, vi } from "vitest";
import { renderTemplate, resolveFlowVariables } from "../variable-resolver";

// ── Fake Supabase client ─────────────────────────────────────────────────────

function makeChain(resolveValue: unknown) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of ["select", "eq", "in", "order"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue(resolveValue);
  return chain;
}

function makeFakeDb(tables: Record<string, { data: unknown; error: null }>) {
  return {
    from: vi.fn((table: string) => makeChain(tables[table] ?? { data: null, error: null })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// ── renderTemplate() ─────────────────────────────────────────────────────────

describe("renderTemplate()", () => {
  it("substitutes known variables", () => {
    const { text, missing } = renderTemplate(
      "Oi {{lead.primeiro_nome}}, sua reunião é dia {{reuniao.data}}.",
      { "lead.primeiro_nome": "Ana", "reuniao.data": "10/07/2026" },
    );
    expect(text).toBe("Oi Ana, sua reunião é dia 10/07/2026.");
    expect(missing).toEqual([]);
  });

  it("blanks out unknown variables instead of leaving the raw token", () => {
    const { text, missing } = renderTemplate("Olá {{lead.apelido}}!", {});
    expect(text).toBe("Olá !");
    expect(text).not.toContain("{{");
    expect(missing).toEqual(["lead.apelido"]);
  });

  it("blanks out known variables that resolved to an empty string", () => {
    const { text, missing } = renderTemplate("Email: {{lead.email}}", { "lead.email": "" });
    expect(text).toBe("Email: ");
    expect(missing).toEqual(["lead.email"]);
  });

  it("does not duplicate a missing variable name used more than once", () => {
    const { missing } = renderTemplate("{{x.y}} e {{x.y}} de novo", {});
    expect(missing).toEqual(["x.y"]);
  });

  it("leaves plain text without variables untouched", () => {
    const { text, missing } = renderTemplate("Mensagem sem variáveis.", {});
    expect(text).toBe("Mensagem sem variáveis.");
    expect(missing).toEqual([]);
  });
});

// ── resolveFlowVariables() ───────────────────────────────────────────────────

describe("resolveFlowVariables()", () => {
  it("falls back to the frozen snapshot when there is no leadId", async () => {
    const db = makeFakeDb({});
    const vars = await resolveFlowVariables(db, {
      leadId: null,
      ownerProfileId: null,
      snapshot: { lead_name: "João Silva", lead_email: "joao@ex.com", lead_phone: "+5511999990000" },
    });

    expect(vars["lead.nome"]).toBe("João Silva");
    expect(vars["lead.primeiro_nome"]).toBe("João");
    expect(vars["lead.email"]).toBe("joao@ex.com");
    expect(vars["lead.telefone"]).toBe("+5511999990000");
  });

  it("prefers a live lead row over the snapshot when leadId is set", async () => {
    const db = makeFakeDb({
      leads: {
        data: {
          name: "Maria Souza", contact: "+5511888880000", email: "maria@ex.com",
          pipeline_id: null, stage_id: null, assigned_to: null,
        },
        error: null,
      },
    });

    const vars = await resolveFlowVariables(db, {
      leadId: "lead-1",
      ownerProfileId: null,
      snapshot: { lead_name: "Nome Desatualizado do Snapshot" },
    });

    expect(vars["lead.nome"]).toBe("Maria Souza");
    expect(vars["lead.primeiro_nome"]).toBe("Maria");
    expect(vars["lead.telefone"]).toBe("+5511888880000");
  });

  it("resolves reuniao.* from a live booking when booking_id is present in the snapshot", async () => {
    const db = makeFakeDb({
      appointment_bookings: {
        data: { starts_at: "2026-07-10T09:00:00.000Z", meeting_url: "https://meet.example/abc", location: null },
        error: null,
      },
    });

    const vars = await resolveFlowVariables(db, {
      leadId: null,
      ownerProfileId: null,
      snapshot: { booking_id: "booking-1" },
    });

    expect(vars["reuniao.link"]).toBe("https://meet.example/abc");
    expect(vars["reuniao.data"]).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(vars["reuniao.hora"]).toMatch(/^\d{2}:\d{2}$/);
  });

  it("resolves pipeline.nome/etapa.nome/responsavel.nome from the live lead's pipeline/stage/assignee", async () => {
    const db = makeFakeDb({
      leads: {
        data: {
          name: "Lead X", contact: "123", email: null,
          pipeline_id: "pipe-1", stage_id: "stage-1", assigned_to: "profile-1",
        },
        error: null,
      },
      crm_pipelines: { data: { name: "Closer" }, error: null },
      crm_stages: { data: { name: "Reunião Agendada" }, error: null },
      user_profiles: { data: { full_name: "Ana Responsável" }, error: null },
    });

    const vars = await resolveFlowVariables(db, {
      leadId: "lead-1",
      ownerProfileId: "profile-fallback",
      snapshot: {},
    });

    expect(vars["pipeline.nome"]).toBe("Closer");
    expect(vars["etapa.nome"]).toBe("Reunião Agendada");
    expect(vars["responsavel.nome"]).toBe("Ana Responsável");
  });

  it("falls back to the job's owner_profile_id for responsavel.nome when the lead has no assignee", async () => {
    const db = makeFakeDb({
      leads: {
        data: { name: "Lead X", contact: "123", email: null, pipeline_id: null, stage_id: null, assigned_to: null },
        error: null,
      },
      user_profiles: { data: { full_name: "Dono da Conta" }, error: null },
    });

    const vars = await resolveFlowVariables(db, {
      leadId: "lead-1",
      ownerProfileId: "owner-profile-1",
      snapshot: {},
    });

    expect(vars["responsavel.nome"]).toBe("Dono da Conta");
  });
});
