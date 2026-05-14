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
  id:          string;
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

  if (!body?.id) {
    const keys = Object.keys(body ?? {}).join(", ") || "(vazio)";
    console.error("[asaas-api] response missing id field. keys:", keys, "body:", JSON.stringify(body).slice(0, 400));
    return { valid: false, message: `Resposta do Asaas não contém 'id'. Campos recebidos: [${keys}]. Verifique se a API Key e o ambiente (sandbox/produção) estão corretos.` };
  }

  console.log(`[asaas-api] ✓ validated account id=${body.id} name="${body.name}"`);
  return { valid: true, account: body as unknown as AsaasAccount };
}
