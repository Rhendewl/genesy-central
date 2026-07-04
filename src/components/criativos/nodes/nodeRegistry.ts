import type { NodeCategory, WorkflowNodeType } from "@/lib/workflow/types";

// ── Cores por categoria ───────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<NodeCategory, { primary: string; bg: string; border: string; text: string }> = {
  input:      { primary: "#3B82F6", bg: "rgba(59,130,246,0.10)",  border: "rgba(59,130,246,0.30)",  text: "#93C5FD" },
  ai:         { primary: "#8B5CF6", bg: "rgba(139,92,246,0.10)",  border: "rgba(139,92,246,0.30)",  text: "#C4B5FD" },
  processing: { primary: "#F59E0B", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.30)",  text: "#FCD34D" },
  output:     { primary: "#10B981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.30)",  text: "#6EE7B7" },
};

// ── Metadados de cada tipo de node ────────────────────────────────────────────

export interface NodeMeta {
  type: WorkflowNodeType;
  category: NodeCategory;
  label: string;
  description: string;
  icon: string;  // emoji ou nome de ícone Lucide
  inputs: number;
  outputs: number;
  width?: number;
}

export const NODE_REGISTRY: NodeMeta[] = [
  // ── INPUT ───────────────────────────────────────────────────────────────────
  {
    type: "prompt",
    category: "input",
    label: "Prompt",
    description: "Contexto principal da campanha",
    icon: "MessageSquare",
    inputs: 0,
    outputs: 1,
  },
  {
    type: "branding",
    category: "input",
    label: "Branding",
    description: "Identidade e tom da marca",
    icon: "Building2",
    inputs: 0,
    outputs: 1,
  },
  {
    type: "asset-upload",
    category: "input",
    label: "Asset Upload",
    description: "Logo, imagem ou fundo",
    icon: "Upload",
    inputs: 0,
    outputs: 1,
  },
  {
    type: "brand-colors",
    category: "input",
    label: "Cores da Marca",
    description: "Paleta de cores do branding",
    icon: "Palette",
    inputs: 0,
    outputs: 1,
  },
  {
    type: "visual-reference",
    category: "input",
    label: "Referência Visual",
    description: "Imagem de referência de estilo",
    icon: "Image",
    inputs: 0,
    outputs: 1,
  },

  // ── AI ──────────────────────────────────────────────────────────────────────
  {
    type: "copy-generator",
    category: "ai",
    label: "Copy Generator",
    description: "Gera copy persuasivo com IA",
    icon: "PenLine",
    inputs: 1,
    outputs: 1,
  },
  {
    type: "headline-generator",
    category: "ai",
    label: "Headline Generator",
    description: "Gera títulos impactantes",
    icon: "Heading",
    inputs: 1,
    outputs: 1,
  },
  {
    type: "cta-generator",
    category: "ai",
    label: "CTA Generator",
    description: "Gera chamadas para ação",
    icon: "MousePointerClick",
    inputs: 1,
    outputs: 1,
  },
  {
    type: "visual-generator",
    category: "ai",
    label: "Visual Generator",
    description: "Gera imagens com DALL-E 3",
    icon: "ImagePlus",
    inputs: 1,
    outputs: 1,
  },
  {
    type: "style-variator",
    category: "ai",
    label: "Style Variator",
    description: "Cria variações de estilo visual",
    icon: "Layers",
    inputs: 1,
    outputs: 3,
  },
  {
    type: "layout-variator",
    category: "ai",
    label: "Layout Variator",
    description: "Varia composição e layout",
    icon: "LayoutDashboard",
    inputs: 1,
    outputs: 1,
  },

  // ── PROCESSING ──────────────────────────────────────────────────────────────
  {
    type: "split-batch",
    category: "processing",
    label: "Split Batch",
    description: "Divide em N execuções paralelas",
    icon: "GitBranch",
    inputs: 1,
    outputs: 3,
  },
  {
    type: "randomizer",
    category: "processing",
    label: "Randomizer",
    description: "Escolhe opções aleatoriamente",
    icon: "Shuffle",
    inputs: 1,
    outputs: 1,
  },
  {
    type: "rules-engine",
    category: "processing",
    label: "Rules Engine",
    description: "Aplica regras condicionais",
    icon: "Filter",
    inputs: 1,
    outputs: 2,
  },

  // ── OUTPUT ──────────────────────────────────────────────────────────────────
  {
    type: "preview",
    category: "output",
    label: "Preview",
    description: "Visualiza o criativo final",
    icon: "Eye",
    inputs: 1,
    outputs: 0,
  },
  {
    type: "result",
    category: "output",
    label: "Resultado",
    description: "Salva o criativo gerado",
    icon: "CheckCircle2",
    inputs: 1,
    outputs: 0,
  },
  {
    type: "export",
    category: "output",
    label: "Export",
    description: "Exporta em PNG, JPG ou WebP",
    icon: "Download",
    inputs: 1,
    outputs: 0,
  },
];

