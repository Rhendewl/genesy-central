"use client";

import type { FormStepType, FormTheme } from "@/types";
import { BlockLibrary } from "./BlockLibrary";
import { ThemeEditor } from "./ThemeEditor";

interface EditorSidebarProps {
  activePanel: "blocks" | "theme";
  theme: FormTheme;
  onAddBlock: (type: FormStepType) => void;
  onThemeChange: (patch: Partial<FormTheme>) => void;
}

export function EditorSidebar({
  activePanel,
  theme,
  onAddBlock,
  onThemeChange,
}: EditorSidebarProps) {
  return (
    <div className="px-2 py-1">
      {activePanel === "blocks" && (
        <BlockLibrary onAddBlock={onAddBlock} />
      )}
      {activePanel === "theme" && (
        <div className="px-2 py-2">
          <ThemeEditor theme={theme} onChange={onThemeChange} />
        </div>
      )}
    </div>
  );
}
