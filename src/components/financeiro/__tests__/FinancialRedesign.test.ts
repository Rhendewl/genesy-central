import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AgencyClient, ClientProfitability, Expense, Revenue } from "@/types";
const fixtures = vi.hoisted(() => ({ markPaid: vi.fn(), update: vi.fn(), create: vi.fn(), remove: vi.fn(), shares: vi.fn(), getShares: vi.fn() }));
const client = { id: "c", name: "Vila Real", company_type: "imobiliaria", monthly_fee: 1000, status: "ativo", payment_day: 10 } as AgencyClient;
const revenue = (id: string, amount: number, status: Revenue["status"], type: Revenue["type"] = "mensalidade") => ({ id, amount, status, type, description: `Receita ${id}`, date: "2026-11-05", payment_method: "pix", client_id: "c", client, is_recurring: true, paid_date: status === "pago" ? "2026-11-06" : null }) as Revenue;
const revenues = [revenue("paga", 1000, "pago"), revenue("pendente", 500, "pendente"), revenue("atrasada", 250, "atrasado", "setup"), revenue("cancelada", 800, "cancelado")];
const expenses = [{ id: "fixa", amount: 400, type: "fixa", category: "ferramentas", description: "Sistema", date: "2026-11-03" }, { id: "variavel", amount: 100, type: "variavel", category: "marketing", description: "Produção", date: "2026-11-05", auto_imported: true }] as Expense[];
vi.mock("@/hooks/useReceitas", () => ({ useReceitas: (from: string) => ({ revenues: from === "2026-11-01" ? revenues : [], isLoading: false, createRevenue: fixtures.create, updateRevenue: fixtures.update, deleteRevenue: fixtures.remove, markAsPaid: fixtures.markPaid }) }));
vi.mock("@/hooks/useDespesas", () => ({ useDespesas: (from: string) => ({ expenses: from === "2026-11-01" ? expenses : [], isLoading: false, createExpense: fixtures.create, updateExpense: fixtures.update, deleteExpense: fixtures.remove }) }));
vi.mock("@/hooks/useAgencyClients", () => ({ useAgencyClients: () => ({ clients: [client, { ...client, id: "old", name: "Cliente inativo", status: "inativo" }], assignableClients: [client], createClient: fixtures.create, updateClient: fixtures.update, deleteClient: fixtures.remove }) }));
vi.mock("@/hooks/useClientCostShares", () => ({ useClientCostShares: () => ({ saveShares: fixtures.shares, getByClientId: fixtures.getShares }) }));
vi.mock("@/hooks/useFinanceiroDashboard", () => ({ useFinanceiroDashboard: () => ({ data: { mrr: 1000, clientes_ativos: 1 }, clientProfitability: [{ client, mensalidade: 1000, custo_total: 400, custo_parceiros: 100, lucro: 600, margem: 60, tempo_contrato_meses: 3 }] as ClientProfitability[], isLoading: false, refetch: vi.fn() }) }));
vi.mock("@/hooks/useModalOpen", () => ({ useModalOpen: () => {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => children,
  BarChart: ({ data }: { data: unknown }) => createElement("div", { "data-testid": "daily-chart", "data-points": JSON.stringify(data) }),
  AreaChart: ({ data }: { data: unknown }) => createElement("div", { "data-testid": "cumulative-chart", "data-points": JSON.stringify(data) }),
  Bar: () => null, Area: () => null, CartesianGrid: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));
import { GestaoReceitas } from "../GestaoReceitas";
import { GestaoDespesas } from "../GestaoDespesas";
import { ClientesRentabilidade } from "../ClientesRentabilidade";
import { FinancialActivityChart } from "../FinancialActivityChart";
import { ManagementModuleNavigation } from "../ManagementModuleNavigation";
import { useFinancialPrivacyStore } from "@/store/financial-privacy";
let host: HTMLDivElement, root: Root;
async function click(selector: string) { await act(async () => document.querySelector<HTMLButtonElement>(selector)!.click()); }
async function change(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  await act(async () => { Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); Element.prototype.scrollIntoView = vi.fn();
  vi.clearAllMocks(); fixtures.markPaid.mockResolvedValue({ error: null }); fixtures.create.mockResolvedValue({ error: null }); fixtures.getShares.mockResolvedValue([]);
  useFinancialPrivacyStore.setState({ valuesHidden: false });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it("places revenue creation before the overview and opens a dialog outside the scrolling module", async () => {
  await act(async () => root.render(createElement(GestaoReceitas, { year: 2026, month: 11 })));
  expect(host.querySelector('.fin-workspace')?.firstElementChild?.querySelector('[aria-label="Nova Receita"]')).not.toBeNull();
  expect(host.querySelector('.fin-overview')?.textContent?.replace(/\s/g, '')).toContain('1.750');
  expect(host.querySelector(".fin-mobile-ledger")?.textContent).toContain("Recebido 06/11");
  await click('[aria-label="Nova Receita"]');
  const dialog = document.querySelector('[role="dialog"][aria-label="Nova Receita"]')!;
  expect(dialog).not.toBeNull(); expect(host.contains(dialog)).toBe(false);
});
it("uses status cards to filter revenues without losing the selection when filters collapse", async () => {
  await act(async () => root.render(createElement(GestaoReceitas, { year: 2026, month: 11 })));
  await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>('.fin-metric')).find(button => button.textContent?.startsWith('A receber'))!.click());
  expect(host.querySelector('.fin-mobile-ledger')?.textContent).toContain('Receita pendente');
  expect(host.querySelector('.fin-mobile-ledger')?.textContent).not.toContain('Receita paga');
  await click('.fin-filter-toggle'); await click('.fin-filter-toggle');
  expect(host.querySelector<HTMLSelectElement>('[aria-label="Filtrar status da receita"]')?.value).toBe('pendente');
  await click('[aria-label="Marcar Receita pendente como pago"]'); expect(fixtures.markPaid).toHaveBeenCalledWith('pendente', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
});
it("keeps zero-activity days and excludes cancelled revenues from the chart", async () => {
  await act(async () => root.render(createElement(GestaoReceitas, { year: 2026, month: 11 })));
  const points = JSON.parse(host.querySelector('[data-testid="daily-chart"]')!.getAttribute('data-points')!);
  expect(points).toHaveLength(30); expect(points[0].total).toBe(0); expect(points[4].total).toBe(1750);
});
it("filters fixed expenses and keeps imported entries protected from manual editing", async () => {
  await act(async () => root.render(createElement(GestaoDespesas, { year: 2026, month: 11 })));
  expect(host.querySelector('.fin-overview')?.textContent).toContain('500');
  expect(document.querySelector('[aria-label="Editar despesa Produção"]')).toBeNull();
  await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>('.fin-metric')).find(button => button.textContent?.startsWith('Custos fixos'))!.click());
  expect(host.querySelector('.fin-mobile-ledger')?.textContent).toContain('Sistema'); expect(host.querySelector('.fin-mobile-ledger')?.textContent).not.toContain('Produção');
  await click('[aria-label="Nova Despesa"]'); expect(document.querySelector('[role="dialog"][aria-label="Nova Despesa"]')).not.toBeNull();
});
it("offers client cards, table, search and the existing edit dialog", async () => {
  await act(async () => root.render(createElement(ClientesRentabilidade, { year: 2026, month: 11 })));
  expect(host.querySelector('.fin-client-card')?.textContent).toContain('Vila Real');
  expect(host.querySelector('.fin-client-card')?.textContent).toContain('600');
  await click('[aria-label="Tabela de clientes"]'); expect(host.querySelector('table')).not.toBeNull();
  await change('[aria-label="Buscar clientes"]', 'inexistente'); expect(host.querySelector('tbody tr')).toBeNull();
  await change('[aria-label="Buscar clientes"]', ''); await click('[aria-label="Cards de clientes"]');
  await click('[aria-label="Ver cliente Vila Real"]'); expect(document.querySelector('[role="dialog"][aria-label="Editar Cliente"]')).not.toBeNull();
});
it("switches daily and cumulative charts and hides the series with monetary privacy enabled", async () => {
  await act(async () => root.render(createElement(FinancialActivityChart, { title: 'Teste', description: '', data: [{ date: '01', total: 100 }, { date: '02', total: 0 }, { date: '03', total: 50 }] })));
  await click('[aria-label="Exibição: Teste"] button:nth-child(2)');
  expect(JSON.parse(host.querySelector('[data-testid="cumulative-chart"]')!.getAttribute('data-points')!).map((p: { cumulative: number }) => p.cumulative)).toEqual([100, 100, 150]);
  await act(async () => useFinancialPrivacyStore.setState({ valuesHidden: true }));
  expect(host.querySelector('[data-testid="cumulative-chart"]')).toBeNull(); expect(host.textContent).toContain('Valores ocultos');
});
it("keeps horizontal tabs and allows changing the reference month directly", async () => {
  const onPeriodChange = vi.fn(), onChange = vi.fn();
  await act(async () => root.render(createElement(ManagementModuleNavigation, { label: 'Módulo', tabs: [{ id: 'receitas', label: 'Receitas', icon: null }], value: 'receitas', onChange, year: 2026, month: 11, onPeriodChange })));
  expect(host.querySelector('[aria-current="page"]')?.textContent).toBe('Receitas');
  await change('[aria-label="Mês de referência"]', '2026-10'); expect(onPeriodChange).toHaveBeenCalledWith(2026, 10);
});
