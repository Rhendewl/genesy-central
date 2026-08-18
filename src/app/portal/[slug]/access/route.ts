import { NextRequest, NextResponse } from "next/server";
import {
  authorizePortalAccess,
  portalAccessCookieName,
  portalNoStoreHeaders,
} from "@/lib/portal-access";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const token = req.nextUrl.searchParams.get("token");
  const access = await authorizePortalAccess(req, slug, token);

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status, headers: portalNoStoreHeaders() },
    );
  }

  const destination = new URL(`/portal/${encodeURIComponent(slug)}`, req.url);
  const response = NextResponse.redirect(destination, { status: 303 });
  const maxAge = Math.max(0, Math.floor((new Date(access.expiresAt).getTime() - Date.now()) / 1000));
  response.cookies.set(portalAccessCookieName(slug), token!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: `/api/portal/${slug}`,
    maxAge,
  });
  for (const [name, value] of Object.entries(portalNoStoreHeaders())) {
    response.headers.set(name, String(value));
  }
  return response;
}
