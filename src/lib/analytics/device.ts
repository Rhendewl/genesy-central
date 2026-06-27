// ─────────────────────────────────────────────────────────────────────────────
// Device / Browser / OS Detection
//
// Pure TypeScript — no React, no browser API calls in module scope.
// All functions receive the UA string and context as parameters for testability.
// ─────────────────────────────────────────────────────────────────────────────

export interface DeviceInfo {
  readonly device:   string;   // "mobile" | "tablet" | "desktop"
  readonly browser:  string;
  readonly os:       string;
  readonly language: string;
}

export interface UtmParams {
  readonly utm_source?:   string;
  readonly utm_medium?:   string;
  readonly utm_campaign?: string;
  readonly utm_term?:     string;
  readonly utm_content?:  string;
  readonly referrer?:     string;
}

// ── UA-based detection ────────────────────────────────────────────────────────

export function detectDevice(ua: string): string {
  const u = ua.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(u)) return "tablet";
  if (/mobile|android|iphone|ipod|blackberry|phone|windows phone/i.test(u)) return "mobile";
  return "desktop";
}

export function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua))        return "Edge";
  if (/opr\//i.test(ua))        return "Opera";
  if (/chrome/i.test(ua))       return "Chrome";
  if (/safari/i.test(ua))       return "Safari";
  if (/firefox/i.test(ua))      return "Firefox";
  if (/msie|trident/i.test(ua)) return "IE";
  return "Other";
}

export function detectOS(ua: string): string {
  if (/windows phone/i.test(ua)) return "Windows Phone";
  if (/android/i.test(ua))       return "Android";
  if (/ipad|iphone|ipod/i.test(ua)) return "iOS";
  if (/mac os/i.test(ua))        return "macOS";
  if (/windows/i.test(ua))       return "Windows";
  if (/linux/i.test(ua))         return "Linux";
  return "Other";
}

// ── Collect all device info from browser globals ──────────────────────────────

export function collectDeviceInfo(): DeviceInfo {
  const ua       = (typeof navigator !== "undefined" ? navigator.userAgent : "") ?? "";
  const language = (typeof navigator !== "undefined" ? navigator.language : "") ?? "";
  return {
    device:   detectDevice(ua),
    browser:  detectBrowser(ua),
    os:       detectOS(ua),
    language: language.split("-")[0] ?? "en",
  };
}

// ── UTM params from URL ───────────────────────────────────────────────────────

export function collectUtmParams(search?: string, referrer?: string): UtmParams {
  const query = search ?? (typeof location !== "undefined" ? location.search : "");
  const ref   = referrer ?? (typeof document !== "undefined" ? document.referrer : "");

  if (!query && !ref) return {};

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(query);
  } catch {
    /* v8 ignore next */
    params = new URLSearchParams();
  }

  const result: Record<string, string> = {};
  const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  for (let i = 0; i < utmKeys.length; i++) {
    const key = utmKeys[i];
    const val = params.get(key);
    if (val) result[key] = val;
  }
  if (ref) result.referrer = ref;

  return result as UtmParams;
}
