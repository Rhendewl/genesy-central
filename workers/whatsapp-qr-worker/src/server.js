/* eslint-disable react-hooks/rules-of-hooks */
import express from "express";
import pino from "pino";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";

const port = Number(process.env.PORT || 3333);
const workerSecret = process.env.WHATSAPP_QR_WORKER_SECRET;
const dashboardUrl = process.env.DASHBOARD_URL?.replace(/\/$/, "");
const dashboardSecret = process.env.CONVERSATIONS_WORKER_SECRET || process.env.CRON_SECRET;
const sessionsDir = process.env.WHATSAPP_SESSIONS_DIR || "sessions";
const logger = pino({ level: process.env.LOG_LEVEL || "info" });

const sessions = new Map();

function requireSecret(request, response, next) {
  if (!workerSecret) {
    response.status(500).json({ error: "WHATSAPP_QR_WORKER_SECRET não configurado no worker." });
    return;
  }

  if (request.header("x-worker-secret") !== workerSecret) {
    response.status(401).json({ error: "unauthorized" });
    return;
  }

  next();
}

function sessionSnapshot(accountId) {
  const session = sessions.get(accountId);
  if (!session) {
    return {
      accountId,
      status: "disconnected",
      qrCodePayload: null,
      phone: null,
      displayName: null,
      error: null,
    };
  }

  return {
    accountId,
    status: session.status,
    qrCodePayload: session.qrCodePayload,
    phone: session.phone,
    displayName: session.displayName,
    error: session.error,
  };
}

function jidToPhone(jid) {
  return String(jid || "").split("@")[0].replace(/\D/g, "");
}

function extractMessageText(message) {
  if (!message) return "";
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    ""
  ).trim();
}

async function notifyConnectionStatus(accountId) {
  if (!dashboardUrl || !dashboardSecret) {
    logger.warn({ accountId }, "Dashboard webhook não configurado; status da conexão não enviado.");
    return;
  }

  const snapshot = sessionSnapshot(accountId);
  const payload = {
    whatsapp_account_id: accountId,
    status: snapshot.status,
    phone: snapshot.phone,
    display_name: snapshot.displayName,
    qr_code_payload: snapshot.qrCodePayload,
    error: snapshot.error,
  };
  const endpoints = [
    "/api/conversas/webhook/whatsapp-status",
    "/api/conversas/webhook/status",
  ];

  for (const endpoint of endpoints) {
    const url = `${dashboardUrl}${endpoint}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Conversations-Secret": dashboardSecret,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) return;

    const error = await response.text().catch(() => "");
    logger.warn({ accountId, endpoint, status: response.status, error }, "Falha ao atualizar status da conexão no dashboard.");
    if (![404, 405].includes(response.status)) return;
  }
}

async function notifyInboundMessage(accountId, message) {
  if (!dashboardUrl || !dashboardSecret) {
    logger.warn({ accountId }, "Dashboard webhook não configurado; mensagem recebida ignorada.");
    return;
  }

  const remoteJid = message.key?.remoteJid;
  if (!remoteJid || remoteJid.endsWith("@g.us") || message.key?.fromMe) return;

  const body = extractMessageText(message.message);
  if (!body) return;

  const response = await fetch(`${dashboardUrl}/api/conversas/webhook/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Conversations-Secret": dashboardSecret,
    },
    body: JSON.stringify({
      whatsapp_account_id: accountId,
      from: jidToPhone(remoteJid),
      body,
      name: message.pushName || "",
      provider_message_id: message.key?.id || null,
      received_at: new Date(Number(message.messageTimestamp || Date.now()) * 1000).toISOString(),
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "");
    logger.warn({ accountId, status: response.status, error }, "Falha ao encaminhar mensagem recebida.");
  }
}

