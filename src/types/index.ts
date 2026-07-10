// ─────────────────────────────────────────────────────────────────────────────
// Lancaster SaaS — Global TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
}

// ── Tags ─────────────────────────────────────────────────────────────────────

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export type NewTag = Pick<Tag, "name" | "color">;

// ── CRM / Leads ───────────────────────────────────────────────────────────────

export type KanbanColumn =
  | "novo_lead"
  | "abordados"
  | "em_andamento"
  | "formulario_aplicado"
  | "reuniao_agendada"
  | "reuniao_realizada"
  | "no_show"
  | "venda_realizada";

export const KANBAN_COLUMNS: {
  id: KanbanColumn;
  label: string;
  color: string;
}[] = [
  { id: "novo_lead",           label: "Novo Lead",          color: "#6366f1" },
  { id: "abordados",           label: "Abordados",          color: "#7d99ad" },
  { id: "em_andamento",        label: "Em Andamento",       color: "#5b87a0" },
  { id: "formulario_aplicado", label: "Formulário Aplicado", color: "#4a7a95" },
  { id: "reuniao_agendada",    label: "Reunião Agendada",   color: "#3d6d88" },
  { id: "reuniao_realizada",   label: "Reunião Realizada",  color: "#22c55e" },
  { id: "no_show",             label: "No-Show",            color: "#f59e0b" },
  { id: "venda_realizada",     label: "Venda Realizada",    color: "#10b981" },
];

export interface Lead {
  id: string;
  user_id: string;
  name: string;
  contact: string;
  email: string | null;
  source: string;                // 'manual' | 'meta_lead_ads'
  page_id: string | null;
  leadgen_id: string | null;
  campaign_name: string | null;
  ad_name: string | null;
  form_id: string | null;
  form_name: string | null;
  is_duplicate: boolean;
  kanban_column: KanbanColumn;
  pipeline_id: string | null;
  stage_id: string | null;
  assigned_to: string | null;     // user_profiles.id do responsável (SDR)
  tags: string[]; // array of tag ids
  notes: string | null; // observações manuais — CRM e módulo Conversas
  // Dados automáticos de integração (resposta de formulário, agendamento de
  // calendário) — nunca escrito pelo CRM/Conversas, só por essas rotas.
  integration_notes: string | null;
  deal_value: number;
  entered_at: string;
  created_at: string;
  updated_at: string;
  // IQ (Inteligência de Qualificação) — calculado uma vez a partir das
  // respostas do formulário, nunca recalculado automaticamente depois.
  // null = formulário não tinha nenhuma pergunta ponderada (não aplicável).
  iq_score: number | null;
  // IE (Índice de Evolução) — recalculado automaticamente a cada mudança de
  // etapa na Pipeline. null = lead ainda sem etapa atribuída.
  ie_score: number | null;
}

export type NewLead = Pick<Lead, "name" | "contact" | "kanban_column" | "tags" | "notes" | "deal_value" | "entered_at"> & {
  stage_id?: string | null;
  pipeline_id?: string | null;
  assigned_to?: string | null;
  ie_score?: number | null;
  integration_notes?: string | null;
};
export type UpdateLead = Partial<Pick<Lead, "name" | "contact" | "kanban_column" | "tags" | "notes" | "integration_notes" | "deal_value" | "entered_at" | "assigned_to" | "iq_score">>;

export interface LeadMovement {
  id: string;
  lead_id: string;
  from_column: KanbanColumn;
  to_column: KanbanColumn;
  moved_at: string;
}

// ── Financeiro ────────────────────────────────────────────────────────────────

export type LancamentoType = "receita" | "despesa";

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  type: LancamentoType | "ambos";
  created_at: string;
}

export type NewCategory = Pick<Category, "name" | "color" | "type">;

export interface Lancamento {
  id: string;
  user_id: string;
  type: LancamentoType;
  description: string;
  amount: number;
  date: string;
  category_id: string | null;
  notes: string | null;
  source: LancamentoSource | null;
  created_at: string;
  // joined
  category?: Category;
}

export type LancamentoSource =
  | "manual"
  | "trafego_investimento"
  | "trafego_venda"
  | "crm_venda";

export type NewLancamento = Pick<
  Lancamento,
  "type" | "description" | "amount" | "date" | "category_id" | "notes" | "source"
>;

export interface ClienteRecorrente {
  id: string;
  user_id: string;
  name: string;
  monthly_value: number;
  start_date: string;
  status: "ativo" | "inativo";
  created_at: string;
}

export type NewClienteRecorrente = Pick<
  ClienteRecorrente,
  "name" | "monthly_value" | "start_date" | "status"
>;

