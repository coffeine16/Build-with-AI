import { createClient } from "@supabase/supabase-js";

// Read-only client for the dashboard's live panels. Uses the anon key and
// Supabase's auto-generated REST — there is no custom API server. RLS is
// off in this project (hackathon posture), so the anon key can read the
// tables directly. If the env vars aren't set, `supabase` is null and the
// UI falls back to a "not configured" state instead of crashing.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const supabaseReady = Boolean(supabase);
