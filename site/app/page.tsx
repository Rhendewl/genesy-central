"use client";

import { useEffect, useRef, useState } from "react";
import Beams from "./Beams";
import GlassSurface from "./GlassSurface";
import Stack from "./Stack";

const ANALYTICS_URL = "https://dash.genesycompany.com/api/site/genesycompany";
const TESTIMONIAL_IMAGES = Array.from({ length: 10 }, (_, index) => `/testimonials/${index + 1}.webp`);
const HERO_WORDS = ["incorporadora", "imobiliária", "construtora"];
const CONSULTATION_CARDS = [
  {
    title: "Raio-X da sua operação",
    icon: "◎",
    text: "Fazemos uma análise completa de como sua operação está gerando e atendendo leads hoje. Identificamos os gargalos que estão travando suas vendas — na captação, no atendimento ou no funil.",
  },
  {
    title: "O que sua operação precisa",
    icon: "⌁",
    text: "Com base no diagnóstico, mostramos exatamente o que precisa mudar e qual é o próximo passo para sair da dependência de indicação e começar a vender com método.",
  },
  {
    title: "Plano de ação para captar leads",
    icon: "↗",
    text: "Entregamos um plano estratégico personalizado com as ações concretas para atrair compradores com real intenção de compra e aumentar a taxa de conversão do seu time de corretores.",
  },
];
const SYSTEM_PILLARS = [
  {
    title: "Captação qualificada",
    shortTitle: "Captação",
    text: "Campanhas com linguagem, segmentação e estrutura 100% focadas no consumidor qualificado do mercado imobiliário.",
  },
  {
    title: "Alinhamento comercial",
    shortTitle: "Alinhamento",
    text: "Alinhamos marketing e comercial para que cada contato seja aproveitado da forma certa, sem fricção.",
  },
  {
    title: "Conversão",
    shortTitle: "Conversão",
    text: "Acompanhamos o funil e identificamos onde as oportunidades estão escapando. Mais contratos no mesmo volume.",
  },
  {
    title: "Inteligência de Dados",
    shortTitle: "Inteligência",
    text: "Cada dado gera novos aprendizados ao sistema, captando leads mais qualificados.",
  },
];

function TypewriterWord() {
  const [wordIndex, setWordIndex] = useState(0);
  const [typedWord, setTypedWord] = useState(HERO_WORDS[0]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const currentWord = HERO_WORDS[wordIndex];
    let delay = deleting ? 52 : 82;

    if (!deleting && typedWord === currentWord) delay = 2500;
    if (deleting && typedWord === "") delay = 180;

    const timer = window.setTimeout(() => {
      if (!deleting && typedWord === currentWord) {
        setDeleting(true);
        return;
      }
      if (deleting && typedWord === "") {
        setWordIndex((wordIndex + 1) % HERO_WORDS.length);
        setDeleting(false);
        return;
      }
      setTypedWord(
        deleting
          ? currentWord.slice(0, Math.max(0, typedWord.length - 1))
          : currentWord.slice(0, typedWord.length + 1),
      );
    }, delay);

    return () => window.clearTimeout(timer);
  }, [deleting, typedWord, wordIndex]);

  return <span>{typedWord}</span>;
}

function SectionTag({ children }: { children: React.ReactNode }) {
  return <div className="section-tag">{children}</div>;
}

function CTA({
  children,
  href = "#cta",
  light = false,
}: {
  children: React.ReactNode;
  href?: string;
  light?: boolean;
}) {
  return (
    <a className={`button ${light ? "button-light" : ""}`} href={href}>
      <span>{children}</span>
    </a>
  );
}

function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        const start = performance.now();
        const duration = 1500;
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - progress, 4);
          const current = value * eased;
          node.textContent = `${prefix}${current.toLocaleString("pt-BR", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })}${suffix}`;
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [decimals, prefix, suffix, value]);

  return <span ref={ref}>{prefix}0{suffix}</span>;
}

