"use client";

import { useCallback, useLayoutEffect, useState, type CSSProperties } from "react";

type Box = { left: number; top: number; width: number; height: number; radius: string };

/**
 * Fundo que desliza suavemente até a opção ativa de uma barra segmentada
 * (períodos, abas, Kanban/Lista etc.).
 *
 * Como usar:
 * 1. `const seg = useSegmentIndicator({ background: "var(--tab-active-bg)" });`
 * 2. No container: `ref={seg.trackRef}` e a classe `relative`.
 * 3. Primeiro filho do container: `{seg.indicator}`.
 * 4. Em cada opção: `data-active={ativa}` e `relative z-[1]`, sem fundo próprio quando ativa
 *    (o fundo passa a ser o indicador; a cor do texto continua na opção).
 *    Barras estilizadas por CSS podem indicar a opção ativa de outro jeito: passe `activeSelector`
 *    (ex.: `[aria-pressed="true"]`, `[aria-current="page"]`, `.is-active`).
 */
export function useSegmentIndicator(style: CSSProperties, { activeSelector = '[data-active="true"]' }: { activeSelector?: string } = {}) {
  const [track, setTrack] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [animate, setAnimate] = useState(false);
  const trackRef = useCallback((element: HTMLElement | null) => setTrack(element), []);

  useLayoutEffect(() => {
    if (!track) return;
    const measure = () => {
      const active = track.querySelector<HTMLElement>(activeSelector);
      if (!active) { setBox(null); return; }
      const next: Box = { left: active.offsetLeft, top: active.offsetTop, width: active.offsetWidth, height: active.offsetHeight, radius: getComputedStyle(active).borderRadius };
      setBox(previous => previous && previous.left === next.left && previous.top === next.top && previous.width === next.width && previous.height === next.height && previous.radius === next.radius ? previous : next);
    };
    measure();
    // Sem animação na primeira medida, para o fundo não "voar" do canto ao abrir a tela.
    const frame = requestAnimationFrame(() => setAnimate(true));
    const resize = new ResizeObserver(measure);
    resize.observe(track);
    Array.from(track.children).forEach(child => resize.observe(child));
    const mutation = new MutationObserver(measure);
    mutation.observe(track, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-active", "aria-pressed", "aria-current", "aria-selected", "class"] });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [track, activeSelector]);

  const indicator = box
    ? <span aria-hidden className={`pointer-events-none absolute left-0 top-0 z-0 ${animate ? "transition-[transform,width,height] duration-300 ease-out motion-reduce:transition-none" : ""}`}
        style={{ boxSizing: "border-box", transform: `translate(${box.left}px, ${box.top}px)`, width: box.width, height: box.height, borderRadius: box.radius, ...style }} />
    : null;

  return { trackRef, indicator };
}