// ── Tráfego Pago ──────────────────────────────────────────────────────────────

export interface InvestimentoDiario {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  amount_invested: number;
  followers_gained: number;
  reach: number;
  messages: number;
  meetings: number;
  amount_sold: number; // renamed from 'sold' — monetary value
  recurring_value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type NewInvestimentoDiario = Pick<
  InvestimentoDiario,
  | "date"
  | "amount_invested"
  | "followers_gained"
  | "reach"
  | "messages"
  | "meetings"
  | "amount_sold"
  | "recurring_value"
  | "notes"
>;

// ── KPIs ──────────────────────────────────────────────────────────────────────

export interface TrafegoKPIs {
  totalInvested: number;
  totalSold: number;
  roi: number; // percentage
  costPerLead: number;
  costPerMeeting: number;
  costPerSale: number;
  followersGained: number;
  totalReach: number;
}

export interface CrmKPIs {
  abordadosToReuniao: number; // %
  reuniaoAgendadaToRealizada: number; // %
  reuniaoRealizadaToVenda: number; // %
  conversaoGeral: number; // %
}

export interface FinanceiroKPIs {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  mrr: number;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  crm: CrmKPIs & { totalLeads: number };
  financeiro: FinanceiroKPIs;
  trafego: TrafegoKPIs;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export type PeriodFilter = "hoje" | "semana" | "mes" | "3meses" | "6meses" | "1ano" | "personalizado";

export interface DateRange {
  from: Date;
  to: Date;
}

export type Theme = "dark" | "light";

// ─────────────────────────────────────────────────────────────────────────────
// Lancaster SaaS — Módulo Financeiro
// ─────────────────────────────────────────────────────────────────────────────

// ── Clientes da Agência ───────────────────────────────────────────────────────

export type ClientStatus = "ativo" | "inativo" | "churned";
export type CompanyType = "imobiliaria" | "construtora" | "corretor" | "outro";

export interface AgencyClient {
  id: string;
  user_id: string;
  name: string;
  company_type: CompanyType;
  status: ClientStatus;
  monthly_fee: number;
  contract_start: string | null;
  contract_end: string | null;
  payment_day: number;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type NewAgencyClient = Omit<AgencyClient, "id" | "user_id" | "created_at" | "updated_at">;
export type UpdateAgencyClient = Partial<NewAgencyClient>;

// ── Client Cost Shares (Parceiros / Comissões) ────────────────────────────────

export interface ClientCostShare {
  id: string;
  client_id: string;
  user_id: string;
  name: string;
  percentage: number;
  created_at: string;
  updated_at: string;
}

export type NewClientCostShare = Omit<ClientCostShare, "id" | "user_id" | "created_at" | "updated_at">;

// ── Contratos ─────────────────────────────────────────────────────────────────

export type ContractType = "mensalidade" | "setup" | "projeto" | "consultoria";
export type ContractStatus = "ativo" | "encerrado" | "pausado";

export interface Contract {
  id: string;
  user_id: string;
  client_id: string | null;
  type: ContractType;
  value: number;
  start_date: string;
  end_date: string | null;
  status: ContractStatus;
  description: string | null;
  created_at: string;
  updated_at: string;
  client?: AgencyClient;
}

// ── Receitas ──────────────────────────────────────────────────────────────────

export type RevenueType = "mensalidade" | "setup" | "extra" | "consultoria" | "outro";
export type PaymentMethod = "pix" | "boleto" | "cartao" | "ted" | "dinheiro" | "outro";
export type RevenueStatus = "pago" | "pendente" | "atrasado" | "cancelado";

export interface Revenue {
  id: string;
  user_id: string;
  client_id: string | null;
  type: RevenueType;
  description: string;
  amount: number;
  date: string;
  due_date: string | null;
  paid_date: string | null;
  payment_method: PaymentMethod;
  status: RevenueStatus;
  is_recurring: boolean;
  recurring_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: AgencyClient;
}

export type NewRevenue = Omit<Revenue, "id" | "user_id" | "created_at" | "updated_at" | "client">;
export type UpdateRevenue = Partial<NewRevenue>;

// ── Despesas ──────────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | "freelancers"
  | "equipe"
  | "ferramentas"
  | "impostos"
  | "operacional"
  | "marketing"
  | "trafego_pago"
  | "outros";

export type ExpenseType = "fixa" | "variavel";

export interface Expense {
  id: string;
  user_id: string;
  client_id: string | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
  type: ExpenseType;
  cost_center: string | null;
  auto_imported: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: AgencyClient;
}

export type NewExpense = Omit<Expense, "id" | "user_id" | "created_at" | "updated_at" | "client">;
export type UpdateExpense = Partial<NewExpense>;

// ── Receitas Recorrentes ──────────────────────────────────────────────────────

export type RecurringStatus = "ativo" | "pausado" | "cancelado";

export interface RecurringRevenue {
  id: string;
  user_id: string;
  client_id: string | null;
  type: RevenueType;
  description: string;
  amount: number;
  payment_day: number;
  status: RecurringStatus;
  start_date: string;
  end_date: string | null;
  last_generated_date: string | null;
  created_at: string;
  updated_at: string;
  client?: AgencyClient;
}

// ── Custos de Tráfego ─────────────────────────────────────────────────────────

export type TrafficPlatform = "meta" | "google" | "tiktok" | "linkedin" | "outro";

export interface TrafficCost {
  id: string;
  user_id: string;
  client_id: string | null;
  campaign_name: string;
  platform: TrafficPlatform;
  amount: number;
  date: string;
  period_start: string | null;
  period_end: string | null;
  reference_id: string | null;
  imported_at: string;
  created_at: string;
  client?: AgencyClient;
}

// ── Metas Financeiras ─────────────────────────────────────────────────────────

export interface FinancialGoal {
  id: string;
  user_id: string;
  year: number;
  month: number;
  revenue_goal: number;
  profit_goal: number;
  mrr_goal: number;
  new_contracts_goal: number;
  margin_goal: number;
  created_at: string;
  updated_at: string;
}

export type NewFinancialGoal = Omit<FinancialGoal, "id" | "user_id" | "created_at" | "updated_at">;

// ── Cobranças / Inadimplência ─────────────────────────────────────────────────

export type CollectionStatus = "pendente" | "em_cobranca" | "pago" | "perdido";

export interface Collection {
  id: string;
  user_id: string;
  client_id: string | null;
  revenue_id: string | null;
  amount: number;
  due_date: string;
  status: CollectionStatus;
  last_contact_date: string | null;
  contact_notes: string | null;
  created_at: string;
  updated_at: string;
  client?: AgencyClient;
  revenue?: Revenue;
}

export type NewCollection = Omit<Collection, "id" | "user_id" | "created_at" | "updated_at" | "client" | "revenue">;
export type UpdateCollection = Partial<NewCollection>;

// ── Dashboard Financeiro ──────────────────────────────────────────────────────

export interface FinancialDashboardData {
  faturamento: number;
  mrr: number;
  receita_nova: number;
  receita_perdida: number;
  lucro_bruto: number;
  lucro_liquido: number;
  caixa_disponivel: number;
  clientes_ativos: number;
  novos_contratos: number;
  ticket_medio: number;
  total_despesas: number;
  total_comissoes: number;
  inadimplencia: number;
  margem_geral: number;
  receita_vs_despesa: Array<{ mes: string; receita: number; despesa: number; comissao: number }>;
  evolucao_lucro: Array<{ mes: string; lucro: number }>;
  crescimento_mrr: Array<{ mes: string; mrr: number }>;
  fluxo_mensal: Array<{ mes: string; entradas: number; saidas: number; saldo: number }>;
  // Daily arrays for hero chart (populated when since/until date range is provided)
  receita_diaria: Array<{ data: string; valor: number }>;
  despesa_diaria: Array<{ data: string; valor: number }>;
  comissao_diaria: Array<{ data: string; valor: number }>;
  lucro_diario: Array<{ data: string; valor: number }>;
}

// ── Rentabilidade por Cliente ─────────────────────────────────────────────────

export interface ClientProfitability {
  client: AgencyClient;
  mensalidade: number;
  custo_total: number;
  custo_midia: number;
  outros_custos: number;
  custo_parceiros: number;
  lucro: number;
  margem: number;
  tempo_contrato_meses: number;
}

// ── Fluxo de Caixa ────────────────────────────────────────────────────────────

export interface CashFlowSummary {
  entradas_previstas: number;
  entradas_recebidas: number;
  saidas_previstas: number;
  saidas_pagas: number;
  saldo_atual: number;
  projecao_30: number;
  projecao_60: number;
  projecao_90: number;
}

// ── Alertas Financeiros ───────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Lancaster SaaS — Módulo de Tráfego Pago
// ─────────────────────────────────────────────────────────────────────────────

// ── Configurações de Tráfego por Cliente ─────────────────────────────────────

export type TrafficClientStatus = "ativo" | "pausado" | "inativo";

export interface TrafficClientSettings {
  id: string;
  user_id: string;
  client_id: string;
  monthly_budget: number;
  status: TrafficClientStatus;
  platforms: TrafficPlatform[];
  max_cpl: number | null;
  target_leads: number | null;
  target_conversions: number | null;
  min_ctr: number | null;
  target_roas: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: AgencyClient;
}

export type NewTrafficClientSettings = Omit<TrafficClientSettings, "id" | "user_id" | "created_at" | "updated_at" | "client">;
export type UpdateTrafficClientSettings = Partial<NewTrafficClientSettings>;

// ── Campanhas ─────────────────────────────────────────────────────────────────

export type CampaignPlatform = "meta" | "google" | "tiktok" | "linkedin" | "outro";
export type CampaignObjective = "leads" | "conversoes" | "alcance" | "trafego" | "engajamento" | "vendas" | "outro";
export type CampaignStatus = "ativa" | "pausada" | "finalizada" | "em_revisao" | "rascunho";

export interface Campaign {
  id: string;
  user_id: string;
  client_id: string | null;
  platform_account_id: string | null;
  name: string;
  platform: CampaignPlatform;
  objective: CampaignObjective;
  status: CampaignStatus;
  daily_budget: number;
  total_budget: number;
  start_date: string;
  end_date: string | null;
  external_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: AgencyClient;
}

export type NewCampaign = Omit<Campaign, "id" | "user_id" | "created_at" | "updated_at" | "client">;
export type UpdateCampaign = Partial<NewCampaign>;

// ── Métricas de Campanha ──────────────────────────────────────────────────────

export interface CampaignMetric {
  id: string;
  user_id: string;
  campaign_id: string;
  client_id: string | null;
  platform_account_id: string | null;
  date: string;
  impressions: number;
  // Total clicks (all types: link + reactions + shares + etc.)
  clicks: number;
  // Link clicks only — inline_link_clicks from Meta API
  link_clicks: number;
  spend: number;
  leads: number;
  conversions: number;
  reach: number;
  frequency: number;
  video_views: number;
  // unique_ctr from Meta API — "CTR Único" in Meta Ads Manager
  unique_ctr: number;
  // computed (stored — generated columns in Postgres)
  ctr: number;          // clicks / impressions * 100 (all-click CTR)
  cpl: number;
  cpc: number;
  cpm: number;
  conversion_rate: number;
  created_at: string;
  campaign?: Campaign;
  client?: AgencyClient;
}

export type NewCampaignMetric = Pick<CampaignMetric,
  "campaign_id" | "client_id" | "date" | "impressions" | "clicks" |
  "spend" | "leads" | "conversions" | "reach" | "frequency" | "video_views"
>;

// ── Contas de Plataforma ──────────────────────────────────────────────────────

export type PlatformAccountStatus = "connected" | "disconnected" | "pending" | "error";

export interface AdPlatformAccount {
  id: string;
  user_id: string;
  client_id: string | null;
  platform: CampaignPlatform;
  account_name: string;
  account_id: string | null;
  status: PlatformAccountStatus;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
  client?: AgencyClient;
}

// ── Meta Ads Integration ──────────────────────────────────────────────────────

export interface MetaAdAccount {
  id: string;           // "act_123456789"
  name: string;
  account_status: number;
}

export interface MetaSyncLog {
  id: string;
  user_id: string;
  platform_account_id: string | null;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "error";
  campaigns_synced: number;
  metrics_synced: number;
  error_message: string | null;
}

// ── Metas Mensais de Tráfego ──────────────────────────────────────────────────

export interface TrafficMonthlyGoal {
  id: string;
  user_id: string;
  client_id: string | null;
  year: number;
  month: number;
  target_leads: number;
  max_cpl: number;
  target_conversions: number;
  min_ctr: number;
  target_roas: number;
  monthly_budget: number;
  created_at: string;
  updated_at: string;
  client?: AgencyClient;
}

export type NewTrafficMonthlyGoal = Omit<TrafficMonthlyGoal, "id" | "user_id" | "created_at" | "updated_at" | "client">;

// ── KPIs de Tráfego ───────────────────────────────────────────────────────────

export interface TrafficDashboardData {
  investimento_total: number;
  leads_total: number;
  cpl_medio: number;
  cpc_medio: number;
  cpm_medio: number;
  ctr_medio: number;
  conversoes_total: number;
  taxa_conversao: number;
  roas_geral: number;
  clientes_ativos_midia: number;
  campanhas_ativas: number;
  impressoes_total: number;
  cliques_total: number;
  alcance_total: number;
  // Daily chart data
  investimento_diario: Array<{ data: string; valor: number }>;
  leads_diario: Array<{ data: string; leads: number }>;
  cpl_diario: Array<{ data: string; cpl: number }>;
  conversoes_diario: Array<{ data: string; conversoes: number }>;
  performance_clientes: Array<{ cliente: string; investimento: number; leads: number; cpl: number; conversoes: number }>;
  distribuicao_verba: Array<{ cliente: string; valor: number; percentual: number }>;
  top_campanhas: Array<{ id: string; nome: string; status: string; spend: number; leads: number; cpl: number; ctr: number }>;
}

// ── Performance por Cliente ───────────────────────────────────────────────────

export interface ClientTrafficPerformance {
  client: AgencyClient;
  settings: TrafficClientSettings | null;
  investimento: number;
  leads: number;
  cpl: number;
  ctr: number;
  conversoes: number;
  custo_conversao: number;
  impressoes: number;
  cliques: number;
  frequencia_media: number;
  melhor_campanha: string | null;
  pior_campanha: string | null;
  budget_utilizado_pct: number;
}

// ── Alertas de Tráfego ────────────────────────────────────────────────────────

export type TrafficAlertType =
  | "cpl_alto"
  | "sem_leads"
  | "ctr_baixo"
  | "frequencia_alta"
  | "verba_acabando"
  | "campanha_parada"
  | "queda_performance"
  | "conversoes_zeradas"
  | "roi_negativo";

export interface TrafficAlert {
  id: string;
  type: TrafficAlertType;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  client_name?: string;
  campaign_name?: string;
  value?: number;
  meta_value?: number;
}

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType =
  | "margem_baixa"
  | "cliente_prejuizo"
  | "despesa_alta"
  | "caixa_baixo"
  | "receita_caindo"
  | "churn_alto"
  | "cobranca_vencida"
  | "custo_alto";

export interface FinancialAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  client_id?: string;
  client_name?: string;
  value?: number;
}

// ── NPS ───────────────────────────────────────────────────────────────────────

export type NpsChannel = "manual" | "formulario" | "whatsapp" | "outro";
export type NpsClassification = "promotor" | "neutro" | "detrator";

export interface NpsRecord {
  id: string;
  user_id: string;
  client_id: string;
  reference_month: string; // YYYY-MM
  score: number;           // 0–10
  comment: string | null;
  channel: NpsChannel;
  responsible: string | null;
  created_at: string;
  updated_at: string;
  client?: AgencyClient;
}

export type NewNpsRecord = Omit<NpsRecord, "id" | "user_id" | "created_at" | "updated_at" | "client">;
export type UpdateNpsRecord = Partial<NewNpsRecord>;

// ── Portais ────────────────────────────────────────────────────────────────────

export type PortalStatus = "ativo" | "pausado";

export interface Portal {
  id: string;
  user_id: string;
  client_id: string | null;
  name: string;
  slug: string;
  status: PortalStatus;
  created_at: string;
  updated_at: string;
  client?: AgencyClient;
  portal_accounts?: PortalAccount[];
}

export interface PortalAccount {
  id: string;
  portal_id: string;
  ad_account_id: string; // Meta account_id like "act_xxx"
  created_at: string;
}

export interface NewPortal {
  client_id: string | null;
  name: string;
  slug: string;
  status: PortalStatus;
  ad_account_ids: string[];
}

export interface UpdatePortal {
  client_id?: string | null;
  name?: string;
  slug?: string;
  status?: PortalStatus;
  ad_account_ids?: string[];
}

export interface PortalKPIs {
  investimento: number;
  leads: number;
  cpl: number;
  alcance: number;
  cliques: number;
  ctr: number;
  impressoes: number;
}

export interface PortalDailyMetric {
  data: string;
  investimento: number;
  leads: number;
  cpl: number;
}

export interface PortalCampaignSummary {
  id: string;
  nome: string;
  status: string;
  investimento: number;
  leads: number;
  cpl: number;
  ctr: number;
  impressoes: number;
  cliques: number;
}

export interface PortalAvailableAccount {
  id: string;   // Meta account_id "act_xxx"
  name: string;
}

export interface PortalGeoMetric {
  region: string;
  leads: number;
  clicks: number;
  impressions: number;
  reach: number;
  spend: number;
}

export interface PortalPublicData {
  portal: {
    name: string;
    client_name: string | null;
    status: PortalStatus;
  };
  kpis: PortalKPIs;
  daily: PortalDailyMetric[];
  campaigns: PortalCampaignSummary[];
  available_accounts: PortalAvailableAccount[];
  available_campaigns: { id: string; name: string; status: string }[];
}

// Taxa de impostos Meta Brasil (IOF + taxa plataforma) — usada para cálculo de saldo líquido
export const META_BR_TAX_RATE = 0.1215;

export interface PortalAccountBalance {
  account_id: string;
  account_name: string;
  account_status: number;   // 1=ativa, 2=desativada, 3=pendente …
  currency: string;
  balance_gross: number;    // saldo bruto (da API Meta, em unidade principal)
  balance_net: number;      // saldo líquido = bruto * (1 - META_BR_TAX_RATE)
  amount_spent: number;     // total gasto (em unidade principal)
  funding_type: string;     // "PREPAY" | "POSTPAY_AUTOPAY" | etc.
  funding_display: string | null;
  is_prepay: boolean;
  fetched_at: string;       // ISO timestamp da consulta
}

export interface PortalCreative {
  ad_id: string;
  creative_name: string;
  campaign_name: string;
  image_url: string | null;
  status: "ativa" | "pausada";
  leads: number;
  cpl: number;
  spend: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  ranking: number;
}

// =============================================================================
// Módulo: Formulários Conversacionais
// =============================================================================

// ── Step types ────────────────────────────────────────────────────────────────

export type FormStepType =
  | "name"
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "multiple_choice"
  | "single_choice"
  | "rating"
  | "nps_scale"
  | "date"
  | "file_upload"
  | "statement"
  | "redirect"
  | "calendar";

// Peso da pergunta no cálculo de IQ — o usuário escolhe uma destas opções,
// nunca um número. Ver src/lib/crm/lead-score-engine.ts pela escala interna.
export type QuestionWeight = "ignore" | "low" | "medium" | "high" | "critical";

export interface FormStep {
  id: string;
  type: FormStepType;
  title: string;
  description?: string;
  required: boolean;
  placeholder?: string;
  // multiple_choice / single_choice
  // score = classificação da resposta em estrelas (1-5), usada no cálculo de
  // IQ — só single_choice participa do IQ na v1 (mesmo recorte do Logic Engine).
  choices?: Array<{ id: string; label: string; value: string; score?: 1 | 2 | 3 | 4 | 5 }>;
  // Peso desta pergunta no IQ. Ausente/"ignore" = não entra no cálculo.
  weight?: QuestionWeight;
  // rating
  maxRating?: number;
  // nps_scale — rótulos exibidos nas pontas da escala 0-10 (padrão: "Pouco
  // provável" / "Muito provável" se ausentes)
  scaleLowLabel?: string;
  scaleHighLabel?: string;
  // file_upload
  allowedTypes?: string[];
  maxFileSizeMb?: number;
  // redirect / statement
  content?: string;
  // calendar — calendarId é a referência estável; slug/name são cache de
  // exibição (mesmo padrão de owner_id/owner_name em CrmSettings).
  calendarId?: string;
  calendarSlug?: string;
  calendarName?: string;
}

// ── Logic ─────────────────────────────────────────────────────────────────────

export type LogicOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "less_than"
  | "empty"
  | "not_empty"
  | "between"
  | "in"
  | "not_in";

export type LogicActionType = "jump" | "end" | "disqualify" | "redirect" | "complete";

export interface LogicCondition {
  step: string;
  operator: LogicOperator;
  value?: string | number | string[];
}

export interface LogicAction {
  type: LogicActionType;
  target?: string;   // step id ou ending id
  url?: string;
}

export interface LogicRule {
  id: string;
  condition: LogicCondition;
  action: LogicAction;
}

// ── Welcome / Endings ─────────────────────────────────────────────────────────

export interface FormWelcomeScreen {
  enabled: boolean;
  title: string;
  description?: string;
  buttonText: string;
  imageUrl?: string;
  imageSize?: "small" | "medium" | "large";
}

export interface FormEnding {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  redirectDelay?: number;
  redirectUrl?: string;
  pixelEvent?: string;
}

// ── Theme / Settings ──────────────────────────────────────────────────────────

export interface FormTheme {
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonStyle?: "rounded" | "square" | "pill";
  buttonSize?: "sm" | "md" | "lg";
  fontFamily?: string;
  titleSize?: string;
  descriptionSize?: string;
  progressBar?: boolean;
  textAlign?: "left" | "center" | "right";
  borderRadius?: string;
}

export interface FormSettings {
  redirectUrl?: string;
  notificationEmails?: string[];
  savePartial?: boolean;
  allowBack?: boolean;
  allowRestart?: boolean;
  showProgress?: boolean;
  showQuestionCounter?: boolean;
  antiFraudEnabled?: boolean;
}

// ── Integrations ──────────────────────────────────────────────────────────────

export type PixelMode = "browser" | "capi" | "both";

export interface FormMetaPixelConfig {
  enabled:       boolean;
  pixelId:       string;
  event:         string;
  mode:          PixelMode;
  accessToken:   string;
  testEventCode: string;
}

export interface FormWebhookConfig {
  enabled: boolean;
  url:     string;
  secret:  string;
}

export interface FormIntegrations {
  webhookUrl?:      string;
  pixelId?:         string;
  crmEnabled?:      boolean;
  calendarEnabled?: boolean;
  metaPixel?:       FormMetaPixelConfig;
  webhook?:         FormWebhookConfig;
}

// ── Form ──────────────────────────────────────────────────────────────────────

export type FormStatus = "draft" | "published" | "archived" | "disabled";

export interface Form {
  id: string;
  user_id: string;
  created_by: string | null;
  updated_by: string | null;
  name: string;
  slug: string;
  description: string | null;
  status: FormStatus;
  theme: FormTheme;
  settings: FormSettings;
  steps: FormStep[];
  logic_rules: LogicRule[];
  welcome_screen: FormWelcomeScreen;
  endings: FormEnding[];
  integrations: FormIntegrations;
  published_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  response_count?: number;
}

export type NewForm = Pick<Form, "name" | "slug" | "description">;

export type UpdateForm = Partial<
  Pick<Form, "name" | "slug" | "description" | "status" | "theme" | "settings" | "steps" | "logic_rules" | "welcome_screen" | "endings" | "integrations">
>;

// ── Session ───────────────────────────────────────────────────────────────────

export interface FormSession {
  id: string;
  form_id: string;
  user_id: string;
  token: string;
  device: string | null;
  browser: string | null;
  os: string | null;
  language: string | null;
  country: string | null;
  ip: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  fbclid: string | null;
  gclid: string | null;
  referrer: string | null;
  is_partial: boolean;
  started_at: string;
  finished_at: string | null;
  abandoned_at: string | null;
}

export type NewFormSession = Pick<
  FormSession,
  "form_id" | "user_id" | "device" | "browser" | "os" | "language" | "country" | "ip" |
  "utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "utm_content" |
  "fbclid" | "gclid" | "referrer"
>;

// ── Submission ────────────────────────────────────────────────────────────────

export type FormSubmissionStatus = "partial" | "completed" | "spam";

export interface FormSubmission {
  id: string;
  form_id: string;
  user_id: string;
  session_id: string | null;
  lead_id: string | null;
  status: FormSubmissionStatus;
  answers: Record<string, unknown>;
  score: number | null;
  completed_at: string | null;
  created_at: string;
}

// ── Events ────────────────────────────────────────────────────────────────────

export type FormEventType =
  // ── Sessão ──────────────────────────────────────────────────────────────────
  | "page_loaded"
  | "session_started"
  | "session_resumed"
  | "session_completed"
  | "session_timeout"
  // ── Welcome ─────────────────────────────────────────────────────────────────
  | "welcome_view"
  | "welcome_started"
  // ── Navegação ───────────────────────────────────────────────────────────────
  | "step_view"
  | "step_completed"
  | "back_clicked"
  | "step_skipped"
  | "validation_error"
  // ── Respostas ────────────────────────────────────────────────────────────────
  | "answer_changed"
  | "answer_cleared"
  | "answer_restored"
  // ── Lógica ──────────────────────────────────────────────────────────────────
  | "rule_matched"
  | "rule_not_matched"
  | "jump_executed"
  | "ending_reached"
  | "redirect_executed"
  | "logic_executed"
  // ── Formulário ──────────────────────────────────────────────────────────────
  | "submission_started"
  | "submission_finished"
  | "abandoned"
  | "restart"
  | "form_error"
  // ── Legado ──────────────────────────────────────────────────────────────────
  | "booking_started"
  | "booking_finished";

export interface FormEvent {
  id: string;
  form_id: string;
  user_id: string;
  session_id: string | null;
  step_id: string | null;
  event: FormEventType;
  duration: number | null;
  meta: Record<string, unknown> | null;
  idempotency_key: string | null;
  created_at: string;
}

// ── Version ───────────────────────────────────────────────────────────────────

export interface FormVersion {
  id: string;
  form_id: string;
  user_id: string;
  version: number;
  snapshot: Partial<Form>;
  published_at: string;
}

// ── Template ──────────────────────────────────────────────────────────────────

export type FormTemplateCategory =
  | "rh"
  | "imobiliario"
  | "comercial"
  | "clinicas"
  | "pesquisa"
  | "eventos"
  | "outro";

export interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  category: FormTemplateCategory;
  thumbnail_url: string | null;
  steps: FormStep[];
  welcome_screen: FormWelcomeScreen;
  endings: FormEnding[];
  settings: FormSettings;
  is_public: boolean;
  created_at: string;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

/**
 * FormInsights — returned by GET /api/formularios/:id/insights.
 * The `insights` field is a full InsightsDomain object from src/lib/analytics/types.ts.
 * Re-exported here as a legacy alias for backward compatibility with the Insights page.
 */
export interface FormInsights {
  // ── KPIs ────────────────────────────────────────────────────────────────────
  total_views:           number;
  total_starts:          number;
  total_submissions:     number;
  completion_rate:       number;
  abandonment_rate:      number;
  avg_duration_seconds:  number;
  avg_completion_pct:    number;
  // ── Drop-off ────────────────────────────────────────────────────────────────
  drop_off_by_step: Array<{
    step_id:         string;
    step_title:      string;
    views:           number;
    completions:     number;
    drop_rate:       number;
    avg_duration_secs: number;
  }>;
  // ── Time series ─────────────────────────────────────────────────────────────
  submissions_by_day: Array<{ date: string; count: number }>;
  views_by_day:       Array<{ date: string; count: number }>;
  starts_by_day:      Array<{ date: string; count: number }>;
  // ── Devices & sources ───────────────────────────────────────────────────────
  sessions_by_device:  Array<{ device: string; count: number }>;
  sessions_by_browser: Array<{ browser: string; count: number }>;
  sessions_by_os:      Array<{ os: string; count: number }>;
  utm_sources:         Array<{ source: string; count: number }>;
  referrers:           Array<{ referrer: string; count: number }>;
  // ── Question ranking ─────────────────────────────────────────────────────────
  question_ranking: Array<{
    step_id:         string;
    step_title:      string;
    drop_rate:       number;
    avg_duration_secs: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Módulo: Gerador de Criativos IA
// ─────────────────────────────────────────────────────────────────────────────

export type CriativoTom =
  | "urgente"
  | "sofisticado"
  | "amigavel"
  | "profissional"
  | "emocional"
  | "direto";

export type CriativoEstiloVisual =
  | "minimalista"
  | "bold"
  | "luxury"
  | "moderno"
  | "colorido"
  | "escuro";

export type CriativoSegmento =
  | "imobiliario"
  | "varejo"
  | "servicos"
  | "saude"
  | "educacao"
  | "outro";

export type CriativoProjetoStatus = "rascunho" | "ativo" | "arquivado";

export type CriativoJobStatus = "pendente" | "processando" | "concluido" | "erro";

export type CriativoAssetTipo = "logo" | "imagem" | "fundo" | "icone";

export type CriativoFormato = "1080x1080" | "1080x1920" | "1920x1080" | "1200x628";

// ── Projeto ───────────────────────────────────────────────────────────────────

export interface CriativoProjeto {
  id: string;
  user_id: string;
  client_id: string | null;
  nome: string;
  objetivo: string;
  publico: string;
  oferta: string;
  tom: CriativoTom;
  estilo_visual: CriativoEstiloVisual;
  segmento: CriativoSegmento;
  status: CriativoProjetoStatus;
  created_at: string;
  updated_at: string;
  // relações opcionais (join)
  agency_clients?: { name: string } | null;
}

export interface NewCriativoProjeto {
  nome: string;
  objetivo?: string | null;
  publico?: string | null;
  oferta?: string | null;
  tom?: CriativoTom | null;
  estilo_visual?: CriativoEstiloVisual | null;
  segmento?: CriativoSegmento | null;
  client_id?: string | null;
}

export interface UpdateCriativoProjeto {
  nome?: string;
  objetivo?: string;
  publico?: string;
  oferta?: string;
  tom?: CriativoTom;
  estilo_visual?: CriativoEstiloVisual;
  segmento?: CriativoSegmento;
  status?: CriativoProjetoStatus;
  client_id?: string | null;
}

// ── Asset ─────────────────────────────────────────────────────────────────────

export interface CriativoAsset {
  id: string;
  projeto_id: string;
  user_id: string;
  tipo: CriativoAssetTipo;
  nome_arquivo: string;
  storage_path: string;
  url: string;
  tamanho_bytes: number | null;
  largura_px: number | null;
  altura_px: number | null;
  created_at: string;
}

// ── Job ───────────────────────────────────────────────────────────────────────

export interface CriativoJob {
  id: string;
  projeto_id: string;
  user_id: string;
  status: CriativoJobStatus;
  quantidade: number;
  progresso: number;
  tokens_usados: number;
  erro_mensagem: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  created_at: string;
}

// ── Resultado ─────────────────────────────────────────────────────────────────

export interface CriativoResultado {
  id: string;
  job_id: string;
  projeto_id: string;
  user_id: string;
  variacao: number;
  headline: string | null;
  copy: string | null;
  cta: string | null;
  prompt_imagem: string | null;
  imagem_url: string | null;
  storage_path: string | null;
  formato: CriativoFormato;
  estilo_aplicado: string | null;
  favorito: boolean;
  avaliacao: number | null;
  created_at: string;
  updated_at: string;
}
