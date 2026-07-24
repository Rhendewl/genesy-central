export type AuthType = "apiKey" | "hmac" | "oauth" | "none";

export interface FieldDefinition {
  key:          string;
  label:        string;
  type:         "text" | "password" | "url" | "number" | "textarea" | "select";
  required:     boolean;
  placeholder?: string;
  hint?:        string;
  defaultValue?: string;
  options?: Array<{ value: string; label: string }>;
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
    supportedEvents: ["form.phone.answered"],
    settingsSchema:  [
      { key: "pixelId", label: "Pixel ID", type: "text", required: true, placeholder: "123456789012345", hint: "Encontre em Gerenciador de Eventos → Configurações" },
      {
        key: "mode", label: "Modo de envio", type: "select", required: true, defaultValue: "both",
        hint: "Browser + CAPI usa o mesmo event_id para evitar conversões duplicadas.",
        options: [
          { value: "browser", label: "Browser (Meta Pixel)" },
          { value: "capi", label: "Conversions API" },
          { value: "both", label: "Browser + Conversions API" },
        ],
      },
      { key: "test_event_code", label: "Test Event Code", type: "text", required: false, placeholder: "TEST12345", hint: "Opcional. Use para validar no Gerenciador de Eventos da Meta." },
    ],
    secretsSchema: [
      { key: "access_token", label: "Access Token", type: "password", required: false, placeholder: "EAAxxxxxxxxxxxxx...", hint: "Obrigatório para os modos CAPI e Browser + CAPI." },
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
    supportedEvents: ["form.submission.completed"],
    settingsSchema:  [
      { key: "url", label: "URL do Endpoint", type: "url", required: true, placeholder: "https://meusite.com/webhook", hint: "Deve ser HTTPS em produção" },
    ],
    secretsSchema: [
      { key: "hmac_secret", label: "HMAC Secret (opcional)", type: "password", required: false, placeholder: "segredo_para_assinar", hint: "Se definido, cada request terá os headers X-Genesy-Signature e X-Lancaster-Signature" },
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
  "form.phone.answered",
  "form.submission.completed",
  "form.started",
  "form.completed",
  "form.abandoned",
  "form.step.viewed",
  "form.step.answered",
];
