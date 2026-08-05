import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/admin/rounds — body: { roundId, action }
 * action: 'open' | 'close' | 'preview' | 'publish'
 * Delegates to the matching security-definer function (double-checked here
 * with requireAdmin as well, since preview/publish return sensitive data).
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { roundId, action, durationHours } = await req.json();
  const supabase = await supabaseServer();

  if (action === "open") {
    const { error } = await supabase.rpc("admin_open_voting", { p_round_id: roundId, p_duration_hours: durationHours || 24 });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (action === "close") {
    const { error } = await supabase.rpc("admin_close_voting", { p_round_id: roundId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (action === "preview") {
    const { data, error } = await supabase.rpc("admin_preview_round", { p_round_id: roundId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, preview: data });
  }
  if (action === "publish") {
    const { data, error } = await supabase.rpc("admin_publish_round", { p_round_id: roundId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, result: data });
  }
  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}

/** GET — list all rounds (admin only). */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = supabaseAdmin();
  const { data } = await db.from("game_rounds").select("*").order("round_number", { ascending: false });
  return NextResponse.json({ rounds: data || [] });
}
