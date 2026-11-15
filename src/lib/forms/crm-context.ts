/** Build the CRM display name from the original answer on every partial save. */
export function formatFormLeadName(name: string | null | undefined, suffix: unknown): string {
  const label = typeof suffix === "string" ? suffix.trim().slice(0, 100) : "";
  return `${name?.trim() || "Sem nome"}${label ? ` | ${label}` : ""}`;
}

export function formAttributionLines(attribution: Record<string, unknown> | null | undefined): string[] {
  return ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "referrer"]
    .flatMap(key => {
      const value = attribution?.[key];
      return typeof value === "string" && value.trim() ? [`${key}: ${value.trim().replace(/[\r\n]+/g, " ")}`] : [];
    });
}
