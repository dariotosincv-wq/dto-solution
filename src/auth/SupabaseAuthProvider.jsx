import { useEffect, useMemo, useState } from 'react'
import {
  isSupabaseConfigured,
  signInWithGoogle,
  signOut,
  supabase,
} from '../lib/supabase.js'
import { SupabaseAuthContext } from './supabaseAuthContext.js'

function getOAuthError() {
  const parameters = new URLSearchParams(window.location.search)
  return parameters.get('error_description') || parameters.get('error') || ''
}

export function SupabaseAuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState(() => getOAuthError())

  useEffect(() => {
    if (!supabase) return undefined

    let isMounted = true

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!isMounted) return
      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setIsLoading(false)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const loginWithGoogle = async () => {
    setError('')
    const { error: loginError } = await signInWithGoogle()
    if (loginError) {
      setError(loginError.message)
      throw loginError
    }
  }

  const logout = async () => {
    setError('')
    const { error: logoutError } = await signOut()
    if (logoutError) {
      setError(logoutError.message)
      throw logoutError
    }
  }

  const value = useMemo(() => ({
    isConfigured: isSupabaseConfigured,
    isLoading,
    isAuthenticated: Boolean(session?.user),
    session,
    user: session?.user ?? null,
    userId: session?.user?.id ?? null,
    email: session?.user?.email ?? null,
    error,
    loginWithGoogle,
    logout,
  }), [error, isLoading, session])

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  )
}
