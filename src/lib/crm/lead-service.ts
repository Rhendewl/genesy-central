// ─────────────────────────────────────────────────────────────────────────────
// LeadService — single orchestration point for lead state transitions.
//
// Responsibilities:
//   1. Validate business rules via PipelineRepository (require_note)
//   2. Delegate the atomic write to LeadRepository.moveLeadTransactional
//   3. Publish domain events to the injected EventBus only after commit
//
// No direct DB access. No platform-specific code. CRM events use generic
// domain names ("lead.stage.*") so any module can consume or produce them.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventBus } from "@/lib/event-bus/types";
import type { DomainEventType } from "@/lib/event-bus/domain-events";
import { getPlatformEventBus } from "@/lib/event-bus/platform";
import { LeadRepository, type CreateLeadParams } from "./repositories/lead-repository";
import { PipelineRepository } from "./repositories/pipeline-repository";
import { LeadScoreEngine } from "./lead-score-engine";

export interface MoveLeadOptions {
  note?:    string;
  movedBy?: string;
}

export interface MoveLeadResult {
  ok:          boolean;
  error:       string | null;
  fromStageId: string | null;
}

export interface CopyLeadResult {
  ok: boolean;
  error: string | null;
  leadId: string | null;
  alreadyExists: boolean;
}

export type CreateLeadInput = Omit<CreateLeadParams, "pipeline_id" | "stage_id" | "kanban_column" | "ie_score"> & {
  stageId: string;
};

export interface CreateLeadResult {
  ok:     boolean;
  leadId: string | null;
  error:  string | null;
}