async function startSession(accountId) {
  const current = sessions.get(accountId);
  if (current?.sock && current.status !== "expired") {
    return sessionSnapshot(accountId);
  }

  const authPath = `${sessionsDir}/${accountId}`;
  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version } = await fetchLatestBaileysVersion();
  const session = {
    sock: null,
    status: "connecting",
    qrCodePayload: null,
    phone: null,
    displayName: null,
    error: null,
  };

  sessions.set(accountId, session);
  notifyConnectionStatus(accountId).catch((err) => {
    logger.warn({ err, accountId }, "Erro ao enviar status inicial da sessão.");
  });

  const sock = makeWASocket({
    auth: state,
    version,
    logger: logger.child({ accountId }),
    printQRInTerminal: false,
    browser: ["Genesy", "Chrome", "1.0.0"],
  });

  session.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      session.status = "awaiting_qr";
      session.qrCodePayload = qr;
      session.error = null;
      notifyConnectionStatus(accountId).catch((err) => {
        logger.warn({ err, accountId }, "Erro ao enviar QR para o dashboard.");
      });
    }

    if (connection === "open") {
      session.status = "connected";
      session.qrCodePayload = null;
      session.phone = jidToPhone(sock.user?.id);
      session.displayName = sock.user?.name || sock.user?.verifiedName || null;
      session.error = null;
      notifyConnectionStatus(accountId).catch((err) => {
        logger.warn({ err, accountId }, "Erro ao enviar status conectado para o dashboard.");
      });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      session.status = shouldReconnect ? "reconnect" : "expired";
      session.error = lastDisconnect?.error?.message || null;
      session.sock = null;
      notifyConnectionStatus(accountId).catch((err) => {
        logger.warn({ err, accountId }, "Erro ao enviar status fechado para o dashboard.");
      });

      if (shouldReconnect) {
        setTimeout(() => {
          startSession(accountId).catch((err) => logger.error({ err, accountId }, "Erro ao reconectar sessão."));
        }, 5000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const message of messages || []) {
      await notifyInboundMessage(accountId, message).catch((err) => {
        logger.warn({ err, accountId }, "Erro ao processar mensagem recebida.");
      });
    }
  });

  return sessionSnapshot(accountId);
}

async function disconnectSession(accountId) {
  const session = sessions.get(accountId);
  if (session?.sock) {
    await session.sock.logout().catch(() => undefined);
    await session.sock.end(undefined).catch(() => undefined);
  }

  sessions.set(accountId, {
    sock: null,
    status: "disconnected",
    qrCodePayload: null,
    phone: session?.phone ?? null,
    displayName: session?.displayName ?? null,
    error: null,
  });

  await notifyConnectionStatus(accountId).catch((err) => {
    logger.warn({ err, accountId }, "Erro ao enviar status desconectado para o dashboard.");
  });

  return sessionSnapshot(accountId);
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.use(requireSecret);

app.post("/accounts/:accountId/connect", async (request, response) => {
  try {
    response.json(await startSession(request.params.accountId));
  } catch (err) {
    logger.error({ err, accountId: request.params.accountId }, "Erro ao iniciar sessão.");
    response.status(500).json({ accountId: request.params.accountId, status: "error", error: err.message });
  }
});

app.get("/accounts/:accountId/status", (request, response) => {
  response.json(sessionSnapshot(request.params.accountId));
});

app.post("/accounts/:accountId/disconnect", async (request, response) => {
  try {
    response.json(await disconnectSession(request.params.accountId));
  } catch (err) {
    logger.error({ err, accountId: request.params.accountId }, "Erro ao desconectar sessão.");
    response.status(500).json({ accountId: request.params.accountId, status: "error", error: err.message });
  }
});

app.post("/messages", async (request, response) => {
  const { accountId, to, body, mediaType, mediaUrl, idempotencyKey } = request.body || {};
  const session = sessions.get(accountId);

  if (!session?.sock || session.status !== "connected") {
    response.status(409).json({ ok: false, error: "Sessão WhatsApp não conectada." });
    return;
  }

  try {
    const digits = String(to || "").replace(/\D/g, "");
    const caption = String(body || "");
    const media = String(mediaUrl || "").trim();
    const message = mediaType === "image" && media
      ? { image: { url: media }, caption }
      : mediaType === "video" && media
        ? { video: { url: media }, caption }
        : { text: caption };
    const result = await session.sock.sendMessage(`${digits}@s.whatsapp.net`, message);
    response.json({
      ok: true,
      providerMessageId: result?.key?.id || idempotencyKey || null,
    });
  } catch (err) {
    logger.warn({ err, accountId }, "Falha ao enviar mensagem.");
    response.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(port, () => {
  logger.info({ port }, "WhatsApp QR worker iniciado.");
});
