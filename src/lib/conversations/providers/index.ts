import { QRCodeWhatsAppProvider } from "./qr-code-provider";
import type { WhatsAppProvider } from "./types";

const providers: Record<WhatsAppProvider["id"], WhatsAppProvider> = {
  qr_code: new QRCodeWhatsAppProvider(),
  cloud_api: new QRCodeWhatsAppProvider(),
};

export function getWhatsAppProvider(provider: WhatsAppProvider["id"] = "qr_code") {
  return providers[provider];
}

export type {
  SendWhatsAppMessageInput,
  SendWhatsAppMessageResult,
  WhatsAppConnectionStatus,
  WhatsAppProvider,
} from "./types";
