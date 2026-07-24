import type { SubmissionListItem } from "@/lib/respostas/types";
import type { FormStep } from "@/types";
import { formatSubmissionAnswer, getNpsPresentation } from "@/lib/respostas/format-answer";

interface TabRespostasProps {
  submission: SubmissionListItem;
  steps: FormStep[];
}

function NpsAnswer({ value, step }: { value: unknown; step: FormStep }) {
  const nps = getNpsPresentation(value);
  if (!nps) {
    return <p className="text-base font-medium" style={{ color: "var(--text-title)" }}>{formatSubmissionAnswer(value, step)}</p>;
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 flex-shrink-0 items-baseline justify-center rounded-2xl border pt-3"
        style={{ background: `${nps.color}16`, borderColor: `${nps.color}55`, color: nps.color }}>
        <span className="text-3xl font-bold leading-none">{nps.score}</span>
        <span className="ml-0.5 text-xs font-semibold">/10</span>
      </div>
      <div className="min-w-0 flex-1">
        <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ background: `${nps.color}18`, color: nps.color }}>
          {nps.label}
        </span>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--hover)" }}>
          <div className="h-full rounded-full" style={{ width: `${(nps.score / 10) * 100}%`, background: nps.color }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          <span>{step.scaleLowLabel ?? "Pouco provável"}</span>
          <span>{step.scaleHighLabel ?? "Muito provável"}</span>
        </div>
      </div>
    </div>
  );
}

export function TabRespostas({ submission, steps }: TabRespostasProps) {
  const answers = submission.answers;
  const stepMap = new Map(steps.map(step => [step.id, step]));
  const ordered = steps
    .filter(step => Object.prototype.hasOwnProperty.call(answers, step.id))
    .map(step => ({ key: step.id, step, value: answers[step.id] }));

  const knownIds = new Set(ordered.map(item => item.key));
  const legacy = Object.entries(answers)
    .filter(([key]) => !knownIds.has(key))
    .map(([key, value]) => ({ key, step: stepMap.get(key), value }));
  const entries = [...ordered, ...legacy];

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
        Nenhuma resposta registrada.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="mb-1">
        <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Perguntas e respostas</p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
          {entries.length} {entries.length === 1 ? "resposta registrada" : "respostas registradas"}
        </p>
      </div>

      {entries.map(({ key, step, value }, index) => (
        <article key={key} className="rounded-2xl border p-4"
          style={{ background: "color-mix(in srgb, var(--background) 44%, transparent)", borderColor: "var(--border)" }}>
          <div className="mb-3 flex items-start gap-2.5">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-lg px-1.5 text-[10px] font-bold"
              style={{ background: "var(--hover)", color: "var(--muted-foreground)" }}>
              {index + 1}
            </span>
            <p className="pt-0.5 text-sm font-medium leading-relaxed" style={{ color: "var(--text-title)" }}>
              {step?.title ?? `Pergunta ${index + 1}`}
            </p>
          </div>

          <div className="ml-8 border-l-2 pl-3" style={{ borderColor: "color-mix(in srgb, var(--primary) 45%, var(--border))" }}>
            {step?.type === "nps_scale" ? (
              <NpsAnswer value={value} step={step} />
            ) : (
              <p className="whitespace-pre-wrap break-words text-base leading-relaxed" style={{ color: "var(--text-title)" }}>
                {formatSubmissionAnswer(value, step)}
              </p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
