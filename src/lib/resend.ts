import { Resend } from "resend";

// Lazy: o cliente só é criado quando a função é chamada (nunca no build)
export function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY não configurada");
  return new Resend(key);
}

export function buildInviteEmail({
  recipientName,
  inviteLink,
  roleName,
}: {
  recipientName: string;
  inviteLink: string;
  roleName: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Convite Lancaster</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:48px auto 0;padding:0 16px 48px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.04em;">Lancaster</span>
    </div>

    <!-- Card -->
    <div style="background:#111;border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

      <!-- Top accent -->
      <div style="height:3px;background:linear-gradient(90deg,#27a3ff,#7c3aed);"></div>

      <div style="padding:40px 36px;">
        <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
          Você foi convidado!
        </h2>
        <p style="margin:0 0 28px;font-size:14px;line-height:1.7;color:rgba(255,255,255,0.55);">
          Olá <strong style="color:#fff;">${recipientName}</strong>,<br>
          você foi convidado para acessar a plataforma Lancaster como
          <strong style="color:#27a3ff;">${roleName}</strong>.
          Clique no botão abaixo para criar sua senha e começar.
        </p>

        <!-- CTA -->
        <a href="${inviteLink}"
           style="display:inline-block;background:#27a3ff;color:#000;font-size:14px;font-weight:700;
                  text-decoration:none;padding:13px 28px;border-radius:10px;letter-spacing:-0.01em;">
          Aceitar convite →
        </a>

        <!-- Divider -->
        <div style="margin:32px 0;height:1px;background:rgba(255,255,255,0.07);"></div>

        <!-- Link fallback -->
        <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.3);">
          Se o botão não funcionar, copie e cole este link no navegador:
        </p>
        <p style="margin:0;font-size:11px;word-break:break-all;color:rgba(39,163,255,0.7);">${inviteLink}</p>

        <!-- Footer note -->
        <p style="margin:28px 0 0;font-size:11px;color:rgba(255,255,255,0.2);">
          Este link é válido por 7 dias. Se não reconhece este convite, ignore este e-mail.
        </p>
      </div>
    </div>

  </div>
</body>
</html>`;
}

function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

export function buildCommercialAnalysisEmail({
  clientName,
  collectionName,
  analysisLink,
  isTest = false,
}: {
  clientName: string;
  collectionName: string;
  analysisLink: string;
  isTest?: boolean;
}): string {
  const safeClient = escapeEmailHtml(clientName);
  const safeCollection = escapeEmailHtml(collectionName);
  const safeLink = escapeEmailHtml(analysisLink);
  const safeLogo = escapeEmailHtml(new URL("/favicon.png", analysisLink).toString());
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Análise Comercial · Genesy</title></head>
<body style="margin:0;padding:0;background:#050607;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#f2f3f4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#050607;">
    <tr><td align="center" style="padding:44px 16px;">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;">
        <tr><td align="center" style="padding:0 0 28px;">
          <img src="${safeLogo}" width="42" height="42" alt="Genesy" style="display:inline-block;width:42px;height:42px;border:0;vertical-align:middle;">
          <span style="display:inline-block;margin-left:11px;color:#f2f3f4;font-size:22px;font-weight:700;letter-spacing:-.04em;vertical-align:middle;">genesy</span>
        </td></tr>
        <tr><td style="overflow:hidden;border:1px solid #272c30;border-radius:24px;background:#0b0d0f;">
          <div style="height:3px;background:#aeb6bc;background:linear-gradient(90deg,#707a81,#d9dde0,#707a81);"></div>
          <div style="padding:40px 36px 36px;">
            ${isTest ? '<p style="margin:0 0 16px;color:#aeb6bc;font-size:10px;font-weight:700;letter-spacing:.18em;">E-MAIL DE TESTE</p>' : ''}
            <h1 style="margin:0 0 14px;color:#f4f5f6;font-size:24px;font-weight:650;line-height:1.25;letter-spacing:-.025em;">Sua análise comercial está pronta</h1>
            <p style="margin:0 0 24px;color:#9ba3a8;font-size:14px;line-height:1.75;">A <strong style="color:#f2f3f4;">Genesy</strong> está coletando percepções sobre os leads da <strong style="color:#f2f3f4;">${safeClient}</strong> para transformar o retorno da equipe comercial em decisões mais precisas de marketing.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;border:1px solid #23282c;border-radius:14px;background:#101316;">
              <tr><td style="padding:16px 18px;">
                <p style="margin:0 0 5px;color:#737d83;font-size:9px;font-weight:700;letter-spacing:.15em;">RODADA DE ANÁLISE</p>
                <p style="margin:0;color:#dfe2e4;font-size:14px;font-weight:600;line-height:1.45;">${safeCollection}</p>
              </td></tr>
            </table>
            <p style="margin:0 0 24px;color:#9ba3a8;font-size:14px;line-height:1.7;">Selecione seu nome e responda às perguntas sobre os leads atendidos. Leva apenas alguns minutos.</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:12px;background:#f2f3f4;">
              <a href="${safeLink}" style="display:inline-block;padding:14px 25px;color:#090a0b;font-size:14px;font-weight:700;text-decoration:none;">Responder análise comercial&nbsp;&nbsp;→</a>
            </td></tr></table>
            <div style="height:1px;margin:32px 0 24px;background:#22272a;"></div>
            <p style="margin:0 0 7px;color:#626b71;font-size:11px;line-height:1.5;">Se o botão não abrir, copie este endereço:</p>
            <p style="margin:0;word-break:break-all;color:#aeb6bc;font-size:11px;line-height:1.55;">${safeLink}</p>
          </div>
        </td></tr>
        <tr><td align="center" style="padding:22px 18px 0;color:#5f686e;font-size:10px;line-height:1.6;">Enviado pela Genesy · Inteligência que aproxima marketing e vendas</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
