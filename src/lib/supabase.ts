import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/** Browser client — respects RLS via the logged-in user's session. */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Server-only admin client using the service role key.
 * NEVER import this into client components. Used inside API routes for
 * admin operations, after verifying the caller is an admin.
 */
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * Employee ID -> synthetic email for Supabase Auth. Deterministic, not a
 * secret (the domain suffix is a public constant). This is the ONLY place
 * employee_id gets turned into an email; nothing in the UI ever shows or
 * asks for an email.
 */
export function employeeIdToEmail(employeeId: string): string {
  const domain = process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN || "ablesecretteam.internal";
  const clean = employeeId.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${clean}@${domain}`;
}
