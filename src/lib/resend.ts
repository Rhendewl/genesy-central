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
