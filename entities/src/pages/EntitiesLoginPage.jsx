import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../company/src/auth/AuthContext.jsx'
import { ENTITIES_ROUTES } from '../routes.js'

export default function EntitiesLoginPage() {
  const { configured, session, access, loading, signIn, signInWithGoogle, signOut } = useAuth()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const navigate = useNavigate(); const location = useLocation()

  if (loading) return <div className="company-state">Verifica della sessione...</div>
  if (session && access?.role === 'UNION_GUEST') return <Navigate to={location.state?.from?.pathname || ENTITIES_ROUTES.verify} replace />

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    const { error: loginError } = await signIn(email, password)
    setBusy(false)
    if (loginError) setError('Credenziali non valide o accesso non autorizzato.')
    else navigate(location.state?.from?.pathname || ENTITIES_ROUTES.verify, { replace: true })
  }

  return <main className="login-page"><section className="login-card"><img src="/brand/dto-solution-horizontal.svg" alt="DTO Solution" /><p className="company-kicker">Area Enti</p><h1>Accedi agli strumenti CheckVan</h1><p>Strumenti di verifica documentale per sindacati e organizzazioni autorizzate.</p>
    {!configured && <p className="notice notice--error">Configura le variabili Supabase dell'area riservata.</p>}
    {session && access?.role !== 'UNION_GUEST' && <><p className="notice notice--error" role="alert">Questo account non e abilitato all'Area Enti.</p><button className="button-secondary" type="button" onClick={signOut}>Esci e usa un altro account</button></>}
    {!session && <><form onSubmit={submit}><label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button disabled={!configured || busy}>{busy ? 'Accesso...' : 'Accedi'}</button></form>
      <div className="login-divider"><span>oppure</span></div><button className="button-secondary" type="button" disabled={!configured} onClick={() => signInWithGoogle(ENTITIES_ROUTES.verify)}>Continua con Google</button>{error && <p className="notice notice--error" role="alert">{error}</p>}</>}
  </section></main>
}
