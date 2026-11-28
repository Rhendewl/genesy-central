import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "@/types";

const fixtures = vi.hoisted(() => ({
  move: vi.fn(),
  leads: [
    { id: "a", name: "Ana", contact: "+5583999999999", pipeline_id: "p", stage_id: "new", tags: [], entered_at: "2026-11-10", assigned_to: null },
    { id: "b", name: "Bruno", contact: "bruno@example.com", pipeline_id: "p", stage_id: "new", tags: [], entered_at: "2026-11-09", assigned_to: null },
  ].map((lead): Lead => ({
    user_id: "owner", email: null, source: "manual", origin_id: null, page_id: null,
    leadgen_id: null, campaign_name: null, ad_name: null, form_id: null, form_name: null,
    is_duplicate: false, kanban_column: "novo_lead", notes: null, integration_notes: null,
    deal_value: 0, created_at: "2026-11-10T10:00:00Z", updated_at: "2026-11-10T10:00:00Z",
    iq_score: null, ie_score: null, ...lead,
  })),
  member: { id: "member-a" },
}));
vi.mock("@/hooks/useLeads", () => ({ UNASSIGNED_STAGE_KEY: "__unassigned__", useLeads: () => ({ leads: fixtures.leads, totalLeads: 2, getLeadById: (id: string) => fixtures.leads.find(lead => lead.id === id), moveLead: fixtures.move }) }));
vi.mock("@/hooks/usePipelines", () => ({ usePipelines: () => ({ pipelines: [{ id: "p", name: "Pipeline", is_active: true, crm_stages: [{ id: "new", name: "Novo", color: "#38bdf8", is_active: true, order_index: 0 }, { id: "qualified", name: "Qualificado", color: "#38bdf8", is_active: true, order_index: 1 }, { id: "lost", name: "Perdido", color: "#f87171", is_active: true, order_index: 2, require_note: true }] }] }) }));
vi.mock("@/context/CurrentMemberContext", () => ({ useCurrentMember: () => ({ member: fixtures.member, isOwner: true }) }));
vi.mock("@/hooks/useUsers", () => ({ useUsers: () => ({ profiles: [] }) }));
vi.mock("@/hooks/useTags", () => ({ useTags: () => ({ tags: [] }) }));
vi.mock("@/hooks/useLeadOrigins", () => ({ useLeadOrigins: () => ({ origins: [] }) }));
vi.mock("@/hooks/useLeadActivityIndicators", () => ({ useLeadActivityIndicators: () => ({}) }));
vi.mock("../KanbanColumn", () => ({ KanbanColumn: () => createElement("div", null, "Coluna kanban") }));
vi.mock("../LeadModal", () => ({ LeadModal: ({ isOpen, lead }: { isOpen: boolean; lead: Lead }) => isOpen ? createElement("div", { "data-testid": "lead-detail" }, lead?.name) : null }));
vi.mock("../settings/CrmSettingsModal", () => ({ CrmSettingsModal: () => null }));
vi.mock("../PeriodFilter", () => ({ PeriodFilter: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { KanbanBoard } from "../KanbanBoard";

let host: HTMLDivElement, root: Root;
const button = (label: string) => Array.from(host.querySelectorAll("button")).find(item => item.textContent === label)!;
async function render() { await act(async () => root.render(createElement(KanbanBoard))); }
async function click(label: string) { await act(async () => button(label).click()); }
async function change(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const prototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
describe("CRM list and kanban", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    fixtures.leads.forEach(lead => { lead.stage_id = "new"; });
    localStorage.clear(); fixtures.member.id = "member-a"; fixtures.move.mockReset().mockResolvedValue({ ok: true, requireNote: false });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
  it("places WhatsApp immediately after stage, opens the existing lead detail, and validates phone contacts", async () => {
    await render(); await click("Lista");
    expect(Array.from(host.querySelectorAll("thead th")).slice(0, 3).map(item => item.textContent)).toEqual(["Lead", "Etapa", "WhatsApp"]);
    expect(host.querySelector('a[aria-label="Conversar no WhatsApp com Ana"]')?.getAttribute("href")).toBe("https://wa.me/5583999999999");
    expect(host.querySelector('a[aria-label="Conversar no WhatsApp com Bruno"]')).toBeNull();
    await click("Ana"); expect(host.querySelector('[data-testid="lead-detail"]')?.textContent).toBe("Ana");
  });
  it("preserves search when switching views and restores each user's view and columns", async () => {
    await render(); await click("Lista"); await click("Colunas");
    const origin = Array.from(host.querySelectorAll('#crm-list-columns label')).find(label => label.textContent === "IG")!.querySelector("input")!;
    await act(async () => origin.click());
    await change(host.querySelector('input[type="search"]')!, "Ana");
    await click("Kanban"); await click("Lista");
    expect(host.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(host.querySelector('input[type="search"]')?.getAttribute("value")).toBe("Ana");
    await act(async () => root.unmount()); root = createRoot(host); await render();
    expect(button("Lista").getAttribute("aria-pressed")).toBe("true");
    expect(Array.from(host.querySelectorAll("thead th")).some(th => th.textContent === "IG")).toBe(true);
    fixtures.member.id = "member-b"; await render();
    expect(button("Kanban").getAttribute("aria-pressed")).toBe("true");
  });
  it("defaults to pipeline stage order with origin and deal value visible", async () => {
    fixtures.leads[0].stage_id = "qualified";
    await render(); await click("Lista");
    expect(host.querySelector("tbody tr")?.textContent).toContain("Bruno");
    expect(host.querySelector('th[aria-sort="ascending"]')?.textContent).toBe("Etapa");
    const headings = Array.from(host.querySelectorAll("thead th")).map(th => th.textContent);
    expect(headings).toContain("Origem"); expect(headings).toContain("Valor do negócio");
  });
  it("updates existing preferences once while preserving later customizations", async () => {
    localStorage.setItem("crm-view:member-a", JSON.stringify({ view: "list", columns: ["assignee"], sort: "entered_at", direction: "desc" }));
    await render();
    expect(button("Lista").getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('th[aria-sort="ascending"]')?.textContent).toBe("Etapa");
    expect(Array.from(host.querySelectorAll("thead th")).map(th => th.textContent)).toEqual(["Lead", "Etapa", "WhatsApp", "Perfil", "Responsável", "Origem", "Valor do negócio"]);
    await click("Lead");
    await act(async () => root.unmount()); root = createRoot(host); await render();
    expect(host.querySelector('th[aria-sort="ascending"]')?.textContent).toBe("Lead");
  });
  it("sorts by name and moves through the shared movement service", async () => {
    await render(); await click("Lista"); await click("Lead"); await click("Lead");
    expect(host.querySelector("tbody tr")?.textContent).toContain("Bruno");
    await change(host.querySelector('select[aria-label="Etapa de Ana"]')!, "qualified");
    expect(fixtures.move).toHaveBeenCalledWith("a", "qualified");
  });
  it("requires a note before moving and retains the note when the server rejects the movement", async () => {
    fixtures.move.mockResolvedValue({ ok: false, error: "Sem permissão", requireNote: false });
    await render(); await click("Lista");
    await change(host.querySelector('select[aria-label="Etapa de Ana"]')!, "lost");
    expect(fixtures.move).not.toHaveBeenCalled(); expect(button("Confirmar").disabled).toBe(true);
    await change(host.querySelector("textarea")!, "Cliente desistiu"); await click("Confirmar");
    expect(fixtures.move).toHaveBeenCalledWith("a", "lost", "Cliente desistiu");
    expect(host.querySelector("textarea")?.value).toBe("Cliente desistiu");
  });
  it("shows an empty state instead of stale rows when the search has no matches", async () => {
    await render(); await click("Lista"); await change(host.querySelector('input[type="search"]')!, "Inexistente");
    expect(host.querySelector("table")).toBeNull();
    expect(host.textContent).toContain("Nenhum lead encontrado");
  });
  it("opens compact mobile actions without clearing search or the selected view", async () => {
    await render();
    const options = host.querySelector('#crm-kanban-options')!;
    const searchPanel = host.querySelector('#crm-kanban-search')!;
    expect(options.classList.contains('is-open')).toBe(false);
    expect(searchPanel.classList.contains('is-open')).toBe(false);
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Buscar leads"]')!.click());
    expect(searchPanel.classList.contains('is-open')).toBe(true);
    expect(document.activeElement).toBe(host.querySelector('input[type="search"]'));
    await change(host.querySelector('input[type="search"]')!, 'Ana');
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Filtros e opções do funil"]')!.click());
    expect(options.classList.contains('is-open')).toBe(true);
    await click('Lista');
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Ocultar filtros e opções"]')!.click());
    expect(options.classList.contains('is-open')).toBe(false);
    expect(button('Lista').getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('tbody tr')?.textContent).toContain('Ana');
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Ocultar busca de leads"]')!.click());
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Buscar leads"]')!.click());
    expect(host.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('Ana');
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Adicionar novo lead"]')!.click());
    expect(host.querySelector('[data-testid="lead-detail"]')).not.toBeNull();
  });

});
