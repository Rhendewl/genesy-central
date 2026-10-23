// ── Meta Lead Gen API ─────────────────────────────────────────────────────────
// Fetches full lead data from Graph API given a leadgen_id.
// Called from the webhook handler after receiving a leadgen event.

const GRAPH = "https://graph.facebook.com/v21.0";

export interface MetaLeadData {
  answers: { name: string; values: string[] }[];
  first_name:     string;
  full_name:      string;
  phone:          string | null;
  email:          string | null;
  city:           string | null;
  campaign_name:  string | null;
  ad_name:        string | null;
  custom_fields:  { label: string; value: string }[];
}

interface LeadGenResponse {
  id:             string;
  field_data:     { name: string; values: string[] }[];
  ad_id?:         string;
  ad_name?:       string;
  adset_id?:      string;
  adset_name?:    string;
  campaign_id?:   string;
  campaign_name?: string;
  created_time?:  string;
}

function humanizeLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

export async function fetchMetaLead(
  leadgenId: string,
  accessToken: string
): Promise<MetaLeadData> {
  const fields =
    "field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,created_time";
  const url = `${GRAPH}/${encodeURIComponent(leadgenId)}?fields=${fields}`;

  const res = await fetch(url, { cache: "no-store", headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(body?.error?.message ?? `Meta Graph API ${res.status}`);
  }

  const data = await res.json() as LeadGenResponse;

  // Flatten field_data into a lowercase key → value map
  const fm: Record<string, string> = {};
  for (const f of data.field_data ?? []) {
    fm[f.name.toLowerCase()] = f.values.join("; ");
  }

  const first_name = fm["first_name"] || fm["nome"] || "";
  const last_name  = fm["last_name"]  || fm["sobrenome"] || "";

  const full_name =
    fm["full_name"] ||
    [first_name, last_name].filter(Boolean).join(" ") ||
    "";

  const phone = fm["phone_number"] || fm["phone"] || fm["telefone"] || null;
  const email = fm["email"] || null;
  const city  = fm["city"] || fm["cidade"] || null;

  // Preserve every answer, including standard fields and multiple selections.
  const custom_fields: { label: string; value: string }[] = [];
  for (const [key, value] of Object.entries(fm)) {
    if (value.trim()) {
      custom_fields.push({ label: humanizeLabel(key), value });
    }
  }

  return {
    answers: data.field_data ?? [],
    first_name: first_name || full_name.split(" ")[0] || "Lead",
    full_name,
    phone,
    email,
    city,
    campaign_name: data.campaign_name ?? null,
    ad_name:       data.ad_name       ?? null,
    custom_fields,
  };
}
