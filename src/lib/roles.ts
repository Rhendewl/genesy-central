// Constantes de roles — sem "use client", pode ser importado em server e client
//
// "comercial" e "trafego" são os valores históricos do enum (mantidos sem
// migração de dados); os rótulos abaixo já usam a linguagem de papéis pedida
// (SDR, Gestor de Tráfego). "designer" e "gestor_comercial" são novos.
export type UserRole =
  | "admin"
  | "comercial"
  | "trafego"
  | "financeiro"
  | "operacional"
  | "viewer"
  | "designer"
  | "gestor_comercial";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:            "Administrador",
  comercial:        "SDR",
  trafego:          "Gestor de Tráfego",
  financeiro:       "Financeiro",
  operacional:      "Operacional",
  viewer:           "Somente leitura",
  designer:         "Designer",
  gestor_comercial: "Gestor Comercial",
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin:            "#f87171",
  comercial:        "#34d399",
  trafego:          "#60a5fa",
  financeiro:       "#facc15",
  operacional:      "#a78bfa",
  viewer:           "rgba(255,255,255,0.35)",
  designer:         "#f472b6",
  gestor_comercial: "#fb923c",
};

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  admin:            ["dashboard", "workspace", "crm", "clientes", "financeiro", "trafego", "marketing", "performance", "portais", "formularios", "configuracoes"],
  comercial:        ["dashboard", "crm", "clientes", "formularios"],
  trafego:          ["dashboard", "trafego"],
  financeiro:       ["dashboard", "financeiro", "clientes"],
  operacional:      ["dashboard", "workspace", "crm", "clientes", "financeiro", "trafego", "marketing", "portais", "formularios"],
  viewer:           ["dashboard", "crm"],
  designer:         ["dashboard", "workspace", "formularios"],
  gestor_comercial: ["dashboard", "crm", "clientes", "formularios"],
};

export const ALL_MODULES = [
  { key: "dashboard",     label: "Dashboard" },
  { key: "workspace",     label: "Workspace" },
  { key: "crm",           label: "CRM" },
  { key: "clientes",      label: "Clientes" },
  { key: "financeiro",    label: "Financeiro" },
  { key: "trafego",       label: "Tráfego" },
  { key: "marketing",     label: "Marketing" },
  { key: "performance",   label: "Performance" },
  { key: "portais",       label: "Portais" },
  { key: "formularios",   label: "Formulários" },
  { key: "configuracoes", label: "Configurações" },
];
