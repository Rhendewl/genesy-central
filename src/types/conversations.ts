export type WhatsAppAccountStatus =
  | "connected"
  | "awaiting_qr"
  | "connecting"
  | "disconnected"
  | "error"
  | "expired"
  | "reconnect";

export type ConversationThreadStatus = "open" | "pending" | "closed" | "archived";
export type ConversationMessageDirection = "inbound" | "outbound";
export type ConversationMessageSource = "manual" | "automation" | "system";
export type ConversationFlowStatus = "draft" | "active" | "paused" | "archived";
export type ConversationFlowNodeType = "trigger" | "condition" | "wait" | "action" | "end";
export type ConversationFlowJobStatus = "pending" | "processing" | "executed" | "cancelled" | "failed" | "paused";
export type ConversationFlowRunStatus = "executed" | "cancelled" | "failed";
export type ConversationFlowLogLevel = "info" | "warning" | "error";

export interface ConversationWhatsAppAccount {
  id: string;
  user_id: string;
  owner_profile_id: string;
  provider: "qr_code" | "cloud_api";
  session_name: string;
  phone: string | null;
  display_name: string | null;
  status: WhatsAppAccountStatus;
  qr_code_payload: string | null;
  last_sync_at: string | null;
  last_connected_at: string | null;
  last_error: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationContact {
  id: string;
  user_id: string;
  lead_id: string | null;
  name: string | null;
  phone: string;
  email: string | null;
  company: string | null;
  avatar_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ConversationThread {
  id: string;
  user_id: string;
  whatsapp_account_id: string | null;
  contact_id: string;
  owner_profile_id: string;
  lead_id: string | null;
  status: ConversationThreadStatus;
  last_message_preview: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  unread_count: number;
  needs_response: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  user_id: string;
  thread_id: string;
  whatsapp_account_id: string | null;
  contact_id: string;
  owner_profile_id: string;
  lead_id: string | null;
  direction: ConversationMessageDirection;
  source: ConversationMessageSource;
  body: string;
  status: "queued" | "sent" | "delivered" | "read" | "received" | "failed";
  provider_message_id: string | null;
  flow_id: string | null;
  flow_job_id: string | null;
  error: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
}

export interface ConversationFlowNode {
  id: string;
  user_id?: string;
  flow_id: string;
  node_key: string;
  node_type: ConversationFlowNodeType;
  label: string;
  config: Record<string, unknown>;
  position: { x?: number; y?: number };
}

export interface ConversationFlowEdge {
  id: string;
  user_id?: string;
  flow_id: string;
  source_key: string;
  target_key: string;
  label: string | null;
  config: Record<string, unknown>;
}

export interface ConversationFlowRun {
  id: string;
  user_id: string;
  flow_id: string;
  job_id: string | null;
  lead_id: string | null;
  thread_id: string | null;
  status: ConversationFlowRunStatus;
  reason: string | null;
  snapshot: Record<string, unknown>;
  started_at: string;
  finished_at: string | null;
}

export interface ConversationFlowLog {
  id: string;
  user_id: string;
  flow_id: string | null;
  job_id: string | null;
  run_id: string | null;
  level: ConversationFlowLogLevel;
  message: string;
  context: Record<string, unknown>;
  created_at: string;
}

export interface ConversationFlow {
  id: string;
  user_id: string;
  owner_profile_id: string | null;
  name: string;
  description: string | null;
  status: ConversationFlowStatus;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  scope: "team" | "personal";
  viewport: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  nodes?: ConversationFlowNode[];
  edges?: ConversationFlowEdge[];
  runs?: ConversationFlowRun[];
  logs?: ConversationFlowLog[];
}

export interface ConversationLeadSummary {
  id: string;
  name: string;
  notes: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  iq_score: number | null;
  ie_score: number | null;
}

export interface ConversationInboxItem {
  thread: ConversationThread;
  contact: ConversationContact;
  account: Pick<ConversationWhatsAppAccount, "id" | "session_name" | "status" | "phone"> | null;
  ownerName: string;
  lead: ConversationLeadSummary | null;
}

export interface ConversationMetrics {
  sent: number;
  received: number;
  automationsExecuted: number;
  automationsCancelled: number;
  failures: number;
  responseRate: number;
  averageResponseMinutes: number;
  openThreads: number;
  needsResponse: number;
}
