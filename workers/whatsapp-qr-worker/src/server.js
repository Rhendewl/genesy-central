/* eslint-disable react-hooks/rules-of-hooks */
import express from "express";
import { access, readdir } from "node:fs/promises";
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
const maxHistoryMessages = Number(process.env.WHATSAPP_HISTORY_SYNC_LIMIT || 50);
const maxSentMessageCacheSize = Number(process.env.WHATSAPP_SENT_CACHE_LIMIT || 500);
const dashboardWebhookTimeoutMs = Number(process.env.DASHBOARD_WEBHOOK_TIMEOUT_MS || 15000);
const autoRestoreSessions = process.env.WHATSAPP_AUTO_RESTORE_SESSIONS !== "false";

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
  return String(jid || "").split("@")[0].split(":")[0].replace(/\D/g, "");
}

function isLidJid(jid) {
  return typeof jid === "string" && jid.endsWith("@lid");
}

// WhatsApp esconde o número real de alguns contatos atrás de um "@lid"
// (Linked ID) opaco. Quando isso acontece, Baileys expõe o JID real
// (baseado em telefone) em `key.remoteJidAlt`. Sem isso, os dígitos do
// @lid não são um telefone válido e envios de resposta falham.
function resolvePhoneFromKey(key) {
  const remoteJid = key?.remoteJid;
  if (!isLidJid(remoteJid)) return jidToPhone(remoteJid);

  const altJid = key?.remoteJidAlt;
  if (altJid && !isLidJid(altJid)) return jidToPhone(altJid);

  return "";
}

function normalizeRecipientDigits(value) {
  const digits = String(value || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

async function hasPersistedSession(accountId) {
  try {
    await access(`${sessionsDir}/${accountId}/creds.json`);
    return true;
  } catch {
    return false;
  }
}

async function persistedSessionAccountIds() {
  try {
    const entries = await readdir(sessionsDir, { withFileTypes: true });
    const accountIds = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (await hasPersistedSession(entry.name)) accountIds.push(entry.name);
    }

    return accountIds;
  } catch (err) {
    if (err?.code !== "ENOENT") {
      logger.warn({ err, sessionsDir }, "Erro ao listar sessões persistidas do WhatsApp.");
    }
    return [];
  }
}

function messageTypeNames(message) {
  if (!message) return [];
  return Object.keys(message).filter((key) => key !== "messageContextInfo");
}

function extractMessageText(message) {
  if (!message) return "";
  const nestedMessage =
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message.documentWithCaptionMessage?.message ||
    message.protocolMessage?.editedMessage ||
    message.deviceSentMessage?.message;

  if (nestedMessage) return extractMessageText(nestedMessage);

  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.buttonsResponseMessage?.selectedDisplayText ||
    message.buttonsResponseMessage?.selectedButtonId ||
    message.listResponseMessage?.title ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    message.templateButtonReplyMessage?.selectedDisplayText ||
    message.templateButtonReplyMessage?.selectedId ||
    message.interactiveResponseMessage?.body?.text ||
    ""
  ).trim();
}

// WhatsApp pede reenvio de uma mensagem quando o destinatário não consegue
// decriptá-la (aparece como "Aguardando mensagem" no celular de quem recebe).
// Baileys só consegue atender esse pedido se `getMessage` puder devolver o
// conteúdo original — por isso cada sessão guarda um cache das últimas
// mensagens enviadas, indexado pelo id.
function rememberSentMessage(session, id, content) {
  if (!session?.sentMessages || !id) return;
  session.sentMessages.set(id, content);
  if (session.sentMessages.size > maxSentMessageCacheSize) {
    const oldestKey = session.sentMessages.keys().next().value;
    session.sentMessages.delete(oldestKey);
  }
}

