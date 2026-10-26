import type { CSSProperties } from "react";

export type BackgroundCrop = { x: number; y: number; zoom: number };

export function normalizeBackgroundCrop(crop?: Partial<BackgroundCrop> | null): BackgroundCrop {
  const clamp = (value: number | undefined, fallback: number, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  return { x: clamp(crop?.x, 50, 0, 100), y: clamp(crop?.y, 50, 0, 100), zoom: clamp(crop?.zoom, 1, 1, 2.5) };
}

export function backgroundImageStyle(crop?: Partial<BackgroundCrop>): CSSProperties {
  const { x, y, zoom } = normalizeBackgroundCrop(crop);
  return { objectPosition: `${x}% ${y}%`, transform: `scale(${zoom})`, transformOrigin: `${x}% ${y}%` };
}
