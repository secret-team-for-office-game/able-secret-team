import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Central redirector: admin/super_admin → /admin, everyone else → /play. */
export default async function RouteGate() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const db = supabaseAdmin();
  const { data: prof } = await db
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (prof?.role === "admin" || prof?.role === "super_admin") redirect("/admin");
  redirect("/play");
}
