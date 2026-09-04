import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { provisionCompanyTrial } from '../lib/companySupabase.js'
import { COMPANY_ROUTES } from '../routes.js'

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'long' }).format(new Date(value)) : '—'
}

export default function CheckVanPage() {
  const { session, access, loading, error: accessError, refreshAccess } = useAuth()
  const [organizationName, setOrganizationName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)

  const submit = async (event) => {
    event.preventDefault(); setSubmitting(true); setError('')
    try {
      const result = await provisionCompanyTrial(session.access_token, organizationName)
      setCreated(result)
      await refreshAccess()
    } catch (reason) {
      setError(reason.message === 'TRIAL_NOT_ELIGIBLE' || reason.message === 'TRIAL_NOT_AVAILABLE'
        ? 'Il trial non è disponibile per questo account.'
        : 'Non è stato possibile attivare il trial CheckVan.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="company-state">Caricamento dello stato CheckVan…</div>

  const state = access?.state
  const trialAvailable = state === 'no_membership' && access?.trialEligibility?.eligible
  const isTrial = state === 'active_trial'
  const isExpired = state === 'expired'
  const hasExistingLicense = ['active_license', 'tester', 'founder'].includes(state)

  return <div className="company-page"><header><p className="company-kicker">CheckVan Pro</p><h1>Gestione CheckVan</h1><p>Attiva e consulta l’accesso CheckVan della tua azienda.</p></header>
    {(accessError || error) && <p className="notice notice--error" role="alert">{error || 'Non è stato possibile caricare lo stato CheckVan.'}</p>}

    {created?.enrollmentToken && <section className="checkvan-token" aria-live="polite"><h2>Trial attivato</h2><p>Conserva ora il codice di enrollment: per sicurezza non sarà mostrato nuovamente dopo il refresh.</p><code>{created.enrollmentToken}</code><p>Puoi anche creare successivamente un nuovo codice dalla sezione Dispositivi.</p><Link to={COMPANY_ROUTES.devices}>Vai ai dispositivi</Link></section>}

    {trialAvailable && !created && <section className="checkvan-trial-card"><p className="company-kicker">Trial disponibile</p><h2>Nessuna organizzazione CheckVan associata</h2><p>Attiva un trial di 30 giorni per 10 dispositivi. Il tuo account diventerà amministratore esclusivamente della nuova organizzazione.</p><form onSubmit={submit}><label>Nome azienda<input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} minLength="2" maxLength="200" required autoComplete="organization" /></label><button disabled={submitting}>{submitting ? 'Attivazione…' : 'Attiva trial CheckVan'}</button></form></section>}

    {state === 'no_membership' && !trialAvailable && <section className="checkvan-trial-card"><h2>Nessuna organizzazione o membership</h2><p>Questo account non è attualmente idoneo all’attivazione self-service. Verifica l’email dell’account o contatta DTO Solution.</p></section>}
    {state === 'membership_unavailable' && <section className="checkvan-trial-card"><h2>Accesso non disponibile</h2><p>La membership esistente non consente l’accesso o una nuova attivazione. Contatta DTO Solution.</p></section>}
    {isTrial && <section className="checkvan-trial-card"><p className="company-kicker">Trial attivo</p><h2>{access.organization?.name}</h2><dl><div><dt>Scadenza</dt><dd>{formatDate(access.license?.endsAt)}</dd></div><div><dt>Dispositivi</dt><dd>{access.devices?.active ?? 0} / {access.devices?.capacity ?? 0}</dd></div></dl><div className="checkvan-actions"><Link to={COMPANY_ROUTES.devices}>Gestisci dispositivi</Link><Link to={COMPANY_ROUTES.inspections}>Apri ispezioni</Link></div></section>}
    {isExpired && <section className="checkvan-trial-card"><p className="company-kicker">Trial scaduto</p><h2>{access.organization?.name}</h2><p>Il trial è terminato il {formatDate(access.license?.endsAt)}. I comandi operativi restano bloccati finché non viene attivata una licenza.</p></section>}
    {hasExistingLicense && <section className="checkvan-trial-card"><p className="company-kicker">Licenza esistente</p><h2>{access.organization?.name}</h2><p>{state === 'active_license' ? 'Licenza commerciale attiva.' : `Accesso ${state} attivo.`}</p><div className="checkvan-actions"><Link to={COMPANY_ROUTES.devices}>Gestisci dispositivi</Link><Link to={COMPANY_ROUTES.inspections}>Apri ispezioni</Link></div></section>}
    {!access && !accessError && <section className="checkvan-trial-card"><h2>Stato non disponibile</h2><p>Ricarica la pagina o accedi nuovamente.</p></section>}
  </div>
}
