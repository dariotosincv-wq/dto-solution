import { useEffect, useState } from 'react'
import { auth } from './lib.js'
import { readMfaState, verifyTotpCode } from './mfaFlow.js'

const messageFor = (error) => error.message === 'MFA_CODE_INVALID' ? 'Inserisci il codice di 6 cifre.' : error.message === 'MFA_VERIFY_FAILED' ? 'Codice non valido o scaduto.' : 'Verifica TOTP non riuscita. Riprova.'

export default function MfaChallengePage() {
  const [factorId, setFactorId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    readMfaState(auth).then((state) => {
      if (!active) return
      if (state.currentLevel === 'aal2') window.location.replace('/super-admin/dashboard')
      else { setFactorId(state.verified[0]?.id ?? null); setLoading(false) }
    }).catch(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await verifyTotpCode(auth, { factorId, code }); window.location.replace('/super-admin/dashboard') }
    catch (reason) { setError(messageFor(reason)); setBusy(false) }
  }

  if (loading) return <main className="state">Verifica MFA…</main>
  return <main className="login"><section><img src="/brand/dto-solution-horizontal.svg" alt="DTO Solution"/><p className="kicker">Verifica richiesta</p><h1>Autenticazione a due fattori</h1>{factorId ? <><p>Inserisci il codice generato dalla tua app Authenticator.</p><form onSubmit={submit}><label>Codice a 6 cifre<input aria-label="Codice TOTP" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}/></label><button disabled={busy || code.length !== 6}>{busy ? 'Verifica…' : 'Verifica'}</button></form></> : <p className="notice error">Nessun fattore TOTP verificato disponibile.</p>}{error && <p className="notice error" role="alert">{error}</p>}<button className="challenge-logout" type="button" onClick={() => auth.auth.signOut()}>Esci</button></section></main>
}
