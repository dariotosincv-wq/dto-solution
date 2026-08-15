import { createClient } from '@supabase/supabase-js'

const checkvanSupabaseUrl = import.meta.env.VITE_CHECKVAN_SUPABASE_URL
const checkvanSupabaseAnonKey = import.meta.env.VITE_CHECKVAN_SUPABASE_ANON_KEY

export const isCheckvanSupabaseConfigured = Boolean(
  checkvanSupabaseUrl && checkvanSupabaseAnonKey,
)

export const checkvanSupabase = isCheckvanSupabaseConfigured
  ? createClient(checkvanSupabaseUrl, checkvanSupabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    })
  : null

export async function verifyCheckvanDocumentHash(sha256) {
  if (!checkvanSupabase) throw new Error('CHECKVAN_NOT_CONFIGURED')

  const { data, error } = await checkvanSupabase.rpc(
    'verify_checkvan_document_hash',
    { p_sha256: sha256 },
  )

  if (error) throw new Error('CHECKVAN_VERIFICATION_UNAVAILABLE')
  if (typeof data !== 'boolean') throw new Error('CHECKVAN_INVALID_RESPONSE')

  return data
}
