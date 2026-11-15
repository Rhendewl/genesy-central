import type { CSSProperties } from "react";
export function accentBorderStyle(color?: string | null): CSSProperties {
 return { position: "relative", "--surface-accent": color || "transparent" } as CSSProperties;
}
