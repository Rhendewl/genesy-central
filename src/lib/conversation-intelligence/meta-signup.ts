export type MetaLoginResponse = {
  authResponse?: { code?: string };
  status?: string;
};
export type MetaSdk = {
  init: (options: Record<string, unknown>) => void;
  login: (
    callback: (response: MetaLoginResponse) => void,
    options: Record<string, unknown>,
  ) => void;
};
export const META_SIGNUP_HELP =
  "Se a janela não abriu, permita pop-ups para este site. O administrador também deve conferir na Meta se “Entrar com o SDK do JavaScript” está ativado e se o domínio do dashboard está autorizado.";

// Called synchronously from the button click: no network/await before SDK login.
export function launchMetaSignup(options: {
  sdk: MetaSdk;
  configId: string;
  onFinish: (data: { code: string; phoneId: string; wabaId: string }) => void;
  onFailure: (message: string) => void;
  onSlow: () => void;
  target?: Window;
}) {
  const target = options.target ?? window;
  let code = "",
    phoneId = "",
    wabaId = "",
    stopped = false;
  const cleanup = () => {
    stopped = true;
    target.removeEventListener("message", listener);
    target.clearTimeout(slowTimer);
    target.clearTimeout(expirationTimer);
  };
  const fail = (message: string) => {
    if (stopped) return;
    cleanup();
    options.onFailure(message);
  };
  const finish = () => {
    if (stopped || !code || !phoneId || !wabaId) return;
    cleanup();
    options.onFinish({ code, phoneId, wabaId });
  };
  const listener = (event: MessageEvent) => {
    if (
      !["https://www.facebook.com", "https://web.facebook.com"].includes(
        event.origin,
      )
    )
      return;
    let message;
    try {
      message =
        typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    } catch {
      return;
    }
    if (message?.type !== "WA_EMBEDDED_SIGNUP") return;
    // Some v4 flows use generic FINISH. The server independently proves Coexistence.
    if (
      ["FINISH", "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"].includes(
        message.event,
      )
    ) {
      const data = message.data;
      if (
        typeof data?.phone_number_id !== "string" ||
        !/^\d+$/.test(data.phone_number_id) ||
        typeof data?.waba_id !== "string" ||
        !/^\d+$/.test(data.waba_id)
      ) {
        fail(
          "A Meta concluiu o fluxo sem informar o número e a conta. Inicie uma nova tentativa.",
        );
        return;
      }
      phoneId = data.phone_number_id;
      wabaId = data.waba_id;
      finish();
    } else if (message.event === "CANCEL") {
      fail("A conexão foi cancelada na Meta. Você pode tentar novamente.");
    } else if (message.event === "ERROR") {
      fail(
        "A Meta não concluiu a conexão. Confira a configuração do aplicativo e tente novamente.",
      );
    }
  };
  const slowTimer = target.setTimeout(() => {
    if (!stopped) options.onSlow();
  }, 8000);
  const expirationTimer = target.setTimeout(
    () => fail("A tentativa expirou após 10 minutos. Inicie novamente."),
    600000,
  );
  target.addEventListener("message", listener);
  try {
    options.sdk.login(
      (response) => {
        if (stopped) return;
        const returnedCode = response?.authResponse?.code;
        if (typeof returnedCode !== "string" || !returnedCode) {
          fail(
            "A Meta não retornou autorização. A janela pode ter sido fechada ou bloqueada. " +
              META_SIGNUP_HELP,
          );
          return;
        }
        code = returnedCode;
        finish();
      },
      {
        config_id: options.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          version: "v4",
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      },
    );
  } catch {
    fail("Não foi possível abrir a conexão na Meta. " + META_SIGNUP_HELP);
  }
  return cleanup;
}
