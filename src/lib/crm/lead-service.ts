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

export interface MoveLeadOptions {
  note?:    string;
  movedBy?: string;
}

export interface MoveLeadResult {
  ok:          boolean;
  error:       string | null;
  fromStageId: string | null;
}

export type CreateLeadInput = Omit<CreateLeadParams, "pipeline_id" | "stage_id" | "kanban_column"> & {
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
    const stage = await this.pipelines.findStageById(input.stageId, input.user_id);
    if (!stage) {
      return { ok: false, leadId: null, error: "Etapa não encontrada" };
    }

    try {
      const leadId = await this.leads.createLead({
        ...input,
        pipeline_id:   stage.pipeline_id,
        stage_id:      input.stageId,
        kanban_column: stage.legacy_column,
      });

      this.bus.publish("lead.stage.entered", {
        leadId,
        pipelineId:  stage.pipeline_id,
        stageId:     input.stageId,
        fromStageId: null,
        userId:      input.user_id,
      });

      return { ok: true, leadId, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar lead";
      return { ok: false, leadId: null, error: msg };
    }
  }

  async moveLead(
    leadId:        string,
    targetStageId: string,
    userId:        string,
    options?:      MoveLeadOptions,
  ): Promise<MoveLeadResult> {
    // 1. Pre-validate: stage exists and belongs to this user
    const targetStage = await this.pipelines.findStageById(targetStageId, userId);
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
        userId,
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

    // 4. Publish domain events — strictly after commit (RPC only resolves post-commit).
    //    Fire-and-forget: failures do not roll back the already-committed move.
    const fromStageId = result.from_stage_id;

    if (fromStageId) {
      this.bus.publish("lead.stage.left", {
        leadId,
        pipelineId:  result.pipeline_id,
        stageId:     fromStageId,
        toStageId:   targetStageId,
        userId,
      });
    }

    this.bus.publish("lead.stage.entered", {
      leadId,
      pipelineId:  result.pipeline_id,
      stageId:     targetStageId,
      fromStageId: fromStageId ?? null,
      userId,
    });

    return { ok: true, error: null, fromStageId: fromStageId ?? null };
  }
}
