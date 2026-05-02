// Constantes de roles — sem "use client", pode ser importado em server e client
export type UserRole =
  | "admin"
  | "comercial"
  | "trafego"
  | "financeiro"
  | "operacional"
  | "viewer";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:       "Administrador",
  comercial:   "Comercial",
  trafego:     "Gestor de Tráfego",
  financeiro:  "Financeiro",
  operacional: "Operacional",
  viewer:      "Somente leitura",
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin:       "#f87171",
  comercial:   "#34d399",
  trafego:     "#60a5fa",
  financeiro:  "#facc15",
  operacional: "#a78bfa",
  viewer:      "rgba(255,255,255,0.35)",
};

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  admin:       ["dashboard", "crm", "clientes", "financeiro", "trafego", "portais", "configuracoes"],
  comercial:   ["dashboard", "crm", "clientes"],
  trafego:     ["dashboard", "trafego"],
  financeiro:  ["dashboard", "financeiro", "clientes"],
  operacional: ["dashboard", "crm", "clientes", "financeiro", "trafego", "portais"],
  viewer:      ["dashboard", "crm"],
};

export const ALL_MODULES = [
  { key: "dashboard",     label: "Dashboard" },
  { key: "crm",           label: "CRM" },
  { key: "clientes",      label: "Clientes" },
  { key: "financeiro",    label: "Financeiro" },
  { key: "trafego",       label: "Tráfego" },
  { key: "portais",       label: "Portais" },
  { key: "configuracoes", label: "Configurações" },
];
