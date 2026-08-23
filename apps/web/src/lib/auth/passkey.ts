import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { experimental: { passkey: true } } },
)

export async function signInWithPasskey() {
  return supabase.auth.signInWithPasskey()
}

export async function registerPasskey() {
  return supabase.auth.enrollPasskey()
}
