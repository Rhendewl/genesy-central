export type AuthType = "apiKey" | "hmac" | "oauth" | "none";

export interface FieldDefinition {
  key:          string;
  label:        string;
  type:         "text" | "password" | "url" | "number" | "textarea";
  required:     boolean;
  placeholder?: string;
  hint?:        string;
}

export interface IntegrationDefinition {
  adapterName:      string;
  displayName:      string;
  description:      string;
  category:         string;
  version:          string;
  authType:         AuthType;
  supportedEvents:  string[];
  settingsSchema:   FieldDefinition[];
  secretsSchema:    FieldDefinition[];
}

export const INTEGRATION_CATALOG: IntegrationDefinition[] = [
  {
    adapterName:     "meta-pixel",
    displayName:     "Meta Pixel",
    description:     "Envie eventos de conversão para a Meta Conversions API e sincronize leads do seus formulários.",
    category:        "Marketing",
    version:         "1.0.0",
    authType:        "apiKey",
    supportedEvents: ["form.started", "form.completed", "form.step.viewed", "form.step.answered", "form.abandoned"],
    settingsSchema:  [
      { key: "pixelId", label: "Pixel ID", type: "text", required: true, placeholder: "123456789012345", hint: "Encontre em Gerenciador de Eventos → Configurações" },
    ],
    secretsSchema: [
      { key: "access_token", label: "Access Token", type: "password", required: true, placeholder: "EAAxxxxxxxxxxxxx...", hint: "Token de acesso gerado no painel de desenvolvedor da Meta" },
    ],
  },
  {
    adapterName:     "ga4",
    displayName:     "Google Analytics 4",
    description:     "Dispare eventos para o GA4 via Measurement Protocol e acompanhe conversões em tempo real.",
    category:        "Analytics",
    version:         "1.0.0",
    authType:        "apiKey",
    supportedEvents: ["form.started", "form.completed", "form.step.viewed", "form.step.answered", "form.abandoned"],
    settingsSchema:  [
      { key: "measurementId", label: "Measurement ID", type: "text", required: true, placeholder: "G-XXXXXXXXXX", hint: "Encontre em Admin → Fluxos de dados → ID de medição" },
    ],
    secretsSchema: [
      { key: "api_secret", label: "API Secret", type: "password", required: true, placeholder: "seu_api_secret", hint: "Gerado em Admin → Fluxos de dados → Segredos da API de medição" },
    ],
  },
  {
    adapterName:     "webhook",
    displayName:     "Webhook",
    description:     "Dispare um POST HTTPS assinado para qualquer endpoint externo com os dados do evento em tempo real.",
    category:        "Automação",
    version:         "1.0.0",
    authType:        "hmac",
    supportedEvents: ["*"],
    settingsSchema:  [
      { key: "url", label: "URL do Endpoint", type: "url", required: true, placeholder: "https://meusite.com/webhook", hint: "Deve ser HTTPS em produção" },
    ],
    secretsSchema: [
      { key: "hmac_secret", label: "HMAC Secret (opcional)", type: "password", required: false, placeholder: "segredo_para_assinar", hint: "Se definido, cada request terá o header X-Lancaster-Signature" },
    ],
  },
  {
    adapterName:     "crm",
    displayName:     "CRM",
    description:     "Sincronize leads e dados de formulários com seu CRM via API REST com mapeamento de campos personalizável.",
    category:        "CRM",
    version:         "1.0.0",
    authType:        "apiKey",
    supportedEvents: ["form.completed"],
    settingsSchema:  [
      { key: "endpoint", label: "API Endpoint", type: "url", required: true, placeholder: "https://crm.meusite.com/api/leads", hint: "Endpoint que receberá os dados do lead" },
    ],
    secretsSchema: [
      { key: "api_key", label: "API Key", type: "password", required: true, placeholder: "ck_live_xxxxx", hint: "Chave de autenticação do seu CRM" },
    ],
  },
];

export function getCatalogEntry(adapterName: string): IntegrationDefinition | undefined {
  return INTEGRATION_CATALOG.find(d => d.adapterName === adapterName);
}

export const ALL_FORM_EVENTS = [
  "form.started",
  "form.completed",
  "form.abandoned",
  "form.step.viewed",
  "form.step.answered",
];
