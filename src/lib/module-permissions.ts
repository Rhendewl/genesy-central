// Permissões por submódulo — sem "use client", usado no servidor e no cliente.
//
// As chaves continuam morando em user_profiles.permissions (jsonb array):
//   "marketing"                        → módulo
//   "marketing.instagram"              → submódulo
//   "marketing.instagram.automations"  → aba do submódulo
//   "marketing.instagram:own"          → escopo (não é um nível da árvore)
//
// Compatibilidade: um nível sem nenhuma chave filha libera todos os filhos.
// Quem já tinha só "marketing" continua vendo o módulo inteiro; a restrição só
// começa quando ao menos um submódulo é marcado explicitamente.

export interface PermissionNode {
  key: string;
  label: string;
  description?: string;
  children?: PermissionNode[];
}

export const INSTAGRAM_OWN_ACCOUNTS_PERMISSION = "marketing.instagram:own";

export const MARKETING_SUBMODULES: PermissionNode[] = [
  {
    key: "marketing.instagram",
    label: "Central do Instagram",
    children: [
      { key: "marketing.instagram.reports", label: "Painel profissional" },
      { key: "marketing.instagram.overview", label: "Planejamento" },
      { key: "marketing.instagram.posts", label: "Publicações" },
      { key: "marketing.instagram.calendar", label: "Agenda" },
      { key: "marketing.instagram.automations", label: "Automações" },
    ],
  },
  { key: "marketing.concorrentes", label: "Concorrentes" },
  { key: "marketing.calendario", label: "Calendário Editorial" },
  { key: "marketing.gerador", label: "Gerador de Posts" },
  { key: "marketing.trafego", label: "Tráfego Pago" },
];

export const MODULE_SUBMODULES: Record<string, PermissionNode[]> = {
  marketing: MARKETING_SUBMODULES,
};

function isDirectChild(permission: string, parent: string) {
  if (!permission.startsWith(`${parent}.`)) return false;
  const rest = permission.slice(parent.length + 1);
  return rest.length > 0 && !rest.includes(".") && !rest.includes(":");
}

/** Confere uma chave hierárquica ("a.b.c") sem considerar papel de admin. */
export function hasPermissionKey(permissions: readonly string[] | null | undefined, key: string) {
  const list = permissions ?? [];
  const segments = key.split(".");
  if (!list.includes(segments[0])) return false;
  for (let depth = 1; depth < segments.length; depth += 1) {
    const parent = segments.slice(0, depth).join(".");
    const current = segments.slice(0, depth + 1).join(".");
    if (list.includes(current)) continue;
    if (list.some((permission) => isDirectChild(permission, parent))) return false;
  }
  return true;
}

/** Admin e dono da conta sempre passam. */
export function canAccess(permissions: readonly string[] | null | undefined, key: string, isAdmin: boolean) {
  return isAdmin || hasPermissionKey(permissions, key);
}

/** Membro que só enxerga as contas do Instagram que ele mesmo conectou. */
export function isInstagramOwnScoped(permissions: readonly string[] | null | undefined, isAdmin: boolean) {
  return !isAdmin && (permissions ?? []).includes(INSTAGRAM_OWN_ACCOUNTS_PERMISSION);
}

export function hasCrmAccess(permissions: readonly string[] | null | undefined, isAdmin: boolean) {
  return isAdmin || (permissions ?? []).includes("crm");
}

/** Chaves de módulo de primeiro nível (para contagens e selos). */
export function topLevelPermissions(permissions: readonly string[]) {
  return permissions.filter((permission) => !permission.includes(".") && !permission.includes(":"));
}

function descendants(node: PermissionNode): string[] {
  return (node.children ?? []).flatMap((child) => [child.key, ...descendants(child)]);
}

/** Todas as chaves de submódulo/aba de um módulo, para marcar tudo de uma vez. */
export function allSubmoduleKeys(moduleKey: string) {
  return (MODULE_SUBMODULES[moduleKey] ?? []).flatMap((node) => [node.key, ...descendants(node)]);
}

/**
 * Converte o estado antigo (sem filhos = tudo liberado) em chaves explícitas
 * para o editor mostrar as caixas marcadas corretamente.
 */
export function expandLegacyPermissions(permissions: readonly string[]) {
  const result = new Set(permissions);
  const expand = (parentKey: string, nodes: PermissionNode[]) => {
    if (!hasPermissionKey(Array.from(result), parentKey)) return;
    const restricted = nodes.some((node) => result.has(node.key));
    for (const node of nodes) {
      if (!restricted) result.add(node.key);
      if (node.children?.length && result.has(node.key)) expand(node.key, node.children);
    }
  };
  for (const [moduleKey, nodes] of Object.entries(MODULE_SUBMODULES)) expand(moduleKey, nodes);
  return Array.from(result);
}

/** Remove chaves de submódulo órfãs (módulo ou submódulo pai desmarcado). */
export function normalizePermissions(permissions: readonly string[]) {
  const set = new Set(permissions);
  return Array.from(set).filter((permission) => {
    const [tree] = permission.split(":");
    const segments = tree.split(".");
    for (let depth = 1; depth <= segments.length; depth += 1) {
      const ancestor = segments.slice(0, depth).join(".");
      if (ancestor !== permission && !set.has(ancestor)) return false;
    }
    return true;
  });
}

// ── Rotas do módulo Marketing ────────────────────────────────────────────────

const MARKETING_ROUTES: Array<{ prefix: string; key: string }> = [
  { prefix: "/marketing/relatorios", key: "marketing.instagram" },
  { prefix: "/marketing/automacoes", key: "marketing.instagram.automations" },
  { prefix: "/marketing/concorrentes", key: "marketing.concorrentes" },
  { prefix: "/marketing/calendario", key: "marketing.calendario" },
  { prefix: "/marketing/ideias", key: "marketing.calendario" },
  { prefix: "/marketing/assets", key: "marketing.calendario" },
  { prefix: "/marketing/gerador", key: "marketing.gerador" },
  { prefix: "/marketing/trafego", key: "marketing.trafego" },
];

export const MARKETING_SUBMODULE_HOME: Record<string, string> = {
  "marketing.instagram": "/marketing/relatorios",
  "marketing.concorrentes": "/marketing/concorrentes",
  "marketing.calendario": "/marketing/calendario",
  "marketing.gerador": "/marketing/gerador",
  "marketing.trafego": "/marketing/trafego",
};

export function marketingPermissionForPath(pathname: string) {
  return MARKETING_ROUTES.find((route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`))?.key ?? null;
}

export function firstMarketingHome(permissions: readonly string[] | null | undefined, isAdmin: boolean) {
  const first = MARKETING_SUBMODULES.find((node) => canAccess(permissions, node.key, isAdmin));
  return first ? MARKETING_SUBMODULE_HOME[first.key] : null;
}
