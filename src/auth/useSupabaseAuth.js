import { useContext } from 'react'
import { SupabaseAuthContext } from './supabaseAuthContext.js'

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext)

  if (!context) {
    throw new Error('useSupabaseAuth deve essere usato dentro SupabaseAuthProvider.')
  }

  return context
}
