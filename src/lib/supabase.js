import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const nacScanPath = '/applicazioni/nacscan'

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        flowType: 'pkce',
      },
    })
  : null

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase non è configurato.')

  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${nacScanPath}`,
    },
  })
}

export async function signOut() {
  if (!supabase) throw new Error('Supabase non è configurato.')
  return supabase.auth.signOut()
}
