import { NextResponse } from "next/server";
import { DEVELOPMENT_APP_VERSION } from "@/lib/app-version";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || DEVELOPMENT_APP_VERSION;

  return NextResponse.json(
    { version },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
  );
}