function messageTimestampToIso(timestamp) {
  const raw = Number(timestamp || 0);
  if (!Number.isFinite(raw) || raw <= 0) return new Date().toISOString();
  const milliseconds = raw > 10_000_000_000 ? raw : raw * 1000;
  return new Date(milliseconds).toISOString();
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
  const messageMeta = {
    accountId,
    providerMessageId: message.key?.id || null,
    remoteJid,
    isLid: isLidJid(remoteJid),
    fromMe: Boolean(message.key?.fromMe),
    messageTypes: messageTypeNames(message.message),
  };

  if (!remoteJid) {
    logger.info(messageMeta, "Mensagem do WhatsApp ignorada: origem ausente.");
    return;
  }

  if (remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast") || remoteJid === "status@broadcast") {
    logger.info(messageMeta, "Mensagem do WhatsApp ignorada: conversa de grupo/status/broadcast.");
    return;
  }

  const body = extractMessageText(message.message);
  if (!body) {
    logger.info(messageMeta, "Mensagem do WhatsApp ignorada: nenhum texto extraível.");
    return;
  }

  const resolvedPhone = resolvePhoneFromKey(message.key);
  if (!resolvedPhone) {
    logger.warn(
      messageMeta,
      "JID @lid sem remoteJidAlt: telefone real não pôde ser resolvido, usando dígitos do @lid como fallback (respostas para este contato provavelmente falharão).",
    );
  }

  const payload = {
    whatsapp_account_id: accountId,
    from: resolvedPhone || jidToPhone(remoteJid),
    body,
    name: message.pushName || "",
    provider_message_id: message.key?.id || null,
    received_at: messageTimestampToIso(message.messageTimestamp),
    // true quando a mensagem foi enviada pelo próprio WhatsApp do usuário
    // (celular/app oficial), não pelo dashboard — antes disso era descartada
    // e a conversa só mostrava o que o lead enviava, nunca as respostas dadas
    // fora do nosso sistema.
    from_me: Boolean(message.key?.fromMe),
  };
  const endpoints = [
    "/api/conversas/webhook/whatsapp-message",
    "/api/conversas/webhook/message",
  ];

  logger.info(
    { ...messageMeta, from: payload.from, bodyLength: body.length },
    "Encaminhando mensagem recebida ao dashboard.",
  );

  for (const endpoint of endpoints) {
    let response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), dashboardWebhookTimeoutMs);

    try {
      response = await fetch(`${dashboardUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Conversations-Secret": dashboardSecret,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      logger.warn(
        { ...messageMeta, endpoint, err },
        "Falha de transporte ao encaminhar mensagem recebida.",
      );
      continue;
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) {
      logger.info(
        { accountId, endpoint, from: payload.from, providerMessageId: payload.provider_message_id },
        "Mensagem recebida encaminhada ao dashboard.",
      );
      return;
    }

    const error = await response.text().catch(() => "");
    logger.warn({ accountId, endpoint, status: response.status, error }, "Falha ao encaminhar mensagem recebida.");
    if (![404, 405].includes(response.status)) return;
  }
}

async function notifyHistoryMessages(accountId, messages) {
  // Não filtra mais fromMe — mensagens enviadas pelo próprio WhatsApp do
  // usuário também entram na sincronização de histórico, junto com as
  // recebidas (notifyInboundMessage agora trata os dois casos via
  // payload.from_me).
  const syncableMessages = (messages || [])
    .filter((message) => {
      const remoteJid = message.key?.remoteJid;
      return remoteJid && !remoteJid.endsWith("@g.us") && extractMessageText(message.message);
    })
    .sort((a, b) => Number(a.messageTimestamp || 0) - Number(b.messageTimestamp || 0))
    .slice(-Math.max(0, maxHistoryMessages));

  if (syncableMessages.length === 0) return;

  logger.info({ accountId, count: syncableMessages.length }, "Sincronizando mensagens recentes do histórico.");
  for (const message of syncableMessages) {
    await notifyInboundMessage(accountId, message).catch((err) => {
      logger.warn({ err, accountId }, "Erro ao sincronizar mensagem do histórico.");
    });
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
    sentMessages: new Map(),
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
    getMessage: async (key) => session.sentMessages.get(key.id),
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
    logger.info({ accountId, count: messages?.length ?? 0 }, "Evento de mensagens recebido do WhatsApp.");
    for (const message of messages || []) {
      await notifyInboundMessage(accountId, message).catch((err) => {
        logger.warn({ err, accountId }, "Erro ao processar mensagem recebida.");
      });
    }
  });

  sock.ev.on("messaging-history.set", async ({ messages }) => {
    await notifyHistoryMessages(accountId, messages).catch((err) => {
      logger.warn({ err, accountId }, "Erro ao sincronizar histórico de mensagens.");
    });
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

async function restorePersistedSessions() {
  if (!autoRestoreSessions) {
    logger.info("Restauração automática de sessões WhatsApp desativada.");
    return;
  }

  const accountIds = await persistedSessionAccountIds();
  if (accountIds.length === 0) {
    logger.info({ sessionsDir }, "Nenhuma sessão WhatsApp persistida encontrada para restaurar.");
    return;
  }

  logger.info({ count: accountIds.length, accountIds }, "Restaurando sessões WhatsApp persistidas.");
  accountIds.forEach((accountId, index) => {
    setTimeout(() => {
      startSession(accountId).catch((err) => {
        logger.warn({ err, accountId }, "Erro ao restaurar sessão WhatsApp persistida.");
      });
    }, index * 1000);
  });
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

app.get("/accounts/:accountId/status", async (request, response) => {
  const { accountId } = request.params;
  const current = sessions.get(accountId);

  if (!current && await hasPersistedSession(accountId)) {
    logger.info({ accountId }, "Sessão persistida encontrada durante consulta de status; iniciando restauração.");
    startSession(accountId).catch((err) => {
      logger.warn({ err, accountId }, "Erro ao restaurar sessão durante consulta de status.");
    });
    response.json({
      accountId,
      status: "connecting",
      qrCodePayload: null,
      phone: null,
      displayName: null,
      error: null,
    });
    return;
  }

  response.json(sessionSnapshot(accountId));
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
    const digits = normalizeRecipientDigits(to);
    if (!digits) {
      response.status(400).json({ ok: false, error: "Número de destino inválido." });
      return;
    }

    const candidateJid = `${digits}@s.whatsapp.net`;
    const [recipient] = await session.sock.onWhatsApp(candidateJid);
    if (!recipient?.exists) {
      response.status(404).json({
        ok: false,
        error: "Número não encontrado no WhatsApp. Confirme DDI, DDD e telefone.",
      });
      return;
    }

    const jid = recipient.jid || candidateJid;
    const caption = String(body || "");
    const media = String(mediaUrl || "").trim();
    const message = mediaType === "image" && media
      ? { image: { url: media }, caption }
      : mediaType === "video" && media
        ? { video: { url: media }, caption }
        : { text: caption };
    logger.info({ accountId, to: digits, jid }, "Enviando mensagem WhatsApp.");
    const result = await session.sock.sendMessage(jid, message);
    rememberSentMessage(session, result?.key?.id, message);
    logger.info({ accountId, jid, providerMessageId: result?.key?.id || null }, "Mensagem enviada pelo WhatsApp.");
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
  restorePersistedSessions().catch((err) => {
    logger.warn({ err }, "Erro ao restaurar sessões WhatsApp no boot.");
  });
});
