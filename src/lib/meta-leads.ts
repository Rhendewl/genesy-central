// ── Meta Lead Gen API ─────────────────────────────────────────────────────────
// Fetches full lead data from Graph API given a leadgen_id.
// Called from the webhook handler after receiving a leadgen event.

const GRAPH = "https://graph.facebook.com/v21.0";

// Fields considered "standard" — not shown as custom questions in notes
const STANDARD_FIELDS = new Set([
  "first_name", "last_name", "full_name",
  "email", "phone_number", "phone", "telefone",
  "city", "cidade",
  "state", "country", "zip_code", "postal_code",
  "street_address", "date_of_birth", "gender",
  "company_name", "job_title", "work_phone_number",
]);

export interface MetaLeadData {
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
  const url = `${GRAPH}/${leadgenId}?fields=${fields}&access_token=${accessToken}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(body?.error?.message ?? `Meta Graph API ${res.status}`);
  }

  const data = await res.json() as LeadGenResponse;

  // Flatten field_data into a lowercase key → value map
  const fm: Record<string, string> = {};
  for (const f of data.field_data ?? []) {
    fm[f.name.toLowerCase()] = f.values[0] ?? "";
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

  // Collect custom fields (anything not in the standard set)
  const custom_fields: { label: string; value: string }[] = [];
  for (const [key, value] of Object.entries(fm)) {
    if (!STANDARD_FIELDS.has(key) && value.trim()) {
      custom_fields.push({ label: humanizeLabel(key), value });
    }
  }

  return {
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
