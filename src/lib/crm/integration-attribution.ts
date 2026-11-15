/** Separate tracking metadata at display time, preserving stored form answers. */
export function splitIntegrationNotes(notes?: string | null) {
  const answers: string[] = [];
  const attribution: { key: string; value: string }[] = [];

  for (const line of (notes || "").split(/\r?\n/)) {
    // Meta humanizes custom field labels ("utm_source" becomes "Utm Source").
    const match = line.match(/^\s*([^:]+?)\s*:\s*(.*)$/);
    const key = match?.[1].trim().toLowerCase().replace(/\s+/g, "_") ?? "";
    const isTracking = /^utm_[a-z0-9_]+$/.test(key)
      || ["fbclid", "gclid", "referrer", "campanha", "anúncio", "campaign_name", "ad_name"].includes(key);

    if (match && isTracking) {
      const value = match[2].trim();
      if (value && !attribution.some(item => item.key === key && item.value === value)) {
        attribution.push({ key, value });
      }
    } else {
      answers.push(line);
    }
  }

  return { answers: answers.join("\n").replace(/\n{3,}/g, "\n\n").trim(), attribution };
}
