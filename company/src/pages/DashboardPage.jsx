import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, CalendarDays, CircleCheck, CircleSlash, Clock3, FileText, LayoutGrid, MapPin, ShieldCheck, Smartphone, TriangleAlert, Truck, Wrench } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { canManageDevices, canManageVehicles, canUseTools, canViewInspections } from '../access.js'
import { COMPANY_ROUTES } from '../routes.js'
import { loadCompanyInspections, loadCompanyVehicles, loadOpenVehicleDamages, loadVehicleReports } from '../lib/companySupabase.js'
import { VEHICLE_REPORT_LABELS } from '../lib/vehicleReports.js'
import { dashboardSummary } from '../lib/dashboardSummary.js'
import './dashboard.css'

const labels = { active_trial: 'Trial attiva', active_license: 'Licenza attiva', tester: 'Accesso Tester', founder: 'Accesso Founder', union_guest: 'Invito attivo', organization_suspended: 'Organizzazione sospesa', organization_closed: 'Organizzazione chiusa', license_suspended: 'Licenza sospesa', revoked: 'Licenza revocata', expired: 'Licenza scaduta', not_started: 'Licenza non ancora attiva', no_license: 'Nessuna licenza', no_organization: 'Organizzazione non disponibile' }
const dateLabel = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Data non disponibile'
function Panel({ title, icon: Icon, children, className = '', id }) { return <section id={id} className={`fleet-panel ${className}`}><h2><Icon size={23} aria-hidden="true" />{title}</h2>{children}</section> }
function Empty({ children }) { return <p className="fleet-empty">{children}</p> }

export default function DashboardPage() {
  const context = useAuth()
  return <Dashboard key={`${context.access?.organization?.id}:${context.session?.access_token}`} {...context} />
}

