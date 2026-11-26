// Visual automation flows for Instagram (comments + Direct).
//
// A flow is a small directed graph. The trigger configuration (event type,
// keywords and public reply) stays on the automation row so that webhook
// matching keeps using the indexed columns; the graph describes what happens
// after the trigger fires. This module is shared by the server engine and the
// browser editor, so it must stay free of Node/Next/Supabase imports.

export type FlowNodeType = "trigger" | "message" | "delay" | "wait_reply" | "condition" | "action";

export interface FlowPosition { x: number; y: number }

export interface FlowButton {
  id: string;
  label: string;
  /** url = opens a link (does not continue the flow); reply = continues the flow by branch */
  kind: "url" | "reply";
  url?: string;
}

export interface MessageNodeData {
  text: string;
  buttons: FlowButton[];
  /** Only for messages with reply buttons: minutes to wait for a tap before following "timeout". */
  timeoutMinutes?: number | null;
}

export interface DelayNodeData { minutes: number }
export interface WaitReplyNodeData { timeoutMinutes: number }

export type ConditionKind = "reply_contains" | "has_tag" | "from_ad";
export interface ConditionNodeData { kind: ConditionKind; value: string }

export type ActionKind = "crm" | "add_tag";
export interface CrmActionConfig {
  pipelineId: string | null;
  stageId: string | null;
  originId: string | null;
  assignedTo: string | null;
  dealValue: number;
}
export interface ActionNodeData { kind: ActionKind; tag?: string; crm?: CrmActionConfig }

interface BaseNode<T extends FlowNodeType, D> { id: string; type: T; position: FlowPosition; data: D }

export type TriggerNode = BaseNode<"trigger", Record<string, never>>;
export type MessageNode = BaseNode<"message", MessageNodeData>;
export type DelayNode = BaseNode<"delay", DelayNodeData>;
export type WaitReplyNode = BaseNode<"wait_reply", WaitReplyNodeData>;
export type ConditionNode = BaseNode<"condition", ConditionNodeData>;
export type ActionNode = BaseNode<"action", ActionNodeData>;

export type FlowNode = TriggerNode | MessageNode | DelayNode | WaitReplyNode | ConditionNode | ActionNode;

export interface FlowEdge {
  id: string;
  source: string;
  /** next | reply | timeout | yes | no | button:<buttonId> */
  sourceHandle: string;
  target: string;
}

export interface AutomationFlow {
  version: 1;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowIssue {
  nodeId: string | null;
  level: "error" | "warning";
  message: string;
}

export const FLOW_TRIGGER_ID = "trigger";
export const FLOW_MAX_NODES = 40;
export const FLOW_MAX_BUTTONS = 3;
export const FLOW_MAX_TEXT = 1000;
/** Instagram's button template rejects texts longer than 640 characters. */
export const FLOW_MAX_TEXT_WITH_BUTTONS = 640;
export const FLOW_MAX_BUTTON_LABEL = 20;
export const FLOW_MAX_WAIT_MINUTES = 7 * 24 * 60;
/** Hard stop against loops: nodes executed in a single run. */
export const FLOW_MAX_STEPS_PER_RUN = 60;
export const FLOW_PAYLOAD_PREFIX = "igflow:";

export const FLOW_NODE_LABELS: Record<FlowNodeType, string> = {
  trigger: "Gatilho",
  message: "Mensagem",
  delay: "Atraso",
  wait_reply: "Esperar resposta",
  condition: "Condição",
  action: "Ação",
};
