import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin, employeeIdToEmail } from "@/lib/supabase";

/**
 * POST /api/admin/create-player
 * body: { employeeId, password, fullName, nickname?, department? }
 *
 * Admin has collected the CSR donation outside the app. This creates a real
 * Supabase Auth user (via a synthetic email derived from employee_id),
 * assigns the team with the fewest active players, grants the free starter
 * card, and activates the account immediately.
 *
 * SECURITY: password is passed once to Supabase Auth's admin API
 * (service role, server-only) and never written to profiles or any other
 * table. This route never reads a password back out.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { employeeId, password, fullName, nickname, department } = await req.json();

  if (!employeeId || !password || !fullName) {
    return NextResponse.json({ error: "ต้องมีรหัสพนักงาน รหัสผ่าน และชื่อ-สกุล" }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: "รหัสผ่านต้องยาวอย่างน้อย 6 ตัว" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: existing } = await db
    .from("profiles")
    .select("id, user_id")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (existing?.user_id) {
    return NextResponse.json({ error: "มีบัญชีรหัสพนักงานนี้อยู่แล้ว" }, { status: 400 });
  }

  const syntheticEmail = employeeIdToEmail(employeeId);
  const { data: created, error: authErr } = await db.auth.admin.createUser({
    email: syntheticEmail,
    password: String(password),
    email_confirm: true,
  });
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });

  // assign the team with the fewest active players
  const { data: teams } = await db.from("teams").select("id, team_code").eq("is_active", true);
  const { data: assignments } = await db
    .from("player_team_assignments")
    .select("team_id, profiles!inner(player_status)")
    .is("effective_to", null);

  const counts: Record<string, number> = {};
  (teams || []).forEach((t: any) => (counts[t.id] = 0));
  (assignments || []).forEach((a: any) => {
    if (a.profiles?.player_status === "active" && counts[a.team_id] !== undefined) counts[a.team_id]++;
  });
  const chosenTeam = (teams || []).sort((a: any, b: any) => counts[a.id] - counts[b.id])[0];

  let profileId: string;
  if (existing) {
    await db.from("profiles").update({
      user_id: created.user!.id,
      full_name: fullName,
      nickname: nickname || fullName,
      department: department || null,
      player_status: "active",
    }).eq("id", existing.id);
    profileId = existing.id;
  } else {
    const { data: inserted } = await db.from("profiles").insert({
      user_id: created.user!.id,
      employee_id: employeeId,
      full_name: fullName,
      nickname: nickname || fullName,
      department: department || null,
      role: "player",
      player_status: "active",
    }).select("id").single();
    profileId = inserted!.id;
  }

  if (chosenTeam) {
    await db.from("player_team_assignments").insert({
      player_id: profileId,
      team_id: chosenTeam.id,
      assignment_type: "initial",
      assigned_by: "system",
    });
  }

  // grant the free starter card (revive, per default — Admin can change source/type later)
  const { data: starterCard } = await db.from("card_types").select("id").eq("card_code", "revive").maybeSingle();
  if (starterCard) {
    await db.from("player_cards").insert({
      player_id: profileId,
      card_type_id: starterCard.id,
      source: "starter",
      granted_by: "system",
      status: "available",
    });
  }

  // record the CSR registration amount (informational, no slip/approval)
  const { data: settings } = await db.from("system_settings").select("csr_registration_amount").eq("id", 1).single();
  await db.from("csr_transactions").insert({
    player_id: profileId,
    transaction_type: "registration",
    amount: settings?.csr_registration_amount ?? 75,
    quantity: 1,
    recorded_by: admin.employeeId,
  });

  await db.from("audit_logs").insert({
    actor_id: admin.employeeId,
    action_type: "create_player",
    entity_type: "profiles",
    entity_id: profileId,
    after_data: { employeeId, team: chosenTeam?.team_code },
  });

  return NextResponse.json({ ok: true, employeeId, team: chosenTeam?.team_code });
}
