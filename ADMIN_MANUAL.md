import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/auth";

/**
 * POST /api/cards/use — body: { cardId, cardCode, targetId? }
 * Delegates to the matching security-definer function; all authorization
 * and business-rule checks happen inside Postgres, not here.
 */
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { cardId, cardCode, targetId } = await req.json();

  let result;
  if (cardCode === "reveal") {
    result = await supabase.rpc("use_reveal_card", { p_card_id: cardId, p_target_id: targetId });
  } else if (cardCode === "revive") {
    result = await supabase.rpc("use_revive_card", { p_card_id: cardId, p_target_id: targetId });
  } else if (cardCode === "team_switch") {
    result = await supabase.rpc("use_team_switch_card", { p_card_id: cardId });
  } else {
    return NextResponse.json({ error: "invalid card code" }, { status: 400 });
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data: result.data });
}
