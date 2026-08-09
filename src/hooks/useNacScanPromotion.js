import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const PROMOTION_CODE = 'nacscan_free_forever_2026'
const CLAIM_COLUMNS = 'id,user_id,promotion_code,requested_at,status,permanent_entitlement_at'

function normalizeClaim(data) {
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null)
}

function getFriendlyError(error) {
  const message = error?.message?.toLowerCase() ?? ''
  const code = error?.code ?? ''

  if (message.includes('claim period has ended')) {
    return {
      message: 'La promozione NACScan è terminata il 30 settembre 2026.',
      isExpired: true,
    }
  }

  if (
    error?.status === 401
    || code === '28000'
    || code === 'PGRST301'
    || message.includes('jwt')
    || message.includes('authentication required')
    || message.includes('not authenticated')
  ) {
    return {
      message: 'La sessione è scaduta. Accedi nuovamente con Google.',
      isExpired: false,
    }
  }

  if (message.includes('failed to fetch') || message.includes('network')) {
    return {
      message: 'Impossibile contattare il servizio. Controlla la connessione e riprova.',
      isExpired: false,
    }
  }

  return {
    message: 'Non è stato possibile gestire l’adesione. Riprova tra poco.',
    isExpired: false,
  }
}

export function useNacScanPromotion({ isAuthenticated, userId }) {
  const [claim, setClaim] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [error, setError] = useState('')
  const [errorContext, setErrorContext] = useState(null)
  const [isExpired, setIsExpired] = useState(false)
  const loadSequence = useRef(0)
  const claimRequest = useRef(null)

  const loadClaim = useCallback(async () => {
    const sequence = ++loadSequence.current

    if (!isAuthenticated || !userId || !supabase) {
      setClaim(null)
      setError('')
      setErrorContext(null)
      setIsExpired(false)
      setIsLoading(false)
      return null
    }

    setIsLoading(true)
    setError('')
    setErrorContext(null)

    let data
    let selectError

    try {
      const result = await supabase
        .from('nacscan_promotion_claims')
        .select(CLAIM_COLUMNS)
        .eq('user_id', userId)
        .eq('promotion_code', PROMOTION_CODE)
        .maybeSingle()

      data = result.data
      selectError = result.error
    } catch (unexpectedError) {
      selectError = unexpectedError
    }

    if (sequence !== loadSequence.current) return null

    if (selectError) {
      const friendlyError = getFriendlyError(selectError)
      setClaim(null)
      setError(friendlyError.message)
      setErrorContext('load')
      setIsExpired(friendlyError.isExpired)
      setIsLoading(false)
      return null
    }

    const existingClaim = normalizeClaim(data)
    setClaim(existingClaim)
    setIsExpired(false)
    setIsLoading(false)
    return existingClaim
  }, [isAuthenticated, userId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadClaim()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadClaim])

  const claimPromotion = useCallback(async () => {
    if (claimRequest.current) return claimRequest.current

    const request = (async () => {
      if (!isAuthenticated || !userId || !supabase) {
        setError('Accedi con Google prima di aderire alla promozione.')
        setErrorContext('claim')
        return null
      }

      setIsClaiming(true)
      setError('')
      setErrorContext(null)
      setIsExpired(false)

      try {
        const { data, error: rpcError } = await supabase.rpc('claim_nacscan_promotion')

        if (rpcError) {
          const friendlyError = getFriendlyError(rpcError)
          setError(friendlyError.message)
          setErrorContext('claim')
          setIsExpired(friendlyError.isExpired)
          return null
        }

        const registeredClaim = normalizeClaim(data)

        if (!registeredClaim) {
          setError('Non è stato possibile confermare l’adesione. Riprova tra poco.')
          setErrorContext('claim')
          return null
        }

        ++loadSequence.current
        setClaim(registeredClaim)
        return registeredClaim
      } catch (unexpectedError) {
        const friendlyError = getFriendlyError(unexpectedError)
        setError(friendlyError.message)
        setErrorContext('claim')
        setIsExpired(friendlyError.isExpired)
        return null
      } finally {
        setIsClaiming(false)
      }
    })()

    claimRequest.current = request

    try {
      return await request
    } finally {
      claimRequest.current = null
    }
  }, [isAuthenticated, userId])

  return {
    claim,
    claimPromotion,
    error,
    errorContext,
    isClaiming,
    isExpired,
    isLoading,
    refresh: loadClaim,
  }
}
