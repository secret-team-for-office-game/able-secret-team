import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

function toCsv(rows: any[], headers: string[]): string {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return lines.join("\n");
}

/** GET /api/admin/export?type=players|scores|eliminations|cards|csr|prizes */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const type = req.nextUrl.searchParams.get("type") || "players";
  const db = supabaseAdmin();
  let csv = "";

  if (type === "players") {
    const { data } = await db.from("profiles").select("employee_id,full_name,nickname,department,player_status,total_score").eq("role", "player");
    csv = toCsv(data || [], ["employee_id", "full_name", "nickname", "department", "player_status", "total_score"]);
  } else if (type === "players_with_teams") {
    // Admin-only export: joins current team assignment. Never exposed to players.
    const { data } = await db
      .from("player_team_assignments")
      .select("player_id, profiles!inner(employee_id,full_name,nickname,player_status,total_score), teams(team_name)")
      .is("effective_to", null);
    const rows = (data || []).map((r: any) => ({
      employee_id: r.profiles.employee_id, full_name: r.profiles.full_name, nickname: r.profiles.nickname,
      team: r.teams?.team_name, player_status: r.profiles.player_status, total_score: r.profiles.total_score,
    }));
    csv = toCsv(rows, ["employee_id", "full_name", "nickname", "team", "player_status", "total_score"]);
  } else if (type === "eliminations") {
    const { data } = await db.from("eliminations").select("round_id, player_id, votes_received, eliminated_at, revived_at, profiles(employee_id,full_name)");
    const rows = (data || []).map((r: any) => ({
      employee_id: r.profiles?.employee_id, full_name: r.profiles?.full_name,
      round_id: r.round_id, votes_received: r.votes_received, eliminated_at: r.eliminated_at, revived_at: r.revived_at,
    }));
    csv = toCsv(rows, ["employee_id", "full_name", "round_id", "votes_received", "eliminated_at", "revived_at"]);
  } else if (type === "cards") {
    const { data } = await db.from("player_cards").select("player_id, source, status, acquired_at, used_at, profiles(employee_id), card_types(card_code)");
    const rows = (data || []).map((r: any) => ({
      employee_id: r.profiles?.employee_id, card_code: r.card_types?.card_code, source: r.source,
      status: r.status, acquired_at: r.acquired_at, used_at: r.used_at,
    }));
    csv = toCsv(rows, ["employee_id", "card_code", "source", "status", "acquired_at", "used_at"]);
  } else if (type === "csr") {
    const { data } = await db.from("csr_transactions").select("*, profiles(employee_id)");
    const rows = (data || []).map((r: any) => ({
      employee_id: r.profiles?.employee_id, transaction_type: r.transaction_type,
      amount: r.amount, quantity: r.quantity, recorded_by: r.recorded_by, created_at: r.created_at,
    }));
    csv = toCsv(rows, ["employee_id", "transaction_type", "amount", "quantity", "recorded_by", "created_at"]);
  } else if (type === "prizes") {
    const { data } = await db.from("prizes").select("*, profiles(employee_id,full_name)");
    const rows = (data || []).map((r: any) => ({
      prize_code: r.prize_code, prize_name: r.prize_name,
      winner_employee_id: r.profiles?.employee_id, winner_name: r.profiles?.full_name, finalized_at: r.finalized_at,
    }));
    csv = toCsv(rows, ["prize_code", "prize_name", "winner_employee_id", "winner_name", "finalized_at"]);
  } else {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}.csv"`,
    },
  });
}
