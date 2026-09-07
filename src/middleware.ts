import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Auth Middleware
// Protects all routes except /auth
// Refreshes session tokens automatically (Supabase SSR requirement)
// ─────────────────────────────────────────────────────────────────────────────

// Accessible without login
// api/cron/ é chamada pelo pg_cron do Supabase (sem cookie de sessão) — a
// própria rota valida o header X-Cron-Secret, então fica de fora do
// middleware de auth por sessão, como api/meta/webhook.
const PUBLIC_ROUTES = [
  "/auth",
  "/data-deletion",
  "/privacy-policy",
  "/brand/",
  "/portal/",
  "/api/portal/",
  "/convite/",
  "/api/invite/",
  "/api/leads",
  "/form/",
  "/api/form/",
  "/analise-comercial/",
  "/coleta/",
  "/api/commercial-collections/",
  "/agendar/",
  "/api/agendar/",
  "/api/google-calendar/callback",
  "/api/marketing/instagram/webhook",
  "/api/cron/",
  "/api/conversas/webhook/",
];
// Redirect authenticated users away from these (login page only)
const AUTH_REDIRECT_ROUTES = ["/auth"];
const PUBLIC_SHARE_ROUTES = ["/portal/", "/form/", "/analise-comercial/", "/coleta/", "/agendar/"];
const PUBLIC_SHARE_API_ROUTES = ["/api/portal/", "/api/form/", "/api/commercial-collections/", "/api/agendar/"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthRedirectRoute = AUTH_REDIRECT_ROUTES.some((r) => pathname.startsWith(r));
  const isPublicShareHost = request.nextUrl.hostname === "go.genesycompany.com";

  if (isPublicShareHost) {
    if (pathname === "/") {
      const landingUrl = request.nextUrl.clone();
      landingUrl.pathname = "/acesso-publico";
      return NextResponse.rewrite(landingUrl);
    }

    const isAllowedShareRoute = PUBLIC_SHARE_ROUTES.some((route) => pathname.startsWith(route));
    const isAllowedShareApi = PUBLIC_SHARE_API_ROUTES.some((route) => pathname.startsWith(route));
    if (!isAllowedShareRoute && !isAllowedShareApi) {
      const landingUrl = request.nextUrl.clone();
      landingUrl.pathname = "/";
      landingUrl.search = "";
      return NextResponse.redirect(landingUrl, 307);
    }
  }

  // Mantém o dashboard como superfície interna. Links públicos antigos seguem
  // funcionando, mas passam para o domínio de compartilhamento preservando
  // slug, query string e eventuais tokens de acesso.
  if (request.nextUrl.hostname === "dash.genesycompany.com" && PUBLIC_SHARE_ROUTES.some((route) => pathname.startsWith(route))) {
    const publicUrl = request.nextUrl.clone();
    publicUrl.hostname = "go.genesycompany.com";
    publicUrl.protocol = "https:";
    return NextResponse.redirect(publicUrl, 308);
  }

  // Rotas públicas não precisam criar o cliente Supabase nem inspecionar a
  // sessão. Isso reduz o trabalho no edge e permite cache de CDN no HTML dos
  // formulários. /auth continua abaixo para redirecionar usuários logados.
  if (isPublicRoute && !isAuthRedirectRoute) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser valida o JWT no servidor do Supabase. Depois, o perfil ativo é
  // conferido para impedir que contas desativadas ou removidas continuem
  // usando uma sessão antiga.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasActiveAccess = false;
  if (user) {
    const { data: profiles, error: profileError } = await supabase
      .from("user_profiles")
      .select("is_active")
      .eq("auth_user_id", user.id);
    hasActiveAccess = !profileError && (profiles ?? []).some((profile) => profile.is_active);

    if (!hasActiveAccess) {
      // Limpa os cookies no carregamento da página de login. Em uma rota
      // protegida, o redirecionamento chega aqui logo na requisição seguinte.
      await supabase.auth.signOut({ scope: "local" });
    }
  }

  // Not authenticated + trying to access a protected route → redirect to login
  if ((!user || !hasActiveAccess) && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    if (user && !hasActiveAccess) url.searchParams.set("reason", "access_disabled");
    return NextResponse.redirect(url);
  }

  // Authenticated + trying to access /auth → redirect to dashboard
  if (user && hasActiveAccess && isAuthRedirectRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets
     * - Meta/Instagram webhooks (Meta crawler has no auth cookies — must bypass auth middleware)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/meta/webhook|api/marketing/instagram/webhook|api/leads|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|otf|woff|woff2)$).*)",
  ],
};
