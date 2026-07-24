"use client";

// ── Module-level singletons (survive React re-renders and route changes) ────────

/** Pixel IDs that have been initialized this browser session. */
const _initializedPixels = new Set<string>();

/** `"${pixelId}:${pathname}"` entries that have fired PageView. */
const _pageViewFired = new Set<string>();

// ── Internal helpers ───────────────────────────────────────────────────────────

/** Injects the Meta Pixel SDK bootstrap script exactly once per page session.
 *  The bootstrap creates `window.fbq` as a synchronous queue function;
 *  fbevents.js loads asynchronously and drains the queue when ready.
 *  No-op if `window.fbq` already exists (e.g. loaded via GTM or another script). */
function ensureFbqScript(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if ((window as unknown as Record<string, unknown>).fbq) return;
  if (document.getElementById("fbq-sdk")) return;

  const s = document.createElement("script");
  s.id    = "fbq-sdk";
  /* eslint-disable */
  s.innerHTML =
    "!function(f,b,e,v,n,t,s){" +
    "if(f.fbq)return;n=f.fbq=function(){" +
    "n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};" +
    "if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';" +
    "n.queue=[];t=b.createElement(e);t.async=!0;" +
    "t.src=v;s=b.getElementsByTagName(e)[0];" +
    "s.parentNode.insertBefore(t,s)}" +
    "(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');";
  /* eslint-enable */
  document.head.appendChild(s);
}

function call(...args: unknown[]): void {
  const fn = (window as unknown as Record<string, unknown>).fbq as ((...a: unknown[]) => void) | undefined;
  if (typeof fn === "function") fn(...args);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Initializes a Meta Pixel. Safe to call multiple times — the second call for the
 * same pixelId is a no-op (Meta's SDK also ignores duplicate inits, but we skip the
 * call entirely to stay safe in SPA scenarios).
 */
export function initPixel(pixelId: string): void {
  if (typeof window === "undefined") return;
  if (_initializedPixels.has(pixelId)) return;

  ensureFbqScript();
  call("init", pixelId);
  // Desativa eventos sugeridos/detectados automaticamente pelo Meta, como
  // SubscribedButtonClick. O formulário envia somente os eventos explícitos.
  call("set", "autoConfig", false, pixelId);
  _initializedPixels.add(pixelId);
}

/**
 * Fires `PageView` for the given pixel on the current pathname.
 * No-op if PageView was already fired for this `pixelId + pathname` pair
 * (prevents duplicates during SPA navigation and hot-reloads).
 */
export function trackPageView(pixelId: string): void {
  if (typeof window === "undefined") return;

  const key = `${pixelId}:${window.location.pathname}`;
  if (_pageViewFired.has(key)) return;

  initPixel(pixelId);
  // trackSingle targets only this pixelId, preventing cross-pixel duplication
  call("trackSingle", pixelId, "PageView");
  _pageViewFired.add(key);
}

/**
 * Fires a standard conversion event.
 * `eventId` is shared with the Conversions API call for browser-side deduplication.
 * Initializes the pixel if not yet done.
 */
export function trackConversion(
  pixelId:   string,
  eventName: string,
  eventId:   string,
  data?:     Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;

  initPixel(pixelId);
  // trackSingle targets only this pixelId so multiple pixels don't double-fire
  call("trackSingle", pixelId, eventName, data ?? {}, { eventID: eventId });
}