function Dashboard({ access, session, error }) {
  const vehiclesAllowed = canManageVehicles(access), inspectionsAllowed = canViewInspections(access), tools = canUseTools(access)
  const [data, setData] = useState({ vehicles: null, reports: null, damages: null, inspections: null })
  const [failed, setFailed] = useState([])
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer) }, [])
  useEffect(() => {
    let current = true
    if (!session?.access_token) return undefined
    const requests = [
      ...(vehiclesAllowed ? [['vehicles', loadCompanyVehicles], ['reports', loadVehicleReports], ['damages', loadOpenVehicleDamages]] : []),
      ...(inspectionsAllowed ? [['inspections', token => loadCompanyInspections(token, { limit: 5 })]] : []),
    ]
    for (const [key, load] of requests) {
      load(session.access_token).then(result => {
        if (!Array.isArray(result.items)) throw new Error('INVALID_RESPONSE')
        if (current) setData(value => ({ ...value, [key]: result.items }))
      }).catch(() => { if (current) setFailed(value => [...value, key]) })
    }
    return () => { current = false }
  }, [session?.access_token, vehiclesAllowed, inspectionsAllowed])

  const summary = dashboardSummary(data.vehicles, data.reports, data.inspections, data.damages)
  const company = access?.organization?.name || 'Nome azienda non disponibile'
  const unavailable = (key, allowed) => !allowed ? 'Non disponibile con questo accesso.' : failed.includes(key) ? 'Dati non disponibili. Riprova ricaricando la pagina.' : 'Caricamento...'
  const kpis = [
    [Truck, 'blue', summary.fleet?.length, 'Mezzi in flotta', 'Veicoli restituiti dal catalogo, esclusi gli archiviati'],
    [CircleCheck, 'green', summary.active, 'Attivi in anagrafica', 'Stato attivo; non certifica la disponibilita alla partenza'],
    [TriangleAlert, 'orange', summary.attention, 'Con segnalazioni aperte', 'Mezzi in flotta con danni o segnalazioni tecniche ancora aperti'],
    [CircleSlash, 'red', summary.inactive, 'Disattivati', 'Stato disattivato in anagrafica'],
  ]
  const shortcuts = [[Truck, 'Veicoli', COMPANY_ROUTES.vehicles, vehiclesAllowed], [FileText, 'Ispezioni', COMPANY_ROUTES.inspections, inspectionsAllowed], [ShieldCheck, 'Verifica PDF', COMPANY_ROUTES.verifyPdf, tools], [LayoutGrid, 'Confronta ispezioni', COMPANY_ROUTES.comparePdf, tools]]
  const openTotal = (summary.open?.length ?? 0) + (summary.openDamages?.length ?? 0)

  return <div className="company-page fleet-dashboard">
    <header className="fleet-heading"><div><h1>Buongiorno!</h1><p>Ecco la panoramica della tua flotta per oggi.</p></div><div className="fleet-identity"><time dateTime={now.toISOString()}><CalendarDays size={20} aria-hidden="true" />{new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)}</time><div><Building2 size={28} aria-hidden="true" /><span><strong>{company}</strong><small>Azienda loggata</small></span></div></div></header>
    {error && <p className="notice notice--error">Impossibile verificare i permessi. Gli strumenti restano bloccati.</p>}
    {failed.length > 0 && <p className="notice notice--error" role="alert">Alcuni dati non sono disponibili. I valori mancanti non sono conteggiati come zero.</p>}
    <section className="fleet-kpis" aria-label="Situazione flotta">{kpis.map(([Icon, color, value, label, note]) => <article className={`fleet-kpi fleet-tone-${color}`} key={label}><span className="fleet-icon"><Icon size={28} aria-hidden="true" /></span><div><strong>{value ?? '-'}</strong><h2>{label}</h2><small>{note}</small></div></article>)}</section>
    <Panel title="Accesso rapido" icon={LayoutGrid} className="fleet-quick-access"><div className="fleet-shortcuts">{shortcuts.map(([Icon, label, to, enabled]) => enabled ? <Link key={to} to={to}><Icon size={26} aria-hidden="true" /><strong>{label}</strong><ArrowRight size={18} /></Link> : <div key={to}><Icon size={26} aria-hidden="true" /><span>{label}<small>Non disponibile</small></span></div>)}</div></Panel>
    <div className="fleet-secondary">
      <Panel title="Ultime ispezioni" icon={FileText}>{data.inspections === null ? <Empty>{unavailable('inspections', inspectionsAllowed)}</Empty> : data.inspections.length ? <ul className="fleet-inspections">{data.inspections.map(item => <li key={item.id}><strong>{item.vehiclePlate}</strong><small>{dateLabel(item.inspectedAt)}</small><span>{item.inspectionType === 'pickup' ? 'Presa' : item.inspectionType === 'return' ? 'Riconsegna' : 'Ispezione'}</span></li>)}</ul> : <Empty>Nessuna ispezione disponibile.</Empty>}{inspectionsAllowed && <Link className="fleet-link" to={COMPANY_ROUTES.inspections}>Vedi tutte <ArrowRight size={16} /></Link>}</Panel>
      <Panel title="Danni aperti" icon={Wrench}>{summary.openDamages === null ? <Empty>{unavailable('damages', vehiclesAllowed)}</Empty> : summary.openDamages.length ? <div className="fleet-damage-placeholder"><TriangleAlert size={40} aria-hidden="true" /><strong>{summary.openDamages.length} dann{summary.openDamages.length === 1 ? 'o aperto' : 'i aperti'}</strong><p>Apri la segnalazione per vedere marker, posizione e foto disponibili.</p><a className="fleet-link" href="#segnalazioni-aperte">Apri elenco segnalazioni</a></div> : <div className="fleet-success"><CircleCheck size={36} /><strong>Nessun danno aperto</strong></div>}</Panel>
      <Panel title="Mezzi per stato" icon={Truck}>{summary.fleet === null ? <Empty>{unavailable('vehicles', vehiclesAllowed)}</Empty> : summary.fleet.length === 0 ? <Empty>Nessun veicolo in flotta.</Empty> : <><div className="fleet-distribution" aria-label={`${summary.active} attivi, ${summary.inactive} disattivati`}><span style={{ width: `${summary.active / summary.fleet.length * 100}%` }} /><span style={{ width: `${summary.inactive / summary.fleet.length * 100}%` }} /></div><dl className="fleet-state-counts"><div><dt>Attivi in anagrafica</dt><dd>{summary.active}</dd></div><div><dt>Disattivati</dt><dd>{summary.inactive}</dd></div></dl><p className="fleet-caption">Stati anagrafici, non esiti di sicurezza o idoneita alla partenza.</p></>}</Panel>
    </div>
    <div className="fleet-primary fleet-primary--lower">
      <Panel id="segnalazioni-aperte" title="Da risolvere prima delle partenze" icon={TriangleAlert} className="fleet-priorities"><p className="fleet-caption">Danni fotografici e segnalazioni tecniche restano aperti fino a una gestione esplicita.</p>{summary.open === null || summary.openDamages === null ? <Empty>{unavailable('reports', vehiclesAllowed)}</Empty> : openTotal === 0 ? <div className="fleet-success"><CircleCheck size={36} /><strong>Nessun problema da verificare</strong><p>Non risultano danni o segnalazioni tecniche aperti nei dati disponibili.</p></div> : <div className="fleet-report-list">{summary.openDamages.map(damage => { const vehicle = summary.byId.get(damage.vehicle_id); return <article className="fleet-report" key={damage.damage_id}><span className="fleet-icon"><MapPin size={25} aria-hidden="true" /></span><div><strong>{vehicle?.plate || 'Mezzo non presente nel catalogo'}</strong><small>{vehicle?.internal_code || '-'}</small></div><div><span className="fleet-badge">{damage.status === 'PENDING' ? 'Da verificare' : 'Confermato'}</span><strong>{damage.damage_type === 'SCRATCH' ? 'Graffio' : 'Ammaccatura'} · {damage.vehicle_view}</strong><small>{dateLabel(damage.reported_at)}{damage.photo_available ? ' · Foto disponibile' : ''}</small></div>{vehicle && <Link to={`${COMPANY_ROUTES.vehicle(vehicle.vehicle_id)}?damage_id=${encodeURIComponent(damage.damage_id)}`}>Apri danno <ArrowRight size={16} /></Link>}</article> })}{summary.open.map(report => { const vehicle = summary.byId.get(report.vehicle_id); return <article className="fleet-report" key={report.report_id}><span className="fleet-icon"><Truck size={25} aria-hidden="true" /></span><div><strong>{vehicle?.plate || 'Mezzo non presente nel catalogo'}</strong><small>{vehicle?.internal_code || '-'}</small></div><div><span className="fleet-badge">Aperta</span><strong>{VEHICLE_REPORT_LABELS[report.report_type] || report.report_type}</strong>{report.description && <p>{report.description}</p>}<small>{dateLabel(report.reported_at)}{report.driver ? ` · Driver: ${report.driver}` : ''}</small></div>{vehicle && <Link to={COMPANY_ROUTES.vehicle(vehicle.vehicle_id)}>Dettagli <ArrowRight size={16} /></Link>}</article> })}</div>}</Panel>
      <Panel title="Attivita recente" icon={Clock3}><p className="fleet-caption">Ultime ispezioni e segnalazioni registrate.</p>{summary.events.length ? <ol className="fleet-events">{summary.events.map(event => <li key={event.id}><FileText size={20} aria-hidden="true" /><div><strong>{event.plate || 'Veicolo'} · {event.label}</strong><small>{dateLabel(event.date)}</small></div></li>)}</ol> : <Empty>{data.inspections !== null || data.reports !== null ? 'Nessuna attivita nei dati disponibili.' : 'Attivita non ancora disponibile.'}</Empty>}{(failed.includes('reports') || failed.includes('damages') || failed.includes('inspections')) && <p className="fleet-caption">Elenco parziale: una fonte non e disponibile.</p>}</Panel>
    </div>
    <section className="fleet-account" aria-label="Licenza e dispositivi"><div><ShieldCheck size={22} aria-hidden="true" /><span><strong>{labels[access?.state] || 'Accesso non disponibile'}</strong><small>{tools ? 'Strumenti operativi disponibili' : 'Strumenti operativi bloccati'}</small></span></div>{access?.role !== 'UNION_GUEST' && <div><Smartphone size={22} aria-hidden="true" /><span><strong>Dispositivi: {access?.devices?.active ?? '-'} / {access?.devices?.capacity ?? '-'}</strong><small>{access?.devices?.available ?? '-'} slot disponibili</small></span>{canManageDevices(access) && <Link to={COMPANY_ROUTES.devices}>Gestisci dispositivi</Link>}</div>}</section>
  </div>
}
