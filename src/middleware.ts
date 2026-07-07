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
const PUBLIC_ROUTES = ["/auth", "/data-deletion", "/privacy-policy", "/portal/", "/api/portal/", "/convite/", "/api/invite/", "/api/leads", "/form/", "/api/form/", "/agendar/", "/api/agendar/", "/api/google-calendar/callback", "/api/cron/"];
// Redirect authenticated users away from these (login page only)
const AUTH_REDIRECT_ROUTES = ["/auth"];

export async function middleware(request: NextRequest) {
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

  // getSession reads the JWT from cookies without a network call — safe for
  // middleware where latency budget is tight (Edge Runtime ~1.5 s limit).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const pathname = request.nextUrl.pathname;
  const isPublicRoute      = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthRedirectRoute = AUTH_REDIRECT_ROUTES.some((r) => pathname.startsWith(r));

  // Not authenticated + trying to access a protected route → redirect to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  // Authenticated + trying to access /auth → redirect to dashboard
  if (user && isAuthRedirectRoute) {
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
     * - api/meta/webhook (Meta crawler has no auth cookies — must bypass auth middleware)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/meta/webhook|api/leads|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
