import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ShieldCheck, Smartphone, Settings2, FileText, ArrowRight } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { provisionCompanyTrial } from '../lib/companySupabase.js'
import { COMPANY_ROUTES } from '../routes.js'
import { canViewInspections, canManageVehicles } from '../access.js'
import CheckVanSummary from '../components/CheckVanSummary.jsx'
import './dashboard.css'
import './checkvan.css'

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'long' }).format(new Date(value)) : '—'
}

function LicenseDetails({ access }) {
  return <dl className="checkvan-license-details"><div><dt><CalendarDays size={19} aria-hidden="true" />Scadenza</dt><dd>{formatDate(access.license?.endsAt)}</dd></div><div><dt><Smartphone size={19} aria-hidden="true" />Dispositivi</dt><dd>{access.devices?.active ?? '—'} / {access.devices?.capacity ?? '—'}</dd></div></dl>
}

function OperationalLinks() {
  return <div className="checkvan-actions"><Link to={COMPANY_ROUTES.devices}><Settings2 size={19} aria-hidden="true" />Gestisci dispositivi</Link><Link to={COMPANY_ROUTES.inspections}><FileText size={19} aria-hidden="true" />Apri ispezioni</Link></div>
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

  return <div className="company-page checkvan-page"><header><p className="company-kicker">CHECKVAN PRO</p><h1>Gestione CheckVan</h1><p>Monitora i dispositivi, gestisci le ispezioni e mantieni sotto controllo la tua flotta.</p></header>
    <aside className="checkvan-banner" aria-label="Controlli CheckVan"><div><strong>Controlli oggi.<br />Meno problemi domani.</strong><span>CheckVan Pro · Gestione della flotta</span></div><div className="checkvan-banner-art" aria-hidden="true"><img src="/company/vehicle-silhouettes/small-right.png" alt="" width="900" height="360" /><span><ShieldCheck size={66} /></span></div></aside>
    <div className="checkvan-license-column">
    {(accessError || error) && <p className="notice notice--error" role="alert">{error || 'Non è stato possibile caricare lo stato CheckVan.'}</p>}

    {created?.enrollmentToken && <section className="checkvan-token" aria-live="polite"><h2>Trial attivato</h2><p>Conserva ora il codice di enrollment: per sicurezza non sarà mostrato nuovamente dopo il refresh.</p><code>{created.enrollmentToken}</code><p>Puoi anche creare successivamente un nuovo codice dalla sezione Dispositivi.</p><Link to={COMPANY_ROUTES.devices}>Vai ai dispositivi</Link></section>}

    {trialAvailable && !created && <section className="checkvan-trial-card"><p className="company-kicker">Trial disponibile</p><h2>Nessuna organizzazione CheckVan associata</h2><p>Attiva un trial di 30 giorni per 10 dispositivi. Il tuo account diventerà amministratore esclusivamente della nuova organizzazione.</p><form onSubmit={submit}><label>Nome azienda<input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} minLength="2" maxLength="200" required autoComplete="organization" /></label><button disabled={submitting}>{submitting ? 'Attivazione…' : 'Attiva trial CheckVan'}</button></form></section>}

    {state === 'no_membership' && !trialAvailable && <section className="checkvan-trial-card"><h2>Nessuna organizzazione o membership</h2><p>Questo account non è attualmente idoneo all’attivazione self-service. Verifica l’email dell’account o contatta DTO Solution.</p></section>}
    {state === 'membership_unavailable' && <section className="checkvan-trial-card"><h2>Accesso non disponibile</h2><p>La membership esistente non consente l’accesso o una nuova attivazione. Contatta DTO Solution.</p></section>}
    {isTrial && <section className="checkvan-trial-card"><p className="company-kicker checkvan-state-badge"><ShieldCheck size={17} aria-hidden="true" />Trial attivo</p><h2>{access.organization?.name}</h2><LicenseDetails access={access} /><OperationalLinks /></section>}
    {isExpired && <section className="checkvan-trial-card"><p className="company-kicker">Trial scaduto</p><h2>{access.organization?.name}</h2><p>Il trial è terminato il {formatDate(access.license?.endsAt)}. I comandi operativi restano bloccati finché non viene attivata una licenza.</p></section>}
    {hasExistingLicense && <section className="checkvan-trial-card"><p className="company-kicker checkvan-state-badge"><ShieldCheck size={17} aria-hidden="true" />Licenza esistente</p><h2>{access.organization?.name}</h2><p>{state === 'active_license' ? 'Licenza commerciale attiva.' : `Accesso ${state} attivo.`}</p><LicenseDetails access={access} /><OperationalLinks /></section>}
    {!access && !accessError && <section className="checkvan-trial-card"><h2>Stato non disponibile</h2><p>Ricarica la pagina o accedi nuovamente.</p></section>}
    {access && !trialAvailable && !isTrial && !isExpired && !hasExistingLicense && !['no_membership', 'membership_unavailable'].includes(state) && <section className="checkvan-trial-card"><h2>{access.organization?.name || 'Stato CheckVan'}</h2><p>Accesso operativo non disponibile. Consulta lo stato dell’account.</p><Link className="fleet-link" to={COMPANY_ROUTES.account}>Vai all’account <ArrowRight size={16} /></Link></section>}
    </div>
    <div className="checkvan-overview"><CheckVanSummary key={`${access?.organization?.id}:${session?.access_token}`} access={access} token={session?.access_token} /><section className="checkvan-info"><span className="fleet-icon"><ShieldCheck size={30} aria-hidden="true" /></span><div><h2>Massima sicurezza per la tua flotta</h2><p>Centralizza dispositivi, ispezioni e segnalazioni dei veicoli. Consulta i controlli registrati prima delle partenze.</p></div>{canViewInspections(access) ? <Link to={COMPANY_ROUTES.inspections}>Consulta ispezioni <ArrowRight size={17} /></Link> : canManageVehicles(access) ? <Link to={COMPANY_ROUTES.vehicles}>Consulta veicoli <ArrowRight size={17} /></Link> : <Link to={COMPANY_ROUTES.account}>Stato account <ArrowRight size={17} /></Link>}</section></div>
  </div>
}
