import type { AutomationFlow } from "./flow/types";

export type InstagramAutomationTrigger = "comment" | "message" | "story_reply" | "postback";
export type InstagramAutomationMatch = "contains" | "exact" | "starts_with" | "any";

export interface InstagramAutomationStep {
  type: "message";
  text: string;
  delayMinutes: number;
  button?: { label: string; url: string } | null;
}

export interface InstagramAutomationInput {
  connectionId: string;
  name: string;
  status: "draft" | "active" | "paused";
  triggerType: InstagramAutomationTrigger;
  matchType: InstagramAutomationMatch;
  keywords: string[];
  publicReplyText?: string | null;
  steps: InstagramAutomationStep[];
  crmEnabled: boolean;
  crmPipelineId?: string | null;
  crmStageId?: string | null;
  crmOriginId?: string | null;
  crmAssignedTo?: string | null;
  crmDealValue?: number;
  /** Visual builder graph. When present it replaces steps + CRM toggle. */
  flow?: AutomationFlow | null;
}

export interface NormalizedInstagramEvent {
  accountId: string;
  externalEventId: string;
  eventType: InstagramAutomationTrigger;
  senderScopedId: string | null;
  senderUsername: string | null;
  commentId: string | null;
  mediaId: string | null;
  messageId: string | null;
  text: string;
  occurredAt: string;
  rawPayload: Record<string, unknown>;
  /** Message sent from a Click-to-Direct ad (opens Meta's extended 7-day window). */
  fromAd?: boolean;
  adId?: string | null;
}
