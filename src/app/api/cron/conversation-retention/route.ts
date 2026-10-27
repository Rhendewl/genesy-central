import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
export async function GET(req: NextRequest) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const actual = req.headers.get("authorization") ?? "";
  if (
    !process.env.CRON_SECRET ||
    actual.length !== expected.length ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    return new NextResponse(null, { status: 401 });
  const { error } = await createAdminSupabaseClient().rpc("ci_purge");
  return NextResponse.json({ ok: !error }, { status: error ? 503 : 200 });
}
