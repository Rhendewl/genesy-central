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
  "/agendar/",
  "/api/agendar/",
  "/api/google-calendar/callback",
  "/api/marketing/instagram/webhook",
  "/api/cron/",
  "/api/conversas/webhook/",
];
// Redirect authenticated users away from these (login page only)
const AUTH_REDIRECT_ROUTES = ["/auth"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthRedirectRoute = AUTH_REDIRECT_ROUTES.some((r) => pathname.startsWith(r));

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