// ── Lookup maps ───────────────────────────────────────────────────────────────

export const NODE_META_MAP: Record<WorkflowNodeType, NodeMeta> = Object.fromEntries(
  NODE_REGISTRY.map(m => [m.type, m])
) as Record<WorkflowNodeType, NodeMeta>;

export const NODE_CATEGORY_MAP: Record<string, NodeCategory> = Object.fromEntries(
  NODE_REGISTRY.map(m => [m.type, m.category])
);

// Nodes organizados por categoria para o sidebar
export const NODES_BY_CATEGORY = NODE_REGISTRY.reduce<Record<NodeCategory, NodeMeta[]>>(
  (acc, meta) => {
    acc[meta.category].push(meta);
    return acc;
  },
  { input: [], ai: [], processing: [], output: [] }
);

// ── Default data por tipo ─────────────────────────────────────────────────────

export const DEFAULT_NODE_DATA: Partial<Record<WorkflowNodeType, Record<string, unknown>>> = {
  "prompt":            { content: "", language: "pt-BR" },
  "branding":          { brand_name: "", segment: "imobiliario", tone: "profissional", target_audience: "" },
  "asset-upload":      { asset_type: "logo", file_url: null, file_name: null },
  "brand-colors":      { primary: "#3B82F6", secondary: "#1E40AF", accent: "#93C5FD", background: "#0A0A0A" },
  "visual-reference":  { reference_url: null, description: "" },
  "copy-generator":    { model: "anthropic", max_words: 25, variations: 3 },
  "headline-generator":{ model: "anthropic", style: "benefit", max_chars: 60 },
  "cta-generator":     { model: "anthropic", action_type: "discover" },
  "visual-generator":  { model: "openai", format: "1080x1080", style: "photorealistic", quality: "standard" },
  "style-variator":    { styles: ["luxury", "minimal", "bold"], variations_per_style: 1 },
  "layout-variator":   { layouts: ["centered", "split"] },
  "split-batch":       { quantity: 3, mode: "parallel" },
  "randomizer":        { options: [], pick: 1 },
  "rules-engine":      { rules: [] },
  "preview":           { format: "1080x1080", show_copy: true, show_cta: true },
  "result":            { auto_download: false },
  "export":            { format: "png", quality: 90 },
};

// ── Workflow inicial (starter template) ───────────────────────────────────────

export const STARTER_WORKFLOW = {
  nodes: [
    {
      id: "starter-prompt",
      type: "prompt" as WorkflowNodeType,
      position: { x: 100, y: 180 },
      data: { content: "", language: "pt-BR" },
    },
    {
      id: "starter-branding",
      type: "branding" as WorkflowNodeType,
      position: { x: 100, y: 360 },
      data: { brand_name: "", segment: "imobiliario", tone: "profissional", target_audience: "" },
    },
    {
      id: "starter-copy",
      type: "copy-generator" as WorkflowNodeType,
      position: { x: 430, y: 180 },
      data: { model: "anthropic", max_words: 25, variations: 3 },
    },
    {
      id: "starter-visual",
      type: "visual-generator" as WorkflowNodeType,
      position: { x: 430, y: 360 },
      data: { model: "openai", format: "1080x1080", style: "photorealistic", quality: "standard" },
    },
    {
      id: "starter-preview",
      type: "preview" as WorkflowNodeType,
      position: { x: 760, y: 270 },
      data: { format: "1080x1080", show_copy: true, show_cta: true },
    },
  ],
  edges: [
    { id: "se1", source: "starter-prompt",   target: "starter-copy",    animated: true, style: { stroke: "rgba(64,69,73,0.5)", strokeWidth: 2 } },
    { id: "se2", source: "starter-branding", target: "starter-copy",    animated: true, style: { stroke: "rgba(64,69,73,0.5)", strokeWidth: 2 } },
    { id: "se3", source: "starter-prompt",   target: "starter-visual",  animated: true, style: { stroke: "rgba(64,69,73,0.5)", strokeWidth: 2 } },
    { id: "se4", source: "starter-copy",     target: "starter-preview", animated: true, style: { stroke: "rgba(64,69,73,0.5)", strokeWidth: 2 } },
    { id: "se5", source: "starter-visual",   target: "starter-preview", animated: true, style: { stroke: "rgba(64,69,73,0.5)", strokeWidth: 2 } },
  ],
};
