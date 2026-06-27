import type { ComponentType } from "react";
import type { FormStep, FormStepType } from "@/types";
import {
  Type, AlignLeft, Mail, Phone, Hash, Calendar,
  CheckSquare, List, Star, FileText, ArrowRight, Upload,
  LucideProps,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Block definitions — adicionar novos tipos aqui sem alterar nenhuma outra
// estrutura. Para cada tipo: 1) adicionar aqui, 2) adicionar case em
// createDefaultStep, 3) adicionar case em BlockSettings se precisar de
// propriedades específicas.
// ─────────────────────────────────────────────────────────────────────────────

export interface BlockDefinition {
  type: FormStepType;
  label: string;
  description: string;
  icon: ComponentType<LucideProps>;
  category: "text" | "contact" | "choice" | "special";
  color: string;
}

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    type: "short_text",
    label: "Texto Curto",
    description: "Resposta de uma linha",
    icon: Type,
    category: "text",
    color: "#66aed6",
  },
  {
    type: "long_text",
    label: "Texto Longo",
    description: "Múltiplas linhas de texto",
    icon: AlignLeft,
    category: "text",
    color: "#66aed6",
  },
  {
    type: "number",
    label: "Número",
    description: "Valor numérico",
    icon: Hash,
    category: "text",
    color: "#66aed6",
  },
  {
    type: "date",
    label: "Data",
    description: "Seleção de data",
    icon: Calendar,
    category: "text",
    color: "#66aed6",
  },
  {
    type: "email",
    label: "E-mail",
    description: "Endereço de e-mail",
    icon: Mail,
    category: "contact",
    color: "#22c55e",
  },
  {
    type: "phone",
    label: "Telefone",
    description: "Número de telefone",
    icon: Phone,
    category: "contact",
    color: "#22c55e",
  },
  {
    type: "multiple_choice",
    label: "Múltipla Escolha",
    description: "Seleção de várias opções",
    icon: CheckSquare,
    category: "choice",
    color: "#a78bfa",
  },
  {
    type: "single_choice",
    label: "Escolha Única",
    description: "Seleção de uma opção",
    icon: List,
    category: "choice",
    color: "#a78bfa",
  },
  {
    type: "rating",
    label: "Avaliação",
    description: "Escala de estrelas",
    icon: Star,
    category: "special",
    color: "#f59e0b",
  },
  {
    type: "file_upload",
    label: "Upload de Arquivo",
    description: "Envio de documento ou imagem",
    icon: Upload,
    category: "special",
    color: "#06b6d4",
  },
  {
    type: "statement",
    label: "Declaração",
    description: "Texto informativo sem resposta",
    icon: FileText,
    category: "special",
    color: "#6b7280",
  },
  {
    type: "redirect",
    label: "Redirecionar",
    description: "Envia o respondente para outra URL",
    icon: ArrowRight,
    category: "special",
    color: "#ef4444",
  },
];

export const BLOCK_CATEGORIES: Array<{ key: BlockDefinition["category"]; label: string }> = [
  { key: "text",    label: "Texto" },
  { key: "contact", label: "Contato" },
  { key: "choice",  label: "Escolha" },
  { key: "special", label: "Especial" },
];

export function getBlockDef(type: FormStepType): BlockDefinition | undefined {
  return BLOCK_DEFINITIONS.find(b => b.type === type);
}

// ── Fábrica de steps ──────────────────────────────────────────────────────────

export function createDefaultStep(type: FormStepType): FormStep {
  const base = {
    id: crypto.randomUUID(),
    type,
    title: getDefaultTitle(type),
    required: type !== "statement" && type !== "redirect",
  };

  switch (type) {
    case "short_text":
    case "long_text":
    case "email":
    case "phone":
    case "number":
      return { ...base, placeholder: "" };
    case "multiple_choice":
    case "single_choice":
      return {
        ...base,
        choices: [
          { id: crypto.randomUUID(), label: "Opção 1", value: "opcao_1" },
          { id: crypto.randomUUID(), label: "Opção 2", value: "opcao_2" },
        ],
      };
    case "rating":
      return { ...base, maxRating: 5 };
    case "statement":
    case "redirect":
      return { ...base, content: "" };
    case "file_upload":
      return base as FormStep;
    default:
      return base as FormStep;
  }
}

function getDefaultTitle(type: FormStepType): string {
  const map: Record<FormStepType, string> = {
    short_text:      "Qual é o seu nome?",
    long_text:       "Conte-nos mais",
    email:           "Qual é o seu e-mail?",
    phone:           "Qual é o seu telefone?",
    number:          "Informe um número",
    multiple_choice: "Selecione as opções",
    single_choice:   "Escolha uma opção",
    rating:          "Como você nos avalia?",
    date:            "Qual é a data?",
    file_upload:     "Envie um arquivo",
    statement:       "Informação importante",
    redirect:        "Redirecionamento",
  };
  return map[type] ?? "Nova pergunta";
}
