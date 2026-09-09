import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { canManageVehicles } from '../access.js'
import { copyPreviousAssignments, loadCompanyAssignments, saveCompanyAssignment } from '../lib/companySupabase.js'
import { COMPANY_ROUTES } from '../routes.js'
import { STATUS_LABELS } from '../lib/weeklyPlanning.js'
import { ChevronLeft, ChevronRight, Copy, Users, Truck, Search } from 'lucide-react'
import './assignments.css'
const alphabet = new Intl.Collator('it', { sensitivity: 'base', numeric: true })
const today = () => new Date().toLocaleDateString('en-CA')
export default function AssignmentsPage() {
  const { access, session } = useAuth()
  const [date, setDate] = useState(today), [data, setData] = useState({ drivers: [], vehicles: [], assignments: [] }), [error, setError] = useState(''), [saving, setSaving] = useState(''), [saved, setSaved] = useState(''), [copying, setCopying] = useState(false)
  const [search, setSearch] = useState(''), [filter, setFilter] = useState('all')
  const refresh = useCallback(() => loadCompanyAssignments(session.access_token, date).then(setData).catch(() => setError('Assegnazioni non disponibili.')), [date, session.access_token])
  useEffect(() => { if (canManageVehicles(access)) void refresh() }, [access, refresh])
  if (!canManageVehicles(access)) return <Navigate to={COMPANY_ROUTES.dashboard} replace />
  const assign = async (driver_id, vehicle_id) => { if (!vehicle_id || saving) return; setSaving(driver_id); setSaved(''); setError(''); try { await saveCompanyAssignment(session.access_token, { assignment_date: date, driver_id, vehicle_id }); await refresh(); setSaved(driver_id); window.setTimeout(() => setSaved((value) => value === driver_id ? '' : value), 1600) } catch { setError('Il mezzo o il driver risulta già assegnato per questa data.') } finally { setSaving('') } }
  const copyPrevious = async () => { if (copying) return; setCopying(true); setError(''); try { await copyPreviousAssignments(session.access_token, date); await refresh() } catch { setError('Copia delle assegnazioni non riuscita.') } finally { setCopying(false) } }
  const shiftDate = offset => {
    if (!date) return
    const [year, month, day] = date.split('-').map(Number)
    const next = new Date(year, month - 1, day + offset, 12)
    setDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`)
  }
  const query = search.trim().toLocaleLowerCase('it')
  const displayed = data.drivers.filter(driver => {
    const assigned = data.assignments.some(item => item.driver_id === driver.driver_id)
    return (filter === 'all' || (filter === 'assigned' ? assigned : !assigned)) && (!query || [driver.last_name, driver.first_name, driver.driver_code, `${driver.last_name} ${driver.first_name}`].some(value => (value ?? '').toLocaleLowerCase('it').includes(query)))
  }).sort((a, b) => alphabet.compare(a.last_name, b.last_name) || alphabet.compare(a.first_name, b.first_name))
  return <div className="company-page assignments-page">
    <header><p className="company-kicker">Pianificazione</p><h1>Assegnazioni giornaliere</h1><p>La giornata ? pronta dal piano settimanale. Le modifiche al mezzo sono variazioni effettive: il piano originale resta conservato.</p></header>
    <div className="daily-toolbar"><Link to={`${COMPANY_ROUTES.planning}?date=${date}`}>Apri piano settimanale</Link><label>Data<input aria-label="Data assegnazioni" type="date" value={date} onChange={(e) => setDate(e.target.value)}/></label><div className="daily-date-actions"><button type="button" aria-label="Giorno precedente" disabled={!date} onClick={() => shiftDate(-1)}><ChevronLeft size={18}/></button><button type="button" aria-label="Giorno successivo" disabled={!date} onClick={() => shiftDate(1)}><ChevronRight size={18}/></button><button type="button" onClick={() => setDate(today())}>Oggi</button></div><button type="button" className="daily-copy" disabled={copying} onClick={() => void copyPrevious()}><Copy size={17} aria-hidden="true"/>{copying ? 'Copia in corso…' : 'Copia ultimo giorno disponibile'}</button></div>
    {error && <p className="notice notice--error">{error}</p>}
    <aside className="daily-filters" aria-labelledby="daily-filters-title">
      <h2 id="daily-filters-title">Filtri e ricerca</h2>
      <label className="daily-search">Ricerca driver<span><Search size={17} aria-hidden="true"/><input type="search" placeholder="Cognome, nome o codice" value={search} onChange={event => setSearch(event.target.value)}/></span></label>
      <fieldset><legend>Stato assegnazione</legend>{[['all','Tutti'],['assigned','Assegnati'],['unassigned','Non assegnati']].map(([value,label]) => <label key={value}><input type="radio" name="assignment-filter" value={value} checked={filter === value} onChange={() => setFilter(value)}/>{label}</label>)}</fieldset>
      <div className="daily-summary"><Users aria-hidden="true"/><div><strong>{data.drivers.length}</strong><span> driver totali</span><small>Nel catalogo disponibile</small></div></div>
      <div className="daily-summary"><Truck aria-hidden="true"/><div><strong>{data.vehicles.length}</strong><span> veicoli catalogati</span><small>Mezzi del catalogo operativo</small></div></div>
    </aside>
    <section className="daily-catalog" aria-labelledby="daily-title"><header><h2 id="daily-title">Assegnazioni</h2><span>{displayed.length} di {data.drivers.length} driver</span></header><p className="daily-save-hint">Salvataggio automatico alla scelta del mezzo.</p>
      <table className="daily-table"><caption className="visually-hidden">Assegnazioni della data selezionata</caption><thead><tr><th scope="col">Driver</th><th scope="col">Codice</th><th scope="col">Mezzo assegnato nella data selezionata</th></tr></thead><tbody>
        {displayed.map(driver => { const current = data.assignments.find(item => item.driver_id === driver.driver_id); const operational = data.operational?.find(item => item.driver_id === driver.driver_id); return <tr key={driver.driver_id}><th scope="row">{driver.last_name} {driver.first_name}</th><td data-label="Codice">{driver.driver_code || 'Senza codice'}</td><td className="daily-control">{operational && <small>{STATUS_LABELS[operational.work_status]} ? {operational.source === 'planned' ? 'Dal piano settimanale' : 'Variazione effettiva'}{operational.route ? ` ? R. ${operational.route}` : ''}{operational.notes ? ` ? ${operational.notes}` : ''}</small>}<select aria-label={`Mezzo di ${driver.first_name} ${driver.last_name}`} value={current?.vehicle_id || ''} disabled={saving === driver.driver_id} onChange={(e) => void assign(driver.driver_id, e.target.value)}><option value="">Non assegnato</option>{data.vehicles.map(vehicle => <option key={vehicle.vehicle_id} value={vehicle.vehicle_id} disabled={data.assignments.some(item => item.vehicle_id === vehicle.vehicle_id && item.driver_id !== driver.driver_id)}>{vehicle.internal_code} · {vehicle.plate}</option>)}</select><small className="assignment-feedback" aria-live="polite">{saving === driver.driver_id ? 'Salvataggio…' : saved === driver.driver_id ? 'Salvato' : ''}</small></td></tr> })}
      </tbody></table>
      {!displayed.length && <p className="daily-empty">{data.drivers.length ? 'Nessun driver corrisponde ai filtri.' : 'Nessun driver disponibile per le assegnazioni.'}</p>}
    </section>
  </div>
}
