import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when the build has no Supabase credentials, so we can explain rather than crash. */
export const missingConfig = !url || !anonKey

// The anon key is meant to ship to the browser; row level security, not secrecy,
// is what keeps one account's cards away from another's.
export const supabase: SupabaseClient = missingConfig
  ? (null as unknown as SupabaseClient)
  : createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
