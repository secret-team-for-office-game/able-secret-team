import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, requireAdmin } from "@/lib/auth";

/** POST /api/admin/cards — body: { employeeId, cardCode, qty, amount } */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { employeeId, cardCode, qty, amount } = await req.json();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("admin_grant_card", {
    p_employee_id: employeeId, p_card_code: cardCode, p_qty: qty || 1, p_amount: amount || 0,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}
