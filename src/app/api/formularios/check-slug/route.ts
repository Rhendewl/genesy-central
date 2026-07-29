import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ available: false }, { status: 401 });

  const slug    = req.nextUrl.searchParams.get("slug") ?? "";
  const exclude = req.nextUrl.searchParams.get("exclude") ?? "";
  if (!slug) return NextResponse.json({ available: false });

  // Public URLs share one global namespace across all accounts.
  let q = createAdminSupabaseClient()
    .from("forms")
    .select("id")
    .eq("slug", slug)
    .is("deleted_at", null);

  if (exclude) q = q.neq("id", exclude);

  const { data } = await q.maybeSingle();
  return NextResponse.json({ available: !data });
}
