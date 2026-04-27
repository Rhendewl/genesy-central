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

  let body: AsaasAccount;
  try {
    body = await res.json() as AsaasAccount;
  } catch {
    return { valid: false, message: "Resposta do Asaas em formato inesperado." };
  }

  if (!body?.id) {
    console.error("[asaas-api] response missing id field:", JSON.stringify(body).slice(0, 200));
    return { valid: false, message: "Resposta do Asaas não contém dados de conta." };
  }

  console.log(`[asaas-api] ✓ validated account id=${body.id} name="${body.name}"`);
  return { valid: true, account: body };
}
