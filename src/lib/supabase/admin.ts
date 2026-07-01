import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role (admin) client — bypasses RLS. SERVER-ONLY: it uses the secret
// SUPABASE_SERVICE_ROLE_KEY and must never be imported into client code. Used
// for privileged operations that the anon/RLS client can't do (e.g. minting a
// login session for a specific user via the Auth admin API).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
