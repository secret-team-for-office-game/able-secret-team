import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, requireAdmin } from "@/lib/auth";

/** POST /api/admin/prizes — body: { action: 'finalize' | 'lucky_draw', reason? } */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { action, reason } = await req.json();
  const supabase = await supabaseServer();

  if (action === "finalize") {
    const { data, error } = await supabase.rpc("admin_finalize_prizes");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  }
  if (action === "lucky_draw") {
    const { data, error } = await supabase.rpc("admin_lucky_draw", { p_reason: reason || null });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  }
  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
