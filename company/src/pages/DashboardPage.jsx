import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Truck, CircleCheck, TriangleAlert, CircleSlash, CalendarDays, Building2, Clock3, FileText, Wrench, LayoutGrid, ArrowRight, Smartphone, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { canManageDevices, canManageVehicles, canUseTools, canViewInspections } from '../access.js'
import { COMPANY_ROUTES } from '../routes.js'
import { loadCompanyVehicles, loadCompanyInspections, loadVehicleReports } from '../lib/companySupabase.js'
import { VEHICLE_REPORT_LABELS } from '../lib/vehicleReports.js'
import { dashboardSummary } from '../lib/dashboardSummary.js'
import './dashboard.css'

const labels = { active_trial: 'Trial attiva', active_license: 'Licenza attiva', tester: 'Accesso Tester', founder: 'Accesso Founder', union_guest: 'Invito attivo', organization_suspended: 'Organizzazione sospesa', organization_closed: 'Organizzazione chiusa', license_suspended: 'Licenza sospesa', revoked: 'Licenza revocata', expired: 'Licenza scaduta', not_started: 'Licenza non ancora attiva', no_license: 'Nessuna licenza', no_organization: 'Organizzazione non disponibile' }
const dateLabel = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Data non disponibile'
function Panel({ title, icon: Icon, children, className = '' }) { return <section className={`fleet-panel ${className}`}><h2><Icon size={23} aria-hidden="true" />{title}</h2>{children}</section> }
function Empty({ children }) { return <p className="fleet-empty">{children}</p> }

