export const CONSENT =
  "Li integralmente este contrato e concordo em assiná-lo eletronicamente, registrando meu nome, CPF/CNPJ, data, horário e dados técnicos de acesso associados ao documento.";
export const ROLES = ["cliente", "socio", "testemunha", "contratada"] as const;
export type ContractRole = (typeof ROLES)[number];
export interface ContractProfile {
  name: string;
  document: string;
  address: string;
}
export interface ContractTemplate {
  id: string;
  name: string;
  body: string;
}
export interface ContractSigner {
  id: string;
  name: string;
  email: string;
  role: ContractRole;
  signed_at: string | null;
  signed_name?: string;
  signed_document?: string;
  expected_document?: string;
  consent_text?: string;
  document_hash?: string;
  ip?: string;
  user_agent?: string;
  url?: string;
}
export interface ContractDocument {
  id: string;
  title: string;
  body: string;
  content_hash: string;
  status: "pending" | "signed" | "cancelled";
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  client_id: string | null;
  client_data: Record<string, string | number>;
  signers: ContractSigner[];
}
export function templateFields(body: string): string[] {
  return Array.from(
    new Set(
      Array.from(body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map(
        (m) => m[1],
      ),
    ),
  );
}
export function renderContract(
  body: string,
  values: Record<string, string>,
): string {
  const missing = templateFields(body).filter(
    (key) => !values[key]?.trim() && !key.endsWith("_endereco") && !key.startsWith("testemunha") && !/(?:^|_)email(?:_|$)/.test(key),
  );
  if (missing.length)
    throw new Error(`Preencha os campos: ${missing.join(", ")}`);
  return body.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_, key: string) => values[key]?.trim() ?? "",
  );
}
export function requiredText(value: unknown, label: string, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Error(`${label} é obrigatório (até ${max} caracteres)`);
  return value.trim();
}

export const CLIENT_COMPANY_TYPES = [
 {value:'imobiliaria',label:'Imobiliária'}, {value:'corretor',label:'Corretor'},
 {value:'construtora',label:'Construtora'}, {value:'outro',label:'Outro'},
] as const;
