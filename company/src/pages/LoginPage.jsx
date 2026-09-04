import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { COMPANY_ROUTES } from '../routes.js'

export default function LoginPage() {
  const { configured, session, access, signIn, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const navigate = useNavigate(); const location = useLocation()
  if (session) return <Navigate to={access?.role === 'UNION_GUEST' ? '/enti/verifica' : COMPANY_ROUTES.dashboard} replace />
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); const { error: loginError } = await signIn(email, password); setBusy(false); if (loginError) setError('Credenziali non valide o accesso non autorizzato.'); else navigate(location.state?.from?.pathname || COMPANY_ROUTES.dashboard, { replace: true }) }
  return <main className="login-page"><section className="login-card"><img src="/brand/dto-solution-horizontal.svg" alt="DTO Solution" /><p className="company-kicker">Area Aziende</p><h1>Accedi a CheckVan Pro</h1><p>Strumenti operativi riservati ad aziende e organizzazioni invitate.</p>
    {!configured && <p className="notice notice--error">Configura le variabili Supabase dell’Area Aziende.</p>}
    <form onSubmit={submit}><label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button disabled={!configured || busy}>{busy ? 'Accesso…' : 'Accedi'}</button></form>
    <div className="login-divider"><span>oppure</span></div><button className="button-secondary" disabled={!configured} onClick={signInWithGoogle}>Continua con Google</button>{error && <p className="notice notice--error" role="alert">{error}</p>}
  </section></main>
}
