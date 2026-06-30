import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ available: false }, { status: 401 });

  const slug    = req.nextUrl.searchParams.get("slug") ?? "";
  const exclude = req.nextUrl.searchParams.get("exclude") ?? "";
  if (!slug) return NextResponse.json({ available: false });

  let q = supabase
    .from("forms")
    .select("id")
    .eq("user_id", user.id)
    .eq("slug", slug)
    .is("deleted_at", null);

  if (exclude) q = q.neq("id", exclude);

  const { data } = await q.maybeSingle();
  return NextResponse.json({ available: !data });
}
