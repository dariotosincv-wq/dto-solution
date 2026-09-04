import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { companySupabase, isCompanySupabaseConfigured, loadCompanyAccess } from '../lib/companySupabase.js'
import { COMPANY_ROUTES } from '../routes.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [access, setAccess] = useState(null)
  const [loading, setLoading] = useState(isCompanySupabaseConfigured)
  const [error, setError] = useState('')
  const sessionRef = useRef(null)
  const accessRef = useRef(null)

  const refreshAccess = useCallback(async () => {
    if (!session?.access_token) return null
    setLoading(true); setError('')
    try {
      const context = await loadCompanyAccess(session.access_token)
      accessRef.current = context; setAccess(context)
      return context
    } catch (reason) {
      setError(reason.message)
      throw reason
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (!companySupabase) return undefined
    let active = true
    const resolve = async (nextSession) => {
      if (!active) return
      const sameIdentity = Boolean(nextSession?.user?.id && nextSession.user.id === sessionRef.current?.user?.id && accessRef.current)
      sessionRef.current = nextSession
      setSession(nextSession)
      if (sameIdentity) return
      setLoading(true)
      accessRef.current = null; setAccess(null); setError('')
      if (!nextSession) { setLoading(false); return }
      try { const context = await loadCompanyAccess(nextSession.access_token); if (active) { accessRef.current = context; setAccess(context) } }
      catch (reason) { if (active) setError(reason.message) }
      finally { if (active) setLoading(false) }
    }
    companySupabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError && active) setError(sessionError.message)
      resolve(data.session)
    })
    const { data } = companySupabase.auth.onAuthStateChange((_event, nextSession) => resolve(nextSession))
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  const value = useMemo(() => ({
    session, access, loading, error, configured: isCompanySupabaseConfigured,
    signIn: (email, password) => companySupabase.auth.signInWithPassword({ email, password }),
    signInWithGoogle: (redirectTo = COMPANY_ROUTES.dashboard) => companySupabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${redirectTo}` } }),
    signOut: () => companySupabase.auth.signOut(), refreshAccess,
  }), [access, error, loading, refreshAccess, session])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
