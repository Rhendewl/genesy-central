// ── POST /api/leads ───────────────────────────────────────────────────────────
// Generic webhook endpoint for receiving leads from external systems.
// Authentication: X-Api-Key header containing the user's UUID.
// Body: { name, phone?, email?, source?, notes? }

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "X-Api-Key header required" }, { status: 401 });
  }

  // Validate UUID format
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(apiKey)) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();

  // Verify user exists
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(apiKey);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const userId = userData.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name    = typeof body.name  === "string" ? body.name.trim()  : "";
  const phone   = typeof body.phone === "string" ? body.phone.trim() : null;
  const email   = typeof body.email === "string" ? body.email.trim() : null;
  const notes   = typeof body.notes === "string" ? body.notes.trim() : null;
  const extSrc  = typeof body.source === "string" ? body.source.trim() : null;

  if (!name) {
    return NextResponse.json({ error: "'name' field is required" }, { status: 422 });
  }

  if (!phone && !email) {
    return NextResponse.json({ error: "At least 'phone' or 'email' is required" }, { status: 422 });
  }

  // Deduplication: same phone or email for this user
  let is_duplicate = false;
  const orParts: string[] = [];
  if (phone) orParts.push(`contact.eq.${phone}`);
  if (email) orParts.push(`email.eq.${email}`);

  if (orParts.length > 0) {
    const { data: dupe } = await admin
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .or(orParts.join(","))
      .maybeSingle();
    if (dupe) is_duplicate = true;
  }

  const { data: lead, error: insertErr } = await admin
    .from("leads")
    .insert({
      user_id:       userId,
      name,
      contact:       phone || email || "",
      email:         email  || null,
      source:        "external_webhook",
      notes:         notes || (extSrc ? `Origem: ${extSrc}` : null),
      kanban_column: "abordados",
      tags:          [],
      deal_value:    0,
      entered_at:    new Date().toISOString().split("T")[0],
      is_duplicate,
    })
    .select("id, name")
    .single();

  if (insertErr) {
    console.error("[api/leads] insert error:", insertErr.message);
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }

  return NextResponse.json({ success: true, lead }, { status: 201 });
}
