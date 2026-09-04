import { useEffect, useState } from 'react'
import { auth } from './lib.js'
import { beginTotpEnrollment, readMfaState, verifyTotpCode } from './mfaFlow.js'

const qrSource = (value) => value?.startsWith('data:') ? value : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value ?? '')}`
const friendlyError = (error) => error.message === 'MFA_CODE_INVALID' ? 'Inserisci il codice di 6 cifre.' : error.message === 'MFA_VERIFY_FAILED' ? 'Codice non valido o scaduto.' : 'Operazione MFA non riuscita. Riprova.'

export default function MfaSecurityPage() {
  const [state, setState] = useState({ loading: true, verified: [], currentLevel: null })
  const [enrollment, setEnrollment] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    readMfaState(auth).then((value) => active && setState({ ...value, loading: false })).catch(() => active && setState({ loading: false, verified: [], currentLevel: null, error: true }))
    return () => { active = false }
  }, [])

  const start = async () => {
    setBusy(true); setMessage('')
    try {
      const result = await beginTotpEnrollment(auth)
      if (result.kind === 'verified') setState({ ...result.state, loading: false })
      else setEnrollment(result)
    } catch (error) { setMessage(friendlyError(error)) }
    finally { setBusy(false) }
  }

  const verify = async (event) => {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const factorId = enrollment?.factorId ?? state.verified[0]?.id
      const aal = await verifyTotpCode(auth, { factorId, code })
      setEnrollment(null); setCode(''); setState((current) => ({ ...current, currentLevel: aal.currentLevel, nextLevel: aal.nextLevel, verified: current.verified.length ? current.verified : [{ id: factorId, status: 'verified' }] }))
      setMessage('TOTP verificato. La sessione ha raggiunto AAL2.')
    } catch (error) { setMessage(friendlyError(error)) }
    finally { setBusy(false) }
  }

  if (state.loading) return <main className="state">Verifica sicurezza account…</main>
  return <section className="page"><header><p className="kicker">DTO Solution — Super Admin</p><h1>Sicurezza account</h1></header><section className="panel mfa-panel"><h2>Autenticazione a due fattori</h2><p>Proteggi l’accesso Super Admin con un codice TOTP generato dalla tua app Authenticator.</p>{state.error && <p className="notice error">Impossibile leggere lo stato MFA.</p>}{!state.error && !state.verified.length && !enrollment && <><p className="mfa-status">TOTP non configurato</p><button onClick={start} disabled={busy}>{busy ? 'Preparazione…' : 'Configura TOTP'}</button></>}{enrollment && <div className="mfa-enrollment"><p>Scansiona il QR code con la tua app Authenticator.</p><img src={qrSource(enrollment.qrCode)} alt="QR code per configurare TOTP"/><details><summary>Inserimento manuale</summary><p>Secret temporaneo:</p><code>{enrollment.secret}</code></details><TotpForm code={code} setCode={setCode} verify={verify} busy={busy}/></div>}{state.verified.length > 0 && <><p className="notice ok">TOTP già configurato.</p><p>Livello sessione attuale: <strong>{state.currentLevel?.toUpperCase() ?? 'non disponibile'}</strong></p>{state.currentLevel !== 'aal2' && <><p>Inserisci un codice per verificare questa sessione.</p><TotpForm code={code} setCode={setCode} verify={verify} busy={busy}/></>}</>}{message && <p className={message.includes('raggiunto AAL2') ? 'notice ok' : 'notice error'} role="status">{message}</p>}</section></section>
}

function TotpForm({ code, setCode, verify, busy }) {
  return <form className="mfa-form" onSubmit={verify}><label>Codice a 6 cifre<input aria-label="Codice TOTP" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}/></label><button disabled={busy || code.length !== 6}>{busy ? 'Verifica…' : 'Verifica codice'}</button></form>
}
