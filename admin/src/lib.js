import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_COMPANY_SUPABASE_URL
const key = import.meta.env.VITE_COMPANY_SUPABASE_ANON_KEY
export const configured = Boolean(url && key)
export const auth = configured ? createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null
export const superAdminOAuthRedirect = () => `${window.location.origin}/super-admin/dashboard`
export function signInSuperAdminWithGoogle() {
  if (!auth) throw new Error('Supabase non è configurato.')
  return auth.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: superAdminOAuthRedirect() } })
}
export async function adminRequest(token, resource, params = {}, options = {}) {
  const query = new URLSearchParams({ adminResource: resource, ...Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value != null)) })
  const response = await fetch(`/api/super-admin?${query}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers, Authorization: `Bearer ${token}` }, cache: 'no-store' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (options.method === 'PATCH') window.alert(`Operazione non riuscita: ${body.error ?? 'REQUEST_FAILED'}`)
    throw Object.assign(new Error(body.error ?? 'REQUEST_FAILED'), { status: response.status })
  }
  if (options.method === 'PATCH') { window.alert('Operazione completata. I dati verranno aggiornati.'); window.setTimeout(() => window.location.reload(), 400) }
  return body
}
