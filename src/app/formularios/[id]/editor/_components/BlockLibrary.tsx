"use client";

import type { FormStepType } from "@/types";
import { BLOCK_DEFINITIONS, BLOCK_CATEGORIES } from "./blocks";
import { BlockCard } from "./BlockCard";

interface BlockLibraryProps {
  onAddBlock: (type: FormStepType) => void;
}

export function BlockLibrary({ onAddBlock }: BlockLibraryProps) {
  return (
    <div className="flex flex-col gap-3 py-2">
      {BLOCK_CATEGORIES.map(cat => {
        const blocks = BLOCK_DEFINITIONS.filter(b => b.category === cat.key);
        if (!blocks.length) return null;
        return (
          <div key={cat.key}>
            <p
              className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              {cat.label}
            </p>
            {blocks.map(block => (
              <BlockCard
                key={block.type}
                block={block}
                onClick={() => onAddBlock(block.type)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
