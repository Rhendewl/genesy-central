// Pixel do Facebook (Meta). O ID vem da configuração do módulo "Site Genesy" na plataforma,
// então ligar, desligar ou trocar o Pixel não exige publicar o site de novo.

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[][]; loaded: boolean; version: string; push: unknown };
declare global { interface Window { fbq?: Fbq; _fbq?: Fbq } }

let scriptLoaded = false;

export function newEventId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function cookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Identificadores do Facebook usados para casar o evento do servidor com o visitante. */
export function pixelIdentifiers() {
  let fbc = cookie("_fbc");
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (!fbc && fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
  return { fbp: cookie("_fbp"), fbc, url: window.location.href };
}

/** Carrega o script oficial do Pixel. Resolve com `true` se carregou, `false` se foi bloqueado. */
export function loadPixel(pixelId: string): Promise<boolean> {
  if (window.fbq) return Promise.resolve(scriptLoaded);
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq; fbq.loaded = true; fbq.version = "2.0"; fbq.queue = [];
  window.fbq = fbq; if (!window._fbq) window._fbq = fbq;
  fbq("init", pixelId);
  return new Promise(resolve => {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.onload = () => { scriptLoaded = true; resolve(true); };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
    window.setTimeout(() => resolve(scriptLoaded), 6000);
  });
}

export function trackPixel(event: string, eventId: string, params: Record<string, unknown> = {}) {
  window.fbq?.("track", event, params, { eventID: eventId });
  return scriptLoaded;
}
