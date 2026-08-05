import type { CSSProperties } from "react";

type SemanticChipProperties = CSSProperties & {
  "--chip-color": string;
};

/**
 * Expõe a cor semântica ao CSS, que ajusta o contraste conforme o tema.
 */
export function semanticChipStyle(color: string): SemanticChipProperties {
  return { "--chip-color": color };
}
