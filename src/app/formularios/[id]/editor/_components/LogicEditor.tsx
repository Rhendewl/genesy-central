"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LogicEditor — seção "Lógica" do painel de propriedades de uma pergunta.
// Edita apenas as regras da pergunta atual (`rules`, já filtradas pelo
// chamador por condition.step === step.id) e devolve o mesmo formato via
// onChange — quem chama (BlockSettings) faz o merge com o array completo de
// form.logic_rules. Formato de regra é o LogicRule "legado" (uma condição +
// uma ação) já usado pelo motor em src/lib/logic-engine (adaptLegacyRule).
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties } from "react";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormStep, FormEnding, LogicRule, LogicAction } from "@/types";
import { Field, inputBaseClass } from "./primitives";

interface LogicEditorProps {
  step: FormStep;
  allSteps: FormStep[];
  endings: FormEnding[];
  rules: LogicRule[];
  onChange: (rules: LogicRule[]) => void;
}

const NEXT_VALUE     = "__next__";
const COMPLETE_VALUE = "__complete__";

// ── Codifica LogicAction <-> valor único de <select> ───────────────────────────

function actionToValue(action: LogicAction): string {
  if (action.type === "jump" && !action.target) return NEXT_VALUE;
  if (action.type === "jump")     return `step:${action.target}`;
  if (action.type === "end")      return `end:${action.target ?? ""}`;
  if (action.type === "complete") return COMPLETE_VALUE;
  return NEXT_VALUE;
}

function valueToAction(value: string): LogicAction {
  if (value === NEXT_VALUE)     return { type: "jump", target: undefined };
  if (value === COMPLETE_VALUE) return { type: "complete" };
  if (value.startsWith("step:")) return { type: "jump", target: value.slice(5) };
  if (value.startsWith("end:"))  return { type: "end",  target: value.slice(4) };
  return { type: "jump", target: undefined };
}

const selectStyle: CSSProperties = {
  background: "var(--background)",
  border: "1px solid var(--border)",
  color: "var(--text-title)",
};

export function LogicEditor({ step, allSteps, endings, rules, onChange }: LogicEditorProps) {
  const choices = step.choices ?? [];
  const targets = allSteps.filter(s => s.id !== step.id);

  const addRule = () => {
    const newRule: LogicRule = {
      id: crypto.randomUUID(),
      condition: { step: step.id, operator: "equals", value: choices[0]?.value ?? "" },
      action: { type: "jump", target: undefined },
    };
    onChange([...rules, newRule]);
  };

  const updateRule = (id: string, patch: Partial<LogicRule>) => {
    onChange(rules.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const removeRule = (id: string) => {
    onChange(rules.filter(r => r.id !== id));
  };

  if (choices.length === 0) {
    return (
      <Field label="Lógica">
        <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          Adicione opções de resposta acima para configurar regras de lógica.
        </p>
      </Field>
    );
  }

  return (
    <Field label="Lógica">
      <div className="flex flex-col gap-2">
        {rules.map(rule => (
          <div
            key={rule.id}
            className="flex flex-col gap-1.5 p-2 rounded-lg"
            style={{ border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] flex-shrink-0" style={{ color: "var(--muted-foreground)" }}>
                Se a resposta for
              </span>
              <select
                className={cn(inputBaseClass, "flex-1")}
                style={selectStyle}
                value={String(rule.condition.value ?? "")}
                aria-label="Se a resposta for"
                onChange={e => updateRule(rule.id, {
                  condition: { ...rule.condition, value: e.target.value },
                })}
              >
                {choices.map(c => (
                  <option key={c.id} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <ArrowRight size={11} className="flex-shrink-0" style={{ color: "var(--muted-foreground)" }} aria-hidden="true" />
              <select
                className={cn(inputBaseClass, "flex-1")}
                style={selectStyle}
                value={actionToValue(rule.action)}
                aria-label="Direcionar para"
                onChange={e => updateRule(rule.id, { action: valueToAction(e.target.value) })}
              >
                <option value={NEXT_VALUE}>Próxima pergunta</option>
                {targets.length > 0 && (
                  <optgroup label="Perguntas">
                    {targets.map((t, i) => (
                      <option key={t.id} value={`step:${t.id}`}>
                        {i + 1}. {t.title || "Sem título"}{t.type === "calendar" ? " (Calendário)" : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Encerramento">
                  {endings.map(e => (
                    <option key={e.id} value={`end:${e.id}`}>
                      Tela de Sucesso{endings.length > 1 ? `: ${e.title}` : ""}
                    </option>
                  ))}
                  <option value={COMPLETE_VALUE}>Finalizar formulário</option>
                </optgroup>
              </select>

              <button
                onClick={() => removeRule(rule.id)}
                className="flex-shrink-0 p-1 rounded hover:bg-red-500/10 transition-colors"
                aria-label="Remover regra"
              >
                <Trash2 size={11} style={{ color: "#ef4444" }} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addRule}
          className="flex items-center gap-1.5 text-xs py-2 px-3 rounded-lg transition-all hover:bg-[var(--hover)] mt-1"
          style={{ color: "var(--primary)", border: "1px dashed var(--border)" }}
        >
          <Plus size={11} aria-hidden="true" />
          Adicionar regra
        </button>
      </div>
    </Field>
  );
}