export default function DashboardPage() {
  const context = useAuth()
  return <Dashboard key={`${context.access?.organization?.id}:${context.session?.access_token}`} {...context} />
}
function Dashboard({ access, session, error }) {
  const vehiclesAllowed = canManageVehicles(access), inspectionsAllowed = canViewInspections(access), tools = canUseTools(access)
  const [data, setData] = useState({ vehicles: null, reports: null, inspections: null })
  const [failed, setFailed] = useState([])
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer) }, [])
  useEffect(() => {
    let current = true
    if (!session?.access_token) return undefined
    const requests = [
      ...(vehiclesAllowed ? [['vehicles', loadCompanyVehicles], ['reports', loadVehicleReports]] : []),
      ...(inspectionsAllowed ? [['inspections', token => loadCompanyInspections(token, { limit: 5 })]] : []),
    ]
    for (const [key, load] of requests) {
      load(session.access_token).then(result => { if (!Array.isArray(result.items)) throw new Error('INVALID_RESPONSE'); if (current) setData(value => ({ ...value, [key]: result.items })) }).catch(() => { if (current) setFailed(value => [...value, key]) })
    }
    return () => { current = false }
  }, [session?.access_token, vehiclesAllowed, inspectionsAllowed])
  const summary = dashboardSummary(data.vehicles, data.reports, data.inspections)
  const company = access?.organization?.name || 'Nome azienda non disponibile'
  const unavailable = (key, allowed) => !allowed ? 'Non disponibile con questo accesso.' : failed.includes(key) ? 'Dati non disponibili. Riprova ricaricando la pagina.' : 'Caricamento…'
  const kpis = [
    [Truck, 'blue', summary.fleet?.length, 'Mezzi in flotta', 'Veicoli restituiti dal catalogo, esclusi gli archiviati'],
    [CircleCheck, 'green', summary.active, 'Attivi in anagrafica', 'Stato attivo; non certifica la disponibilità alla partenza'],
    [TriangleAlert, 'orange', summary.attention, 'Con segnalazioni aperte', 'Mezzi in flotta con almeno una segnalazione tecnica aperta'],
    [CircleSlash, 'red', summary.inactive, 'Disattivati', 'Stato disattivato in anagrafica'],
  ]
  return <div className="company-page fleet-dashboard">
    <header className="fleet-heading"><div><h1>Buongiorno!</h1><p>Ecco la panoramica della tua flotta per oggi.</p></div><div className="fleet-identity"><time dateTime={now.toISOString()}><CalendarDays size={20} aria-hidden="true" />{new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)}</time><div><Building2 size={28} aria-hidden="true" /><span><strong>{company}</strong><small>Azienda loggata</small></span></div></div></header>
    {error && <p className="notice notice--error">Impossibile verificare i permessi. Gli strumenti restano bloccati.</p>}
    {failed.length > 0 && <p className="notice notice--error" role="alert">Alcuni dati non sono disponibili. I valori mancanti non sono conteggiati come zero.</p>}
    <section className="fleet-kpis" aria-label="Situazione flotta">{kpis.map(([Icon, color, value, label, note]) => <article className={`fleet-kpi fleet-tone-${color}`} key={label}><span className="fleet-icon"><Icon size={28} aria-hidden="true" /></span><div><strong>{value ?? '—'}</strong><h2>{label}</h2><small>{note}</small></div></article>)}</section>
    <div className="fleet-primary">
      <Panel title="Da risolvere prima delle partenze" icon={TriangleAlert} className="fleet-priorities">
        <p className="fleet-caption">Segnalazioni tecniche aperte. I danni fotografici restano nelle schede veicolo.</p>
        {summary.open === null ? <Empty>{unavailable('reports', vehiclesAllowed)}</Empty> : summary.open.length === 0 ? <div className="fleet-success"><CircleCheck size={36} /><strong>Nessun problema da verificare</strong><p>Non risultano segnalazioni tecniche aperte nei dati disponibili.</p></div> : <div className="fleet-report-list">{summary.open.map(report => { const vehicle = summary.byId.get(report.vehicle_id); return <article className="fleet-report" key={report.report_id}><span className="fleet-icon"><Truck size={25} aria-hidden="true" /></span><div><strong>{vehicle?.plate || 'Mezzo non presente nel catalogo'}</strong><small>{vehicle?.internal_code || '—'}</small></div><div><span className="fleet-badge">Aperta</span><strong>{VEHICLE_REPORT_LABELS[report.report_type] || report.report_type}</strong>{report.description && <p>{report.description}</p>}<small>{dateLabel(report.reported_at)}{report.driver ? ` · Driver: ${report.driver}` : ''}</small></div>{vehicle && <Link to={COMPANY_ROUTES.vehicle(vehicle.vehicle_id)}>Dettagli <ArrowRight size={16} /></Link>}</article> })}</div>}
      </Panel>
      <Panel title="Attività recente" icon={Clock3}><p className="fleet-caption">Ultime ispezioni e segnalazioni registrate.</p>{summary.events.length ? <ol className="fleet-events">{summary.events.map(event => <li key={event.id}><FileText size={20} aria-hidden="true" /><div><strong>{event.plate || 'Veicolo'} · {event.label}</strong><small>{dateLabel(event.date)}</small></div></li>)}</ol> : <Empty>{data.inspections !== null || data.reports !== null ? 'Nessuna attività nei dati disponibili.' : 'Attività non ancora disponibile.'}</Empty>}{(failed.includes('reports') || failed.includes('inspections')) && <p className="fleet-caption">Elenco parziale: una fonte non è disponibile.</p>}</Panel>
    </div>
    <div className="fleet-secondary">
      <Panel title="Ultime ispezioni" icon={FileText}>{data.inspections === null ? <Empty>{unavailable('inspections', inspectionsAllowed)}</Empty> : data.inspections.length ? <ul className="fleet-inspections">{data.inspections.map(item => <li key={item.id}><strong>{item.vehiclePlate}</strong><small>{dateLabel(item.inspectedAt)}</small><span>{item.inspectionType === 'pickup' ? 'Presa' : item.inspectionType === 'return' ? 'Riconsegna' : 'Ispezione'}</span></li>)}</ul> : <Empty>Nessuna ispezione disponibile.</Empty>}{inspectionsAllowed && <Link className="fleet-link" to={COMPANY_ROUTES.inspections}>Vedi tutte <ArrowRight size={16} /></Link>}</Panel>
      <Panel title="Stato danni" icon={Wrench}><div className="fleet-damage-placeholder"><Wrench size={40} aria-hidden="true" /><strong>Ogni danno, nella sua scheda</strong><p>Consulta foto e stati dei danni dal dettaglio del veicolo. Il riepilogo globale non è disponibile.</p></div>{vehiclesAllowed && <Link className="fleet-link" to={COMPANY_ROUTES.vehicles}>Consulta i veicoli <ArrowRight size={16} /></Link>}</Panel>
      <Panel title="Mezzi per stato" icon={Truck}>{summary.fleet === null ? <Empty>{unavailable('vehicles', vehiclesAllowed)}</Empty> : summary.fleet.length === 0 ? <Empty>Nessun veicolo in flotta.</Empty> : <><div className="fleet-distribution" aria-label={`${summary.active} attivi, ${summary.inactive} disattivati`}><span style={{ width: `${summary.active / summary.fleet.length * 100}%` }} /><span style={{ width: `${summary.inactive / summary.fleet.length * 100}%` }} /></div><dl className="fleet-state-counts"><div><dt>Attivi in anagrafica</dt><dd>{summary.active}</dd></div><div><dt>Disattivati</dt><dd>{summary.inactive}</dd></div></dl><p className="fleet-caption">Stati anagrafici, non esiti di sicurezza o idoneità alla partenza.</p></>}</Panel>
    </div>
    <Panel title="Accesso rapido" icon={LayoutGrid}><div className="fleet-shortcuts">{[[Truck, 'Veicoli', COMPANY_ROUTES.vehicles, vehiclesAllowed], [FileText, 'Ispezioni', COMPANY_ROUTES.inspections, inspectionsAllowed], [ShieldCheck, 'Verifica PDF', COMPANY_ROUTES.verifyPdf, tools], [LayoutGrid, 'Confronta ispezioni', COMPANY_ROUTES.comparePdf, tools]].map(([Icon, label, to, enabled]) => enabled ? <Link key={to} to={to}><Icon size={26} aria-hidden="true" /><strong>{label}</strong><ArrowRight size={18} /></Link> : <div key={to}><Icon size={26} aria-hidden="true" /><span>{label}<small>Non disponibile</small></span></div>)}</div></Panel>
    <section className="fleet-account" aria-label="Licenza e dispositivi"><div><ShieldCheck size={22} aria-hidden="true" /><span><strong>{labels[access?.state] || 'Accesso non disponibile'}</strong><small>{tools ? 'Strumenti operativi disponibili' : 'Strumenti operativi bloccati'}</small></span></div>{access?.role !== 'UNION_GUEST' && <div><Smartphone size={22} aria-hidden="true" /><span><strong>Dispositivi: {access?.devices?.active ?? '—'} / {access?.devices?.capacity ?? '—'}</strong><small>{access?.devices?.available ?? '—'} slot disponibili</small></span>{canManageDevices(access) && <Link to={COMPANY_ROUTES.devices}>Gestisci dispositivi</Link>}</div>}</section>
  </div>
}