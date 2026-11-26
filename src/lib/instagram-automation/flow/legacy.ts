import { FLOW_TRIGGER_ID, type AutomationFlow, type FlowEdge, type FlowNode } from "./types";

export interface LegacyAutomationShape {
  triggerType: string;
  steps: Array<{ text?: string; delayMinutes?: number; button?: { label?: string; url?: string } | null }> | null | undefined;
  crmEnabled?: boolean;
  crmPipelineId?: string | null;
  crmStageId?: string | null;
  crmOriginId?: string | null;
  crmAssignedTo?: string | null;
  crmDealValue?: number | null;
}

const COLUMN = 320;

/**
 * Converts an automation saved with the linear editor (list of steps + CRM
 * toggle) into the equivalent flow. Behaviour is preserved: each step's delay
 * becomes a delay block before it, comments keep a single private reply, and
 * the CRM opportunity is created after the last message.
 */
export function legacyStepsToFlow(automation: LegacyAutomationShape): AutomationFlow {
  const nodes: FlowNode[] = [{ id: FLOW_TRIGGER_ID, type: "trigger", position: { x: 40, y: 40 }, data: {} }];
  const edges: FlowEdge[] = [];
  let previous = FLOW_TRIGGER_ID;
  const link = (target: FlowNode) => {
    nodes.push(target);
    edges.push({ id: `legacy_e${edges.length}`, source: previous, sourceHandle: "next", target: target.id });
    previous = target.id;
  };
  const steps = (automation.steps ?? []).slice(0, automation.triggerType === "comment" ? 1 : 5);
  steps.forEach((step, index) => {
    const delay = Math.max(0, Math.round(Number(step.delayMinutes) || 0));
    if (delay > 0 && automation.triggerType !== "comment") {
      link({ id: `legacy_delay_${index}`, type: "delay", position: { x: 40 + COLUMN * nodes.length, y: 40 }, data: { seconds: delay * 60, typing: false } });
    }
    const button = step.button?.url ? [{ id: `legacy_btn_${index}`, kind: "url" as const, label: String(step.button.label || "Abrir link"), url: String(step.button.url) }] : [];
    link({
      id: `legacy_msg_${index}`, type: "message", position: { x: 40 + COLUMN * nodes.length, y: 40 },
      data: { text: String(step.text ?? ""), buttons: button, timeoutMinutes: null },
    });
  });
  if (automation.crmEnabled && automation.crmStageId) {
    link({
      id: "legacy_crm", type: "action", position: { x: 40 + COLUMN * nodes.length, y: 40 },
      data: {
        kind: "crm",
        crm: {
          pipelineId: automation.crmPipelineId ?? null,
          stageId: automation.crmStageId ?? null,
          originId: automation.crmOriginId ?? null,
          assignedTo: automation.crmAssignedTo ?? null,
          dealValue: Math.max(0, Number(automation.crmDealValue ?? 0) || 0),
        },
      },
    });
  }
  return { version: 1, nodes, edges };
}