export class LeadService {
  private readonly leads:     LeadRepository;
  private readonly pipelines: PipelineRepository;
  private readonly bus:       EventBus<DomainEventType>;

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: SupabaseClient<any, any, any>,
    bus?: EventBus<DomainEventType>,
  ) {
    this.leads     = new LeadRepository(db);
    this.pipelines = new PipelineRepository(db);
    this.bus       = bus ?? getPlatformEventBus();
  }

  async createLead(input: CreateLeadInput): Promise<CreateLeadResult> {
    const stage = await this.pipelines.findStageById(input.stageId);
    if (!stage) {
      return { ok: false, leadId: null, error: "Etapa não encontrada" };
    }

    try {
      // IE (Índice de Evolução) — posição da etapa ÷ total de etapas ativas
      // da pipeline. Calculado aqui (não em LeadRepository) porque só o
      // LeadService tem acesso tanto ao PipelineRepository quanto ao
      // LeadScoreEngine — nenhuma lógica de fórmula fica espalhada.
      const totalActiveStages = await this.pipelines.countActiveStages(stage.pipeline_id);
      const ieScore = LeadScoreEngine.calculateIE(stage.order_index, totalActiveStages);

      const leadId = await this.leads.createLead({
        ...input,
        pipeline_id:   stage.pipeline_id,
        stage_id:      input.stageId,
        // kanban_column é NOT NULL na tabela; etapas de pipelines criados
        // direto no sistema novo não têm coluna legada mapeada (legacy_column
        // null) — cai no valor padrão da própria coluna nesse caso.
        kanban_column: stage.legacy_column ?? "abordados",
        ie_score:      ieScore,
      });

      // Aguardado (não fire-and-forget) para sobreviver ao congelamento do
      // processo em serverless — mas em try/catch próprio: uma falha aqui
      // nunca deve fazer createLead() reportar erro para um lead que já foi
      // criado com sucesso.
      try {
        await this.bus.publish("lead.stage.entered", {
          leadId,
          pipelineId:  stage.pipeline_id,
          stageId:     input.stageId,
          fromStageId: null,
          userId:      input.user_id,
        });
      } catch (err) {
        console.error("[LeadService.createLead] Falha ao publicar lead.stage.entered:", err);
      }

      return { ok: true, leadId, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar lead";
      return { ok: false, leadId: null, error: msg };
    }
  }

  async moveLead(
    leadId:        string,
    targetStageId: string,
    options?:      MoveLeadOptions,
  ): Promise<MoveLeadResult> {
    // 1. Pre-validate: stage exists e é visível ao chamador (RLS garante isso)
    const targetStage = await this.pipelines.findStageById(targetStageId);
    if (!targetStage) {
      return { ok: false, error: "Etapa não encontrada", fromStageId: null };
    }

    // 2. Pre-validate: note required
    if (targetStage.require_note && !options?.note?.trim()) {
      return { ok: false, error: "Esta etapa exige uma observação", fromStageId: null };
    }

    // 3. Atomic transaction: update lead + crm_lead_stage_history + lead_movements
    //    All three writes commit together, or none do. Only on success do we publish.
    let result;
    try {
      result = await this.leads.moveLeadTransactional({
        leadId,
        stageId:  targetStageId,
        note:     options?.note   ?? null,
        movedBy:  options?.movedBy ?? null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao mover lead";
      if (msg === "LEAD_NOT_FOUND")  return { ok: false, error: "Lead não encontrado",  fromStageId: null };
      if (msg === "STAGE_NOT_FOUND") return { ok: false, error: "Etapa não encontrada", fromStageId: null };
      if (msg === "NOTE_REQUIRED")   return { ok: false, error: "Esta etapa exige uma observação", fromStageId: null };
      return { ok: false, error: msg, fromStageId: null };
    }

    // 4. IE (Índice de Evolução) — recalculado a cada movimentação. Gravado
    //    via UPDATE separado (mais simples que estender a RPC crm_move_lead
    //    para calcular isso na mesma transação).
    const totalActiveStages = await this.pipelines.countActiveStages(result.pipeline_id);
    const ieScore = LeadScoreEngine.calculateIE(targetStage.order_index, totalActiveStages);
    await this.leads.updateIeScore(leadId, ieScore);

    // 5. Publish domain events — strictly after commit (RPC only resolves post-commit).
    //    Fire-and-forget: failures do not roll back the already-committed move.
    // userId aqui é quem executou o move (mesmo valor que já era passado antes
    // desta correção — nunca foi usado para ownership, só para notificação).
    const fromStageId = result.from_stage_id;
    const userId = options?.movedBy ?? "";

    if (fromStageId) {
      this.bus.publish("lead.stage.left", {
        leadId,
        pipelineId:  result.pipeline_id,
        stageId:     fromStageId,
        toStageId:   targetStageId,
        userId,
      });
    }

    // Aguardado (não fire-and-forget) para sobreviver ao congelamento do
    // processo em serverless — é este evento que o consumer de Conversas
    // (crm-flow-trigger.ts) escuta para disparar fluxos de WhatsApp. Try/catch
    // próprio: uma falha aqui nunca deve fazer moveLead() reportar erro para
    // um move que já foi commitado com sucesso.
    try {
      await this.bus.publish("lead.stage.entered", {
        leadId,
        pipelineId:  result.pipeline_id,
        stageId:     targetStageId,
        fromStageId: fromStageId ?? null,
        userId,
      });
    } catch (err) {
      console.error("[LeadService.moveLead] Falha ao publicar lead.stage.entered:", err);
    }

    // Workflow Engine — gatilhos "lead ganhou venda"/"lead perdeu venda".
    // "Ganhar"/"perder" não é um conceito à parte: é simplesmente entrar numa
    // etapa marcada is_won/is_lost, reaproveitando o fluxo de move já existente.
    if (targetStage.is_won) {
      this.bus.publish("lead.deal.won", {
        leadId,
        pipelineId: result.pipeline_id,
        stageId:    targetStageId,
        dealValue:  null,
        userId,
      });
    } else if (targetStage.is_lost) {
      this.bus.publish("lead.deal.lost", {
        leadId,
        pipelineId: result.pipeline_id,
        stageId:    targetStageId,
        userId,
      });
    }

    return { ok: true, error: null, fromStageId: fromStageId ?? null };
  }

  async copyLeadToPipeline(
    leadId: string,
    targetStageId: string,
    options?: MoveLeadOptions & { assigneeId?: string | null },
  ): Promise<CopyLeadResult> {
    const targetStage = await this.pipelines.findStageById(targetStageId);
    if (!targetStage) return { ok: false, error: "Etapa não encontrada", leadId: null, alreadyExists: false };
    if (targetStage.require_note && !options?.note?.trim()) {
      return { ok: false, error: "Esta etapa exige uma observação", leadId: null, alreadyExists: false };
    }

    try {
      const result = await this.leads.copyLeadToPipeline({
        leadId,
        stageId: targetStageId,
        note: options?.note?.trim() || null,
        assigneeId: options?.assigneeId ?? null,
      });

      if (!result.already_exists) {
        const totalActiveStages = await this.pipelines.countActiveStages(result.pipeline_id);
        const ieScore = LeadScoreEngine.calculateIE(targetStage.order_index, totalActiveStages);
        await this.leads.updateIeScore(result.lead_id, ieScore);

        try {
          await this.bus.publish("lead.stage.entered", {
            leadId: result.lead_id,
            pipelineId: result.pipeline_id,
            stageId: result.stage_id,
            fromStageId: null,
            userId: options?.movedBy ?? "",
          });
        } catch (err) {
          console.error("[LeadService.copyLeadToPipeline] Falha ao publicar lead.stage.entered:", err);
        }
      }

      return { ok: true, error: null, leadId: result.lead_id, alreadyExists: result.already_exists };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar cópia do lead";
      if (message.includes("LEAD_NOT_FOUND")) return { ok: false, error: "Lead não encontrado", leadId: null, alreadyExists: false };
      if (message.includes("STAGE_NOT_FOUND")) return { ok: false, error: "Etapa não encontrada", leadId: null, alreadyExists: false };
      if (message.includes("NOTE_REQUIRED")) return { ok: false, error: "Esta etapa exige uma observação", leadId: null, alreadyExists: false };
      if (message.includes("ASSIGNEE_NOT_IN_PIPELINE")) return { ok: false, error: "Responsável não pertence à pipeline de destino", leadId: null, alreadyExists: false };
      return { ok: false, error: message, leadId: null, alreadyExists: false };
    }
  }
}
