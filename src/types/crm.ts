// ─────────────────────────────────────────────────────────────────────────────
// CRM — Pipeline, Stage & Conversion types
// ─────────────────────────────────────────────────────────────────────────────

// ── Pipelines ─────────────────────────────────────────────────────────────────

export interface CrmPipeline {
  id:          string;
  user_id:     string;
  name:        string;
  description: string | null;
  color:       string;
  icon:        string;
  order_index: number;
  is_active:   boolean;
  created_at:  string;
  updated_at:  string;
}

export type NewCrmPipeline = {
  name:         string;
  description?: string | null;
  color?:       string;
  icon?:        string;
  order_index?: number;
};

export type UpdateCrmPipeline = Partial<NewCrmPipeline & { is_active: boolean }>;

export interface CrmPipelineWithStages extends CrmPipeline {
  crm_stages: CrmStage[];
}

// ── Stages ────────────────────────────────────────────────────────────────────

export interface CrmStage {
  id:                 string;
  pipeline_id:        string;
  user_id:            string;
  name:               string;
  description:        string | null;
  color:              string;
  icon:               string | null;
  order_index:        number;
  is_active:          boolean;
  allow_free_move:    boolean;
  require_note:       boolean;
  require_attachment: boolean;
  allow_edit:         boolean;
  legacy_column:      string | null;
  /** Marca esta etapa como "venda ganha" — dispara lead.deal.won ao entrar. */
  is_won:             boolean;
  /** Marca esta etapa como "venda perdida" — dispara lead.deal.lost ao entrar. */
  is_lost:            boolean;
  created_at:         string;
  updated_at:         string;
}

export type NewCrmStage = {
  pipeline_id:    string;
  name:           string;
  description?:   string | null;
  color?:         string;
  icon?:          string | null;
  order_index?:   number;
};

export type UpdateCrmStage = Partial<{
  name:               string;
  description:        string | null;
  color:              string;
  icon:               string | null;
  order_index:        number;
  is_active:          boolean;
  allow_free_move:    boolean;
  require_note:       boolean;
  require_attachment: boolean;
  allow_edit:         boolean;
  is_won:             boolean;
  is_lost:            boolean;
}>;

// ── Stage Conversions ─────────────────────────────────────────────────────────

export type ConversionPlatform =
  | "meta_pixel"
  | "google_ads"
  | "linkedin_insight"
  | "ga4";

export interface CrmStageConversion {
  id:                      string;
  stage_id:                string;
  user_id:                 string;
  platform:                ConversionPlatform;
  platform_integration_id: string | null;
  enabled:                 boolean;
  settings:                Record<string, unknown>;
  created_at:              string;
  updated_at:              string;
}

export type NewCrmStageConversion = {
  stage_id:                 string;
  platform:                 ConversionPlatform;
  platform_integration_id?: string | null;
  enabled?:                 boolean;
  settings?:                Record<string, unknown>;
};

export type UpdateCrmStageConversion = Partial<{
  enabled:  boolean;
  settings: Record<string, unknown>;
}>;

// ── Lead Stage History ────────────────────────────────────────────────────────

export interface CrmLeadStageHistory {
  id:          string;
  lead_id:     string;
  pipeline_id: string | null;
  stage_id:    string | null;
  from_column: string | null;
  to_column:   string | null;
  moved_by:    string | null;
  moved_at:    string;
  note:        string | null;
}

// ── Pipeline Members (team structure — no UI yet) ─────────────────────────────

export type CrmPipelineRole = "owner" | "manager" | "member" | "viewer";

export interface CrmPipelineMember {
  id:          string;
  pipeline_id: string;
  user_id:     string;
  role:        CrmPipelineRole;
  permissions: Record<string, unknown>;
  created_at:  string;
  updated_at:  string;
}

// ── Meta Pixel conversion settings (stored in crm_stage_conversions.settings) ─

export type MetaPixelEventName =
  | "Lead"
  | "ViewContent"
  | "Contact"
  | "CompleteRegistration"
  | "Schedule"
  | "Purchase"
  | "Subscribe"
  | "StartTrial"
  | "InitiateCheckout"
  | "AddToCart"
  | "Search"
  | "Donate"
  | "SubmitApplication"
  | "CustomEvent";

export interface MetaPixelConversionSettings {
  mode:               "browser" | "capi" | "both";
  event_name:         MetaPixelEventName;
  custom_event_name?: string | null;
  value?:             number | null;
  currency?:          string | null;
  test_event_code?:   string | null;
}

// ── Conversion Sources / Platform Integrations ────────────────────────────────
// User-scoped pixel/provider credentials. Optionally linked to a pipeline.
// DB table: platform_integrations (renamed from crm_conversion_sources).

export interface CrmConversionSource {
  id:              string;
  user_id:         string;
  pipeline_id:     string | null;
  name:            string;
  description:     string | null;
  provider:        ConversionPlatform;
  pixel_id:        string;
  access_token:    string;
  test_event_code: string | null;
  is_default:      boolean;
  is_active:       boolean;
  last_success_at: string | null;
  last_error:      string | null;
  last_error_at:   string | null;
  created_by:      string | null;
  created_at:      string;
  updated_at:      string;
}

export type NewCrmConversionSource = {
  pipeline_id?:     string | null;
  name:             string;
  description?:     string | null;
  provider:         ConversionPlatform;
  pixel_id:         string;
  access_token:     string;
  test_event_code?: string | null;
  is_default?:      boolean;
  is_active?:       boolean;
};

export type UpdateCrmConversionSource = Partial<{
  name:            string;
  description:     string | null;
  pixel_id:        string;
  access_token:    string;
  test_event_code: string | null;
  is_default:      boolean;
  is_active:       boolean;
}>;

// Aliases para o novo nome do módulo global.
// O tipo base permanece CrmConversionSource enquanto o código migra gradualmente.
export type PlatformIntegration    = CrmConversionSource;
export type NewPlatformIntegration = NewCrmConversionSource;
export type UpdatePlatformIntegration = UpdateCrmConversionSource;

// ── CRM Notification Rules ────────────────────────────────────────────────────

export type CrmNotificationChannel = "pwa";

export interface CrmNotificationRule {
  id:          string;
  user_id:     string;
  pipeline_id: string;
  stage_id:    string;
  enabled:     boolean;
  channels:    CrmNotificationChannel[];
  title:       string;
  body:        string;
  created_at:  string;
  updated_at:  string;
}

export interface CrmNotificationRuleWithNames extends CrmNotificationRule {
  pipeline_name: string;
  stage_name:    string;
  stage_color:   string;
}

export type NewCrmNotificationRule = {
  pipeline_id: string;
  stage_id:    string;
  enabled?:    boolean;
  channels?:   CrmNotificationChannel[];
  title?:      string;
  body?:       string;
};

export type UpdateCrmNotificationRule = Partial<{
  enabled:  boolean;
  channels: CrmNotificationChannel[];
  title:    string;
  body:     string;
}>;
