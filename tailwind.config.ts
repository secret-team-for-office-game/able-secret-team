import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/auth";

/** POST /api/vote — body: { roundId, targetId }. Delegates entirely to cast_vote() in Postgres. */
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { roundId, targetId } = await req.json();
  const { data, error } = await supabase.rpc("cast_vote", { p_round_id: roundId, p_target_player_id: targetId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}
