import { describe, expect, it } from "vitest";
import {
  LOW_PERFORMANCE_SCORE,
  selectLowPerformers,
  selectPerformancePodium,
} from "../performance-podium";
import type { PerformanceCollaborator } from "@/types/performance";

function collaborator(id: string, score: number): PerformanceCollaborator {
  return {
    id,
    name: `Usuário ${id}`,
    email: `${id}@example.com`,
    avatarUrl: null,
    role: "sdr",
    roleLabel: "SDR",
    jobTitle: "SDR",
    score,
    previousScore: score,
    pillars: { resultado: score, produtividade: score, organizacao: score, disciplina: score },
    pillarWeights: { resultado: 25, produtividade: 25, organizacao: 25, disciplina: 25 },
    mainGoalLabel: "Meta",
    mainGoalValue: 0,
    mainGoalTarget: 1,
    goalsHit: 0,
    indicators: [],
    history: [],
    summary: "",
    needsAttention: score < LOW_PERFORMANCE_SCORE,
  };
}

describe("performance podium", () => {
  it("seleciona os três maiores resultados em ordem de colocação", () => {
    const ranking = [
      collaborator("bronze", 72),
      collaborator("ouro", 96),
      collaborator("fora", 65),
      collaborator("prata", 84),
    ];

    expect(selectPerformancePodium(ranking).map((person) => person.id))
      .toEqual(["ouro", "prata", "bronze"]);
  });

  it("lista somente notas abaixo de 60, começando pela mais crítica", () => {
    const ranking = [
      collaborator("limite", 60),
      collaborator("atencao-1", 54),
      collaborator("atencao-2", 31),
      collaborator("forte", 90),
    ];

    expect(selectLowPerformers(ranking).map((person) => person.id))
      .toEqual(["atencao-2", "atencao-1"]);
  });

  it("limita a área de atenção para manter o card compacto", () => {
    const ranking = [
      collaborator("a", 10),
      collaborator("b", 20),
      collaborator("c", 30),
    ];

    expect(selectLowPerformers(ranking, 2)).toHaveLength(2);
  });
});
