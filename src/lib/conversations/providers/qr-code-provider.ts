import type {
  SendWhatsAppMessageInput,
  SendWhatsAppMessageResult,
  WhatsAppConnectionStatus,
  WhatsAppProvider,
} from "./types";

type WorkerConnectionResponse = Partial<{
  accountId: string;
  status: WhatsAppConnectionStatus["status"];
  phone: string | null;
  displayName: string | null;
  qrCodePayload: string | null;
  error: string | null;
}>;

type WorkerSendResponse = Partial<{
  ok: boolean;
  providerMessageId: string;
  error: string;
}>;

const workerUrl = process.env.WHATSAPP_QR_WORKER_URL?.replace(/\/$/, "");
const workerSecret = process.env.WHATSAPP_QR_WORKER_SECRET;

async function requestWorker<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!workerUrl || !workerSecret) {
    throw new Error("Worker QR Code não configurado. Defina WHATSAPP_QR_WORKER_URL e WHATSAPP_QR_WORKER_SECRET.");
  }

  const response = await fetch(`${workerUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Worker-Secret": workerSecret,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : "Worker QR Code retornou erro.";
    throw new Error(message);
  }

  return payload as T;
}

function normalizeStatus(accountId: string, payload: WorkerConnectionResponse): WhatsAppConnectionStatus {
  return {
    accountId: payload.accountId ?? accountId,
    status: payload.status ?? "error",
    phone: payload.phone ?? null,
    displayName: payload.displayName ?? null,
    qrCodePayload: payload.qrCodePayload ?? null,
    error: payload.error ?? null,
  };
}

export class QRCodeWhatsAppProvider implements WhatsAppProvider {
  readonly id = "qr_code" as const;

  async startConnection(accountId: string): Promise<WhatsAppConnectionStatus> {
    try {
      const payload = await requestWorker<WorkerConnectionResponse>(`/accounts/${accountId}/connect`, {
        method: "POST",
      });
      return normalizeStatus(accountId, payload);
    } catch (err) {
      return {
        accountId,
        status: "error",
        error: err instanceof Error ? err.message : "Erro ao iniciar conexão no worker QR Code.",
      };
    }
  }

  async getConnectionStatus(accountId: string): Promise<WhatsAppConnectionStatus> {
    try {
      const payload = await requestWorker<WorkerConnectionResponse>(`/accounts/${accountId}/status`);
      return normalizeStatus(accountId, payload);
    } catch (err) {
      return {
        accountId,
        status: "error",
        error: err instanceof Error ? err.message : "Erro ao consultar status no worker QR Code.",
      };
    }
  }

  async disconnect(accountId: string): Promise<WhatsAppConnectionStatus> {
    try {
      const payload = await requestWorker<WorkerConnectionResponse>(`/accounts/${accountId}/disconnect`, {
        method: "POST",
      });
      return normalizeStatus(accountId, payload);
    } catch (err) {
      return {
        accountId,
        status: "error",
        error: err instanceof Error ? err.message : "Erro ao desconectar no worker QR Code.",
      };
    }
  }

  async sendMessage(input: SendWhatsAppMessageInput): Promise<SendWhatsAppMessageResult> {
    try {
      const payload = await requestWorker<WorkerSendResponse>("/messages", {
        method: "POST",
        body: JSON.stringify(input),
      });

      return {
        ok: Boolean(payload.ok),
        providerMessageId: payload.providerMessageId,
        error: payload.error,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Erro ao enviar mensagem pelo worker QR Code.",
      };
    }
  }
}
