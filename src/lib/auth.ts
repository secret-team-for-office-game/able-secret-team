import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase";

/**
 * Server client bound to the request's cookies (respects RLS).
 * Next.js 15+ makes cookies() async; @supabase/ssr expects getAll()/setAll().
 */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // ignore when called from a context where cookies are read-only
          }
        },
      },
    }
  );
}

/** Verify the caller is an admin (admin or super_admin). Returns their employee_id, or null. */
export async function requireAdmin(): Promise<{ employeeId: string; isSuperAdmin: boolean } | null> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = supabaseAdmin();
  const { data } = await db
    .from("profiles")
    .select("employee_id,role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data || (data.role !== "admin" && data.role !== "super_admin")) return null;
  return { employeeId: data.employee_id, isSuperAdmin: data.role === "super_admin" };
}

/** Verify the caller is a super_admin specifically. */
export async function requireSuperAdmin(): Promise<string | null> {
  const res = await requireAdmin();
  return res?.isSuperAdmin ? res.employeeId : null;
}