const REEL_SPINS = 3;
const REEL_DIGITS = Array.from({ length: (REEL_SPINS + 1) * 10 }, (_, index) => index % 10);

function SpinningCounter({ value, label }: { value: string; label: string }) {
  let digitIndex = 0;

  return (
    <span className="t-reel" aria-label={label}>
      {Array.from(value).map((character, index) => {
        if (!/\d/.test(character)) {
          return <span className="t-reel-separator" aria-hidden="true" key={`${character}-${index}`}>{character}</span>;
        }

        const stop = REEL_SPINS * 10 + Number(character);
        const delay = digitIndex * 90;
        digitIndex += 1;

        return (
          <span className="t-reel-col" aria-hidden="true" key={`digit-${index}`}>
            <span
              className="t-reel-strip"
              style={{
                "--reel-offset": `-${stop}em`,
                "--reel-delay": `${delay}ms`,
              } as React.CSSProperties}
            >
              {REEL_DIGITS.map((digit, reelIndex) => (
                <span className="t-reel-digit" key={`${index}-${reelIndex}`}>{digit}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

const faqs = [
  {
    q: "Para quem é a consultoria?",
    a: "Para imobiliárias, construtoras e incorporadoras que investem acima de R$ 5.000 em anúncios online e querem sair da dependência de indicação e leads frios para construir um processo previsível de vendas.",
  },
  {
    q: "Quanto custa?",
    a: "A consultoria estratégica inicial é gratuita — entregamos diagnóstico + plano de ação personalizado. Após essa etapa, apresentamos os formatos de operação conjunta de acordo com o porte e objetivo da sua imobiliária.",
  },
  {
    q: "Como funciona o atendimento?",
    a: "Totalmente remoto. A consultoria acontece por videoconferência em duas sessões: diagnóstico e apresentação do plano. Ao longo da operação, temos rituais semanais e acesso direto via WhatsApp/Slack.",
  },
  {
    q: "Em quanto tempo vejo resultado?",
    a: "O diagnóstico é entregue em até 7 dias. Os primeiros leads qualificados costumam chegar nas 2 primeiras semanas após implementação. Fechamentos começam a aparecer entre 30 e 60 dias — com curva ascendente a partir do 3º mês.",
  },
  {
    q: "Vocês atendem qualquer cidade?",
    a: "Sim, trabalhamos com imobiliárias em todo o Brasil. Nossa metodologia se adapta ao ticket médio, ao perfil do comprador e ao ciclo de venda típico da sua região.",
  },
];

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const transitionRef = useRef<HTMLDivElement>(null);
  const systemRef = useRef<HTMLDivElement>(null);
  const navProgressRef = useRef<HTMLSpanElement>(null);
  const siteSessionToken = useRef<string | null>(null);

  useEffect(() => {
    let activeSeconds = 0;
    let lastTick = Date.now();
    let stopped = false;
    const params = new URLSearchParams(window.location.search);
    const visitorKey = "genesy_site_visitor";
    let visitorId: string | null = null;
    try { visitorId = localStorage.getItem(visitorKey); } catch { visitorId = null; }
    if (!visitorId) {
      visitorId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      try { localStorage.setItem(visitorKey, visitorId); } catch { /* navegação privada */ }
    }
    const device = window.matchMedia("(max-width: 767px)").matches ? "mobile" : window.matchMedia("(max-width: 1100px)").matches ? "tablet" : "desktop";
    const browser = /Edg/i.test(navigator.userAgent) ? "Edge" : /Chrome/i.test(navigator.userAgent) ? "Chrome" : /Safari/i.test(navigator.userAgent) ? "Safari" : /Firefox/i.test(navigator.userAgent) ? "Firefox" : "Outro";
    const payload = {
      visitor_id: visitorId, path: window.location.pathname, referrer: document.referrer,
      utm_source: params.get("utm_source") ?? undefined, utm_medium: params.get("utm_medium") ?? undefined,
      utm_campaign: params.get("utm_campaign") ?? undefined, utm_term: params.get("utm_term") ?? undefined,
      utm_content: params.get("utm_content") ?? undefined, device, browser, language: navigator.language,
    };
    const viewed = new Set<string>();
    const sendEvents = (events: Array<Record<string, unknown>>) => {
      if (!siteSessionToken.current || !events.length) return;
      void fetch(`${ANALYTICS_URL}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: siteSessionToken.current, events }), keepalive: true }).catch(() => undefined);
    };
    const observer = new IntersectionObserver(entries => {
      const events: Array<Record<string, unknown>> = [];
      entries.forEach(entry => {
        const section = (entry.target as HTMLElement).id;
        if (entry.isIntersecting && section && !viewed.has(section)) {
          viewed.add(section);
          events.push({ type: "section_view", section, path: window.location.pathname, idempotency_key: `${siteSessionToken.current}:${section}` });
        }
      });
      sendEvents(events);
    }, { threshold: 0.45 });
    // Cliques em botões e links (CTA, WhatsApp, Instagram, navegação) para o painel Site Genesy.
    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("a, button");
      if (!target) return;
      const href = target instanceof HTMLAnchorElement ? target.getAttribute("href") ?? "" : "";
      const label = (target.getAttribute("aria-label") || target.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
      const kind = /wa\.me|whatsapp/i.test(href) ? "whatsapp" : /instagram\.com/i.test(href) ? "instagram" : href.startsWith("#") ? "navegacao" : href.includes("/form/") ? "formulario" : target.tagName === "BUTTON" ? "botao" : "link";
      const section = target.closest<HTMLElement>("section[id]")?.id ?? (target.closest("nav, header") ? "menu" : target.closest("footer") ? "rodape" : null);
      sendEvents([{ type: "click", section, path: window.location.pathname, metadata: { label, href, kind } }]);
    };
    document.addEventListener("click", onClick, { capture: true });
    fetch(`${ANALYTICS_URL}/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(response => response.ok ? response.json() : null)
      .then(json => {
        if (!json?.token || stopped) return;
        siteSessionToken.current = json.token;
        document.querySelectorAll<HTMLElement>("section[id]").forEach(section => observer.observe(section));
        sendEvents([{ type: "page_view", path: window.location.pathname, idempotency_key: `${json.token}:page` }]);
      }).catch(() => undefined);
    const heartbeat = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible" && document.hasFocus()) activeSeconds += Math.min(15, Math.round((now - lastTick) / 1000));
      lastTick = now;
      if (siteSessionToken.current) void fetch(`${ANALYTICS_URL}/session`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: siteSessionToken.current, active_seconds: activeSeconds }), keepalive: true }).catch(() => undefined);
    }, 15000);
    const finish = () => {
      if (!siteSessionToken.current) return;
      void fetch(`${ANALYTICS_URL}/session`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: siteSessionToken.current, active_seconds: activeSeconds, ended: true }), keepalive: true }).catch(() => undefined);
    };
    window.addEventListener("pagehide", finish);
    return () => { stopped = true; observer.disconnect(); window.clearInterval(heartbeat); window.removeEventListener("pagehide", finish); document.removeEventListener("click", onClick, { capture: true }); };
  }, []);

  async function submitLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingLead) return;
    setSubmittingLead(true);
    setLeadError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    // Envia o texto escolhido (ex.: "Até R$ 500 mil"), não o código interno da opção.
    const optionText = (name: string) => form.querySelector<HTMLSelectElement>(`select[name="${name}"]`)?.selectedOptions[0]?.text ?? data.get(name);
    try {
      const response = await fetch(`${ANALYTICS_URL}/lead`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: siteSessionToken.current, name: data.get("nome"), phone: data.get("whatsapp"), profile: optionText("perfil"), monthly_vgv: optionText("vgv"), website: data.get("website") }),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      setLeadSent(true);
    } catch {
      setLeadError("Não foi possível enviar agora. Tente novamente em instantes ou fale com a gente pelo WhatsApp.");
    } finally {
      setSubmittingLead(false);
    }
  }

  useEffect(() => {
    let frame = 0;
    const updateScrollProgress = () => {
      frame = 0;
      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / scrollable));
      if (navProgressRef.current) {
        navProgressRef.current.style.transform = `scaleX(${progress})`;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateScrollProgress);
    };
    updateScrollProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const stage = transitionRef.current;
    if (!stage) return;
    const scene = stage.querySelector<HTMLElement>(".transition-video-scene");
    const results = stage.querySelector<HTMLElement>(".results-stage-content");
    const storyHeadline = stage.querySelector<HTMLElement>(".results-story-headline");
    const storyStatOne = stage.querySelector<HTMLElement>(".results-story-stat-one");
    const consultation = stage.querySelector<HTMLElement>(".transition-consult-copy");
    const consultationCards = stage.querySelector<HTMLElement>(".transition-consult-cards");
    const consultationCardItems = Array.from(
      stage.querySelectorAll<HTMLElement>(".transition-consult-card"),
    );
    const transitionCta = stage.querySelector<HTMLElement>(".transition-cta-wrap");
    const nav = document.querySelector<HTMLElement>(".nav");
    if (!scene || !results || !storyHeadline || !storyStatOne || !consultation || !consultationCards || !transitionCta) return;

    let ticking = false;
    const smooth = (value: number) => value * value * (3 - 2 * value);
    const softer = (value: number) => (1 - Math.cos(Math.PI * value)) / 2;
    const range = (value: number, from: number, to: number) =>
      smooth(Math.min(1, Math.max(0, (value - from) / (to - from))));
    const softRange = (value: number, from: number, to: number) =>
      softer(Math.min(1, Math.max(0, (value - from) / (to - from))));

    const updateTransition = () => {
      ticking = false;
      const rect = stage.getBoundingClientRect();
      const progressRect = rect;
      const progressHeight = stage.offsetHeight;
      const distance = Math.max(1, progressHeight - window.innerHeight);
      const progress = Math.min(
        1,
        Math.max(0, -progressRect.top / distance),
      );
      const setStoryPanel = (element: HTMLElement, start: number, end: number) => {
        const active = progress >= start && progress < end;
        element.classList.toggle("is-shown", active);
        element.classList.toggle("is-hiding", progress >= end);
      };
      setStoryPanel(storyHeadline, 0.015, 0.22);
      setStoryPanel(storyStatOne, 0.24, 0.44);

      const layerEnter = softRange(progress, 0.42, 0.52);
      const consultationEnter = range(progress, 0.52, 0.59);
      const consultationExit = softRange(progress, 0.875, 0.925);
      const ctaEnter = softRange(progress, 0.885, 0.94);
      const consultationVisibility = consultationEnter * (1 - consultationExit);

      results.style.opacity = "1";
      results.style.transform = "none";
      results.style.filter = "none";
      results.style.pointerEvents = layerEnter > 0.04 ? "none" : "auto";
      scene.style.transform = `translateY(${(1 - layerEnter) * 100}%)`;
      consultation.style.opacity = `${consultationVisibility}`;
      consultation.style.transform = `translate(-50%,${28 * (1 - consultationEnter) - 18 * consultationExit}px)`;
      consultationCards.style.opacity = `${1 - consultationExit}`;
      const cardEnters = [
        range(progress, 0.58, 0.62),
        range(progress, 0.7, 0.74),
        range(progress, 0.82, 0.86),
      ];
      consultationCardItems.forEach((card, index) => {
        const cardEnter = cardEnters[index];
        const laterCards = cardEnters.slice(index + 1);
        const depth = laterCards.reduce((total, value) => total + value, 0);
        const visibility = cardEnter * Math.max(0.34, 1 - depth * 0.28) * (1 - consultationExit);
        card.style.opacity = `${visibility}`;
        card.style.transform = `translateY(${28 * (1 - cardEnter) - depth * 14}px) scale(${0.975 + cardEnter * 0.025 - depth * 0.018})`;
        card.style.zIndex = `${10 + index}`;
      });
      transitionCta.classList.toggle("is-shown", ctaEnter > 0.06);
      transitionCta.classList.toggle("is-hiding", ctaEnter <= 0.06);
      transitionCta.style.opacity = `${ctaEnter}`;
      transitionCta.style.transform = `translateY(${14 * (1 - ctaEnter)}px)`;
      transitionCta.style.pointerEvents = ctaEnter > 0.92 ? "auto" : "none";

      const activeRect = rect;
      const darkVideo = layerEnter > 0.55 && ctaEnter < 0.45 && activeRect.bottom > 80;
      nav?.classList.toggle("nav-dark", darkVideo);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateTransition);
    };

    const onResize = () => {
      updateTransition();
    };

    updateTransition();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      nav?.classList.remove("nav-dark");
    };
  }, []);

  useEffect(() => {
    const stage = systemRef.current;
    if (!stage) return;
    const orbitContent = stage.querySelector<HTMLElement>(".system-orbit-content");
    const cards = Array.from(stage.querySelectorAll<HTMLElement>(".pillar-story-card"));
    if (!orbitContent || cards.length !== SYSTEM_PILLARS.length) return;

    let ticking = false;
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    const smooth = (value: number) => value * value * value * (value * (value * 6 - 15) + 10);
    const range = (value: number, from: number, to: number) =>
      smooth(clamp((value - from) / (to - from)));
    const cardStarts = [0.2, 0.4, 0.6, 0.8];

    const updateSystemStory = () => {
      ticking = false;
      const rect = stage.getBoundingClientRect();
      const distance = Math.max(1, stage.offsetHeight - window.innerHeight);
      const progress = clamp(-rect.top / distance);
      const retract = range(progress, 0.08, 0.23);

      orbitContent.style.opacity = `${1 - retract}`;
      orbitContent.style.transform = `scale(${1 - retract * 0.84})`;
      orbitContent.style.filter = `blur(${retract * 7}px)`;

      const enters = cardStarts.map((start) => range(progress, start, start + 0.14));
      const landings = cardStarts.map((start) => range(progress, start + 0.07, start + 0.14));
      const firstCardInitialScale = window.innerWidth <= 780 ? 0.52 : 0.48;
      cards.forEach((card, index) => {
        const enter = enters[index];
        const depth = landings.slice(index + 1).reduce((total, value) => total + value, 0);
        const entranceScale = index === 0
          ? firstCardInitialScale + enter * (1 - firstCardInitialScale)
          : 0.84 + enter * 0.16;
        const scale = index === 0
          ? Math.max(firstCardInitialScale, entranceScale - depth * 0.025)
          : Math.max(0.86, entranceScale - depth * 0.025);
        const entranceY = index === 0 ? 0 : 118 * (1 - enter);
        const stackY = -14 * depth;
        const opacity = enter >= 0.995
          ? Math.max(0.3, 1 - depth * 0.22)
          : enter * Math.max(0.3, 1 - depth * 0.22);

        card.style.opacity = `${opacity}`;
        card.style.transform = `translateY(${entranceY + stackY}px) scale(${scale})`;
        card.style.filter = "none";
        card.style.zIndex = `${10 + index}`;
      });
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateSystemStory);
    };

    updateSystemStory();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateSystemStory);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateSystemStory);
    };
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main>
      <div className="nav-blur-shell" aria-hidden="true">
        <GlassSurface
          width="100%"
          height="100%"
          borderRadius={0}
          distortionScale={-180}
          displace={1.2}
          backgroundOpacity={0}
          borderWidth={0.01}
          brightness={50}
          opacity={0.93}
          blur={18}
          saturation={1.12}
          redOffset={0}
          greenOffset={10}
          blueOffset={20}
          refraction={false}
          renderer="auto"
          className="nav-glass-surface"
        />
      </div>
      <header className="nav-shell">
        <div className="nav-dock">
          <nav className="nav" aria-label="Navegação principal">
            <a href="#top" className="brand" aria-label="Genesy — início">
              <img className="logo-dark" src="/genesy-preto.png" width={1371} height={300} alt="GENESY" />
              <img className="logo-light" src="/webp/genesy-branco.webp" width={1371} height={299} alt="" aria-hidden="true" />
            </a>
            <div className="nav-links">
              <a href="#consultoria">Consultoria</a>
              <a href="#sistema">Sistema</a>
              <a href="#faq">FAQ</a>
            </div>
            <a href="#cta" className="nav-cta">
              Agendar
            </a>
          </nav>
          <span className="nav-scroll-track" aria-hidden="true" />
          <span ref={navProgressRef} className="nav-scroll-progress" aria-hidden="true" />
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-beams" aria-hidden="true">
          <Beams
            color="#afb7bf"
            beamWidth={140}
            rotation={30}
            speed={1}
            glow={0.6}
            opacity={0.65}
          />
        </div>
        <div className="ambient ambient-a" />
        <div className="ambient ambient-b" />
        <div className="hero-grid" />
        <div className="container hero-inner hero-centered">
          <div className="hero-copy hero-copy-centered">
            <h1>
              <span>Aumentamos as vendas</span>
              <span className="type-line">
                da sua <em className="type-word"><TypewriterWord /><i aria-hidden="true" /></em>
              </span>
              <span>através da geração de</span>
              <span>demanda qualificada e IA.</span>
            </h1>
            <p>
              Unimos estratégia imobiliária, leads qualificados e capacitação
              comercial para transformar seu investimento em anúncios em
              vendas reais.
            </p>
            <div className="hero-actions">
              <CTA>Quero mais informações</CTA>
            </div>
            <div className="hero-proof">
              <p>
                <strong>+20 imobiliárias e incorporadoras atendidas</strong>
                <br />Resultados consistentes do litoral às capitais
              </p>
            </div>
          </div>
        </div>
        <div className="client-strip">
          <div className="client-marquee" aria-label="Logomarcas de clientes">
            <div className="client-track">
              {[1, 2].flatMap((set) =>
                [1, 2, 3, 4, 5, 6, 7, 8].map((logo) => (
                  <div className="client-logo" key={`${set}-${logo}`} aria-hidden={set === 2}>
                    <img
                      src={`/client-marquee/${logo}.png`}
                      width={300}
                      height={80}
                      loading="lazy"
                      decoding="async"
                      alt={set === 1 ? `Cliente Genesy ${logo}` : ""}
                    />
                  </div>
                )),
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="results-transition" ref={transitionRef}>
      <section className="section numbers" id="numeros">
        <div className="transition-video-scene">
        <div className="transition-black-bg" aria-hidden="true" />
        <div className="container transition-consult-copy">
          <span className="transition-consult-eyebrow">Consultoria gratuita</span>
          <h2>O que você recebe<br />na nossa consultoria?</h2>
        </div>
        <div className="transition-consult-cards">
          {CONSULTATION_CARDS.map((card, index) => (
            <article
              className="transition-consult-card"
              key={card.title}
            >
              <div className="transition-card-top">
                <span>0{index + 1}</span>
                <i aria-hidden="true">{card.icon}</i>
              </div>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
        <div className="transition-cta-wrap t-stagger">
          <div className="container lead-form-layout">
            <div className="lead-form-copy">
              <div className="t-stagger-line">
                <h2><span>Saiba como iremos te</span><span>fazer vender mais.</span></h2>
                <p>Preencha os dados abaixo para<br />agendar uma reunião.</p>
              </div>
              {leadSent ? (
                <div className="lead-form lead-form-success t-stagger-line t-stagger-line--2" role="status">
                  <strong>Recebemos seus dados!</strong>
                  <p>Em breve nossa equipe vai falar com você pelo WhatsApp para agendar a reunião.</p>
                </div>
              ) : (
              <form className="lead-form t-stagger-line t-stagger-line--2" onSubmit={submitLead}>
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }} />
                <label>
                  <span>Nome</span>
                  <input type="text" name="nome" autoComplete="name" placeholder="Nome" required />
                </label>
                <label>
                  <span>WhatsApp</span>
                  <input type="tel" name="whatsapp" autoComplete="tel" placeholder="WhatsApp" required />
                </label>
                <label>
                  <span>Você é</span>
                  <select name="perfil" defaultValue="" required>
                    <option value="" disabled>Você é:</option>
                    <option value="imobiliaria">Imobiliária</option>
                    <option value="incorporadora">Incorporadora</option>
                    <option value="construtora">Construtora</option>
                    <option value="corretor">Corretor(a)</option>
                    <option value="outro">Outro</option>
                  </select>
                </label>
                <label>
                  <span>Média de VGV mensal</span>
                  <select name="vgv" defaultValue="" required>
                    <option value="" disabled>Média de VGV mensal</option>
                    <option value="ate-500k">Até R$ 500 mil</option>
                    <option value="500k-1m">De R$ 500 mil a R$ 1 milhão</option>
                    <option value="1m-3m">De R$ 1 a R$ 3 milhões</option>
                    <option value="acima-3m">Acima de R$ 3 milhões</option>
                  </select>
                </label>
                <button type="submit" disabled={submittingLead}>{submittingLead ? "Enviando…" : "Enviar respostas"}</button>
                {leadError && <p className="lead-form-error" role="alert">{leadError} <a href="https://wa.me/5583996873667">Abrir WhatsApp</a></p>}
              </form>
              )}
            </div>
            <div className="lead-form-visual t-stagger-line t-stagger-line--3">
              <img
                className="lead-form-photo"
                src="/webp/img-lancaster.webp"
                width={1084}
                height={1462}
                loading="lazy"
                decoding="async"
                alt="Lancaster Matos"
              />
              <div className="instagram-badge">
                <img
                  src="/webp/img-perfil-instagram.webp"
                  width={509}
                  height={483}
                  loading="lazy"
                  decoding="async"
                  alt="Perfil de Lancaster Matos no Instagram"
                />
                <span>@lancastermatos</span>
              </div>
            </div>
          </div>
        </div>
        </div>
        <div className="container results-stage-content results-story">
          <div className="results-story-panel results-story-stat results-story-headline t-stagger">
            <strong className="t-stagger-line">
              <SpinningCounter value="+ R$150.000.000" label="Mais de cento e cinquenta milhões de reais" />
            </strong>
            <p className="t-stagger-line t-stagger-line--2">em valor geral de vendas para o mercado imobiliário</p>
          </div>
          <div className="results-story-panel results-story-stat results-story-stat-one t-stagger">
            <strong className="t-stagger-line">
              <SpinningCounter value="+ R$1.000.000" label="Mais de um milhão de reais" />
            </strong>
            <p className="t-stagger-line t-stagger-line--2">gerenciados em anúncios online</p>
          </div>
        </div>
      </section>
      <span className="consultation-anchor" id="consultoria" />
      <span className="form-anchor" id="cta" />
      </div>

      <section className="section testimonials" id="depoimentos">
        <div className="container testimonials-layout">
          <div className="testimonials-stack-wrap" data-reveal>
            <Stack
              cards={TESTIMONIAL_IMAGES.map((src, index) => (
                <img
                  key={src}
                  src={src}
                  width={960}
                  height={1200}
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                  alt={`Resultado de cliente Genesy ${index + 1}`}
                  draggable={false}
                />
              ))}
              visible={5}
              spread={0.72}
              depth={0.5}
              radius={26}
              autoplay
              autoplayDelay={3200}
              pauseOnHover
              sendToBackOnClick
            />
          </div>
          <div className="testimonials-heading" data-reveal>
            <h2><span>Resultados de quem</span><span>já confiou em nós</span></h2>
            <p>Arraste ou toque nas imagens para ver o próximo resultado.</p>
          </div>
        </div>
      </section>

      <section className="section system" id="sistema">
        <div className="container">
          <div className="section-heading centered" data-reveal>
            <SectionTag>03 — Metodologia</SectionTag>
            <h2>Conheça o <em>Sistema Genesy</em></h2>
            <p>Quatro pilares operando em ciclo contínuo. Captação, alinhamento, conversão e inteligência — integrados para previsibilidade real.</p>
          </div>
          <div className="system-scroll" ref={systemRef}>
            <div className="system-sticky">
              <div className="system-orbit-scene">
                <div className="system-orbit">
                  <div className="system-orbit-content">
                    <div className="system-core">
                      <img
                        src="/webp/g-vidro-branco.webp"
                        width={675}
                        height={675}
                        loading="lazy"
                        decoding="async"
                        alt="Genesy"
                      />
                    </div>
                    {SYSTEM_PILLARS.map((pillar, i) => (
                      <div className={`orbit-node-track node-${i + 1}`} key={pillar.shortTitle}>
                        <div className="orbit-node">
                          <span>0{i + 1}</span><strong>{pillar.shortTitle}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="pillar-story-stack">
                {SYSTEM_PILLARS.map((pillar, i) => (
                  <article className="pillar-story-card" key={pillar.title}>
                    <span>Pilar 0{i + 1}</span>
                    <h4>{pillar.title}</h4>
                    <p>{pillar.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
          <div className="center-action system-action"><CTA href="#cta">Quero saber mais</CTA></div>
        </div>
      </section>

      <section className="section faq" id="faq">
        <div className="container faq-grid">
          <div className="faq-heading" data-reveal>
            <SectionTag>05 — Perguntas frequentes</SectionTag>
            <h2>Tudo que você precisa<br /><em>saber antes de começar.</em></h2>
            <p>Ainda ficou com alguma dúvida? Fale diretamente com a nossa equipe.</p>
            <CTA href="#cta">Quero saber mais</CTA>
          </div>
          <div className="accordion" data-reveal>
            {faqs.map((item, i) => (
              <details key={item.q} open={openFaq === i}>
                <summary
                  onClick={(event) => {
                    event.preventDefault();
                    setOpenFaq(openFaq === i ? null : i);
                  }}
                >
                  <span>0{i + 1}</span>{item.q}<i aria-hidden="true" />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer>
        <div className="container footer-top">
          <div className="footer-brand">
            <img
              src="/webp/genesy-branco.webp"
              width={1371}
              height={299}
              loading="lazy"
              decoding="async"
              alt="GENESY"
            />
            <p>Marketing imobiliário de alta performance. Convertendo investimento em anúncios em vendas reais.</p>
          </div>
          <div><h5>Navegação</h5><a href="#consultoria">Consultoria</a><a href="#depoimentos">Resultados</a><a href="#sistema">Sistema Genesy</a><a href="#faq">FAQ</a></div>
          <div>
            <h5>Contato</h5>
            <a href="https://instagram.com/lancastermatos">Instagram · @lancastermatos</a>
            <a href="https://instagram.com/genesycompany">Instagram · @genesycompany</a>
            <a href="https://wa.me/5583996873667">WhatsApp · 83 99687-3667</a>
          </div>
          <div className="footer-consult"><h5>Consultoria</h5><a href="#cta">Agendar diagnóstico</a><p><i /> Vagas / semana <strong>02 restantes</strong></p></div>
        </div>
        <div className="container footer-bottom">
          <span>© Genesy Company — Todos os direitos reservados desde 2019.</span>
          <span>v.2026.07 · Made for Real Estate</span>
        </div>
      </footer>
    </main>
  );
}
