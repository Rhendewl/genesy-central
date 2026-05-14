// ─────────────────────────────────────────────────────────────────────────────
// Asaas API — server-side only helpers
//
// Correct base URLs (confirmed via official docs at docs.asaas.com):
//   production: https://api.asaas.com/v3          ← /api/v3 does NOT exist
//   sandbox:    https://api-sandbox.asaas.com/v3  ← domain is api-sandbox, not sandbox
// ─────────────────────────────────────────────────────────────────────────────

export type AsaasEnv = "sandbox" | "production";

const BASE_URL: Record<AsaasEnv, string> = {
  production: "https://api.asaas.com/v3",
  sandbox:    "https://api-sandbox.asaas.com/v3",
};

export interface AsaasAccount {
  id?:         string;
  name:        string;
  email:       string;
  loginEmail?: string;
  cpfCnpj?:   string;
  personType?: string;
  walletId?:   string;
}

export type AsaasValidationResult =
  | { valid: true;  account: AsaasAccount }
  | { valid: false; message: string };

// Validates an API key by calling GET /myAccount.
// Returns the account object on success, or an error message on failure.
export async function validateAsaasKey(
  apiKey: string,
  env: AsaasEnv,
): Promise<AsaasValidationResult> {
  const url = `${BASE_URL[env]}/myAccount`;

  console.log(`[asaas-api] validateAsaasKey env=${env} url=${url}`);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        "access_token":  apiKey,
        "Content-Type":  "application/json",
        "User-Agent":    "lancaster-saas/1.0",
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[asaas-api] fetch error:`, msg);
    if (msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("abort")) {
      return { valid: false, message: "Conexão com o Asaas expirou. Tente novamente." };
    }
    return { valid: false, message: "Erro de rede ao conectar com o Asaas." };
  }

  console.log(`[asaas-api] response status=${res.status} env=${env}`);

  if (res.status === 401 || res.status === 403) {
    return { valid: false, message: "API Key inválida ou sem permissão de acesso." };
  }

  if (res.status === 404) {
    // Should not happen with correct URLs — log body to diagnose future regressions
    const body = await res.text().catch(() => "(sem body)");
    console.error(`[asaas-api] 404 on ${url} — body: ${body.slice(0, 300)}`);
    return { valid: false, message: "Endpoint não encontrado no Asaas (404). Contate o suporte Lancaster." };
  }

  if (res.status === 429) {
    return { valid: false, message: "Muitas requisições ao Asaas. Aguarde alguns segundos e tente novamente." };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[asaas-api] unexpected status=${res.status} body=${body.slice(0, 300)}`);
    return { valid: false, message: `Asaas retornou erro ${res.status}. Verifique sua API Key e tente novamente.` };
  }

  let body: Record<string, unknown>;
  try {
    body = await res.json() as Record<string, unknown>;
  } catch {
    return { valid: false, message: "Resposta do Asaas em formato inesperado." };
  }

  console.log("[asaas-api] response body:", JSON.stringify(body).slice(0, 400));

  // Asaas sometimes returns 200 with an errors array instead of a proper error status
  if (Array.isArray(body?.errors) && (body.errors as unknown[]).length > 0) {
    const firstError = (body.errors as Array<{ description?: string; code?: string }>)[0];
    const msg = firstError?.description ?? firstError?.code ?? "Erro retornado pelo Asaas.";
    console.warn("[asaas-api] asaas returned errors array:", body.errors);
    return { valid: false, message: msg };
  }

  // /myAccount does not return an 'id' field — validate by name presence instead
  if (!body?.name) {
    const keys = Object.keys(body ?? {}).join(", ") || "(vazio)";
    console.error("[asaas-api] response missing name field. keys:", keys);
    return { valid: false, message: "API Key inválida ou sem permissão de acesso." };
  }

  console.log(`[asaas-api] ✓ validated account name="${body.name}" cpfCnpj="${body.cpfCnpj}"`);
  return { valid: true, account: body as unknown as AsaasAccount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Asaas sync helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface AsaasPayment {
  id:               string;
  customer:         string;
  value:            number;
  netValue:         number;
  billingType:      string;
  status:           string;
  dueDate:          string;
  paymentDate:      string | null;
  confirmedDate:    string | null;
  dateCreated:      string;
  description:      string | null;
  externalReference: string | null;
  deleted:          boolean;
}

export interface AsaasCustomer {
  id:       string;
  name:     string;
  email:    string;
  cpfCnpj?: string;
}

interface AsaasListResponse<T> {
  hasMore:    boolean;
  totalCount: number;
  limit:      number;
  offset:     number;
  data:       T[];
}

async function asaasGet<T>(
  apiKey: string,
  env: AsaasEnv,
  path: string,
  params: Record<string, string> = {},
): Promise<AsaasListResponse<T>> {
  const url = new URL(`${BASE_URL[env]}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: {
      "access_token": apiKey,
      "Content-Type":  "application/json",
      "User-Agent":    "lancaster-saas/1.0",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Asaas ${path} error: ${res.status}`);
  return res.json() as Promise<AsaasListResponse<T>>;
}

export async function fetchAsaasPayments(
  apiKey: string,
  env: AsaasEnv,
  params: { offset?: number; limit?: number } = {},
): Promise<AsaasListResponse<AsaasPayment>> {
  return asaasGet<AsaasPayment>(apiKey, env, "/payments", {
    offset: String(params.offset ?? 0),
    limit:  String(params.limit  ?? 100),
  });
}

export async function fetchAsaasCustomers(
  apiKey: string,
  env: AsaasEnv,
): Promise<AsaasCustomer[]> {
  const all: AsaasCustomer[] = [];
  let offset = 0;
  const limit = 100;

  while (all.length < 1000) {
    const page = await asaasGet<AsaasCustomer>(apiKey, env, "/customers", {
      offset: String(offset),
      limit:  String(limit),
    });
    all.push(...page.data);
    if (!page.hasMore) break;
    offset += limit;
  }

  return all;
}
