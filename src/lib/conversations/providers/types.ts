import type { ConversationWhatsAppAccount } from "@/types/conversations";

export interface WhatsAppConnectionStatus {
  accountId: string;
  status: ConversationWhatsAppAccount["status"];
  phone?: string | null;
  displayName?: string | null;
  qrCodePayload?: string | null;
  error?: string | null;
}

export interface SendWhatsAppMessageInput {
  accountId: string;
  to: string;
  body: string;
  mediaType?: string;
  mediaUrl?: string;
  idempotencyKey?: string;
}

export interface SendWhatsAppMessageResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface WhatsAppProvider {
  readonly id: "qr_code" | "cloud_api";
  startConnection(accountId: string): Promise<WhatsAppConnectionStatus>;
  getConnectionStatus(accountId: string): Promise<WhatsAppConnectionStatus>;
  disconnect(accountId: string): Promise<WhatsAppConnectionStatus>;
  sendMessage(input: SendWhatsAppMessageInput): Promise<SendWhatsAppMessageResult>;
}
