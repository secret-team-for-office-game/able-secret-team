import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, requireAdmin } from "@/lib/auth";

/** POST /api/admin/revive — body: { employeeId, note? } */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { employeeId, note } = await req.json();
  if (!employeeId) return NextResponse.json({ error: "ต้องระบุรหัสพนักงาน" }, { status: 400 });

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("admin_revive_player", {
    p_employee_id: employeeId, p_note: note || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}
