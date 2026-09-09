import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Search, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { canManageVehicles } from '../access.js'
import { COMPANY_ROUTES } from '../routes.js'
import { loadCompanyPlanning, saveCompanyPlanning } from '../lib/companySupabase.js'
import { WORK_STATUSES, STATUS_LABELS, dailySummary, driverSummary, entryKey, filterDrivers, findConflicts, resolveEffective, shiftDay, validDate, weekDays, weekStart, latestPreviousWeeklyVehicle, weeklyFormVehicle } from '../lib/weeklyPlanning.js'
import './weekly-planning.css'

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const dateLabel = (date, options) => new Intl.DateTimeFormat('it', { timeZone: 'UTC', ...options }).format(new Date(`${date}T12:00:00Z`))
const quickFilters = [['all', 'Tutti'], ['incomplete', 'Da completare'], ['under', 'Sotto profilo'], ['equal', 'In linea'], ['over', 'Sopra profilo'], ['absent', 'Assenti'], ['conflicts', 'Con conflitti']]
const emptyData = { revision: 0, entries: [], requirements: [], overrides: [], daily: [], effective: [], drivers: [], vehicles: [] }

const formFor = (item, defaultVehicle = '') => { const workStatus = item?.work_status ?? 'TURNO'; return { work_status: workStatus, vehicle_id: weeklyFormVehicle(workStatus, item?.vehicle_id ?? '', defaultVehicle), route: item?.route ?? '', notes: item?.notes ?? '' } }

function CellEditor({ selection, vehicles, defaultVehicle, busy, error, onSave, onClose }) {
  const [mode, setMode] = useState('planned')
  const [form, setForm] = useState(() => formFor(selection.planned, defaultVehicle))
  const dialog = useRef(null)
  useEffect(() => { dialog.current.showModal() }, [])
  const switchMode = (next) => {
    setMode(next)
    setForm(formFor(next === 'planned' ? selection.planned : selection.effective, next === 'planned' ? defaultVehicle : ''))
  }
  return <dialog ref={dialog} className="planning-editor" aria-labelledby="planning-editor-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <form onSubmit={event => { event.preventDefault(); void onSave({ ...form, action: mode === 'planned' ? 'SAVE' : 'OVERRIDE' }) }}>
      <header><div><h2 id="planning-editor-title">{selection.driver.last_name} {selection.driver.first_name}</h2><p>{dateLabel(selection.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p></div><button type="button" aria-label="Chiudi editor" disabled={busy} onClick={onClose}><X size={20}/></button></header>
      {error && <p role="alert" className="notice notice--error">{error}</p>}
      <fieldset disabled={busy}>
        <label>Modifica<select aria-label="Modifica" autoFocus value={mode} onChange={event => switchMode(event.target.value)}><option value="planned">Pianificazione</option><option value="effective">Variazione effettiva della giornata</option></select></label>
        <p className="planning-hint">{mode === 'planned' ? 'La giornata operativa usa questo piano finché non inserisci una variazione.' : 'La variazione conserva il piano originale. Puoi ripristinarlo in qualsiasi momento.'}</p>
        <label>Stato<select aria-label="Stato" value={form.work_status} onChange={event => setForm(current => ({ ...current, work_status: event.target.value, vehicle_id: weeklyFormVehicle(event.target.value, current.vehicle_id, defaultVehicle, mode), ...(event.target.value !== 'TURNO' ? { route: '' } : {}) }))}>{WORK_STATUSES.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>
        {form.work_status === 'TURNO' && <><label>Mezzo previsto (facoltativo)<select aria-label="Mezzo previsto (facoltativo)" value={form.vehicle_id ?? ''} onChange={event => setForm({ ...form, vehicle_id: event.target.value })}><option value="">Senza mezzo</option>{vehicles.map(vehicle => <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>{vehicle.internal_code} · {vehicle.plate}{vehicle.status !== 'active' ? ' · Non disponibile' : ''}</option>)}</select></label><label>Rotta (facoltativa)<input aria-label="Rotta (facoltativa)" maxLength={100} value={form.route ?? ''} onChange={event => setForm({ ...form, route: event.target.value })} placeholder="Es. 33"/></label></>}
        <label>Note operative<textarea aria-label="Note operative" rows={3} maxLength={2000} value={form.notes ?? ''} onChange={event => setForm({ ...form, notes: event.target.value })}/></label>
      </fieldset>
      <footer><button type="button" disabled={busy} onClick={() => void onSave({ action: mode === 'planned' ? 'CLEAR' : 'RESET_OVERRIDE' })}>{mode === 'planned' ? 'Svuota cella' : 'Ripristina piano'}</button><button className="planning-primary" disabled={busy}>{busy ? 'Salvataggio…' : 'Salva'}</button></footer>
    </form>
  </dialog>
}

function Requirement({ date, value, disabled, onSave }) {
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  return <input key={date} aria-label={`Driver richiesti ${date}`} type="number" min="0" max="1000" step="1" placeholder="—" value={draft} disabled={disabled}
    onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
    onBlur={event => { const next = draft === '' ? null : Number(draft); if (!event.currentTarget.validity.valid) { setDraft(value == null ? '' : String(value)); return } if (next !== value) void onSave(next) }}/>
}

export default function WeeklyPlanningPage() {
  const { access, session } = useAuth()
  const [searchParams] = useSearchParams()
  const [start, setStart] = useState(() => weekStart(validDate(searchParams.get('date')) ? searchParams.get('date') : today()))
  const [data, setData] = useState(emptyData), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [reload, setReload] = useState(0)
  const [filters, setFilters] = useState({ search: '', profile: '', status: '', quick: 'all' }), [page, setPage] = useState(1)
  const [selection, setSelection] = useState(null)
  const pending = useRef(false)
  const allowed = canManageVehicles(access)
  useEffect(() => {
    if (!allowed) return undefined
    const controller = new AbortController()
    loadCompanyPlanning(session.access_token, start, controller.signal).then(value => { if (!controller.signal.aborted) { setData(value); setLoading(false) } }).catch(reason => { if (!controller.signal.aborted && reason.name !== 'AbortError') { setError('Pianificazione non disponibile. Riprova tra poco.'); setLoading(false) } })
    return () => controller.abort()
  }, [allowed, session?.access_token, start, reload])
  const dates = useMemo(() => weekDays(start), [start])
  const entries = useMemo(() => new Map(data.entries.map(entry => [entryKey(entry.driver_id, entry.assignment_date), entry])), [data.entries])
  const effective = useMemo(() => new Map(data.effective.map(entry => [entryKey(entry.driver_id, entry.assignment_date), entry])), [data.effective])
  const vehicles = useMemo(() => new Map(data.vehicles.map(vehicle => [vehicle.vehicle_id, vehicle])), [data.vehicles])
  const conflicts = useMemo(() => findConflicts(data.entries, data.vehicles), [data.entries, data.vehicles])
  const summaries = useMemo(() => new Map(data.drivers.map(driver => [driver.driver_id, { ...driverSummary(dates.map(date => entries.get(entryKey(driver.driver_id, date))), driver.expected_weekly_days), conflicts: dates.filter(date => conflicts.has(entryKey(driver.driver_id, date))).length }])), [data.drivers, dates, entries, conflicts])
  const filtered = useMemo(() => filterDrivers(data.drivers, summaries, filters, data.entries), [data.drivers, summaries, filters, data.entries])
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10)), currentPage = Math.min(page, pageCount)
  const displayed = filtered.slice((currentPage - 1) * 10, currentPage * 10)
  const changeFilter = (name, value) => { setFilters(current => ({ ...current, [name]: value })); setPage(1) }
  const changeWeek = (next) => { if (pending.current || next === start) return; setStart(next); setLoading(true); setData(emptyData); setSelection(null); setError(''); setMessage(''); setPage(1) }
  const retry = () => { setLoading(true); setError(''); setReload(value => value + 1) }
  const mutate = async (input) => {
    if (pending.current) return false
    pending.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const result = await saveCompanyPlanning(session.access_token, { ...input, week_start: start, revision: data.revision })
      if (input.action === 'COPY_PREVIOUS') {
        setData(await loadCompanyPlanning(session.access_token, start))
        setMessage(`${result.copied} celle e ${result.copied_requirements} fabbisogni copiati. I dati già presenti sono stati conservati.`)
      } else {
        setData(current => {
          const next = { ...current, revision: result.revision }
          const replacement = [result.item, ...(result.propagated ?? [])].filter(Boolean)
          const replace = list => [...list.filter(item => !replacement.some(value => entryKey(value.driver_id, value.assignment_date) === entryKey(item.driver_id, item.assignment_date)) && (!['CLEAR', 'RESET_OVERRIDE'].includes(input.action) || entryKey(item.driver_id, item.assignment_date) !== entryKey(input.driver_id, input.assignment_date))), ...replacement]
          if (['SAVE', 'CLEAR'].includes(input.action)) next.entries = replace(current.entries)
          if (['OVERRIDE', 'RESET_OVERRIDE'].includes(input.action)) next.overrides = replace(current.overrides)
          if (input.action === 'RESET_OVERRIDE') next.daily = current.daily.filter(item => entryKey(item.driver_id, item.assignment_date) !== entryKey(input.driver_id, input.assignment_date))
          if (input.action === 'REQUIREMENT') next.requirements = [...current.requirements.filter(item => item.assignment_date !== input.assignment_date), result.item]
          next.effective = resolveEffective(next.entries, next.overrides, next.daily)
          return next
        })
        setMessage('Salvato')
      }
      return true
    } catch (reason) {
      setError(reason.message === 'PLANNING_STALE' ? 'La settimana è stata modificata da un altro responsabile. Chiudi l’editor e ricarica prima di riprovare.' : 'Salvataggio non riuscito. I dati inseriti nell’editor sono conservati: riprova.')
      return false
    } finally { pending.current = false; setBusy(false) }
  }
  if (!allowed) return <Navigate to={COMPANY_ROUTES.dashboard} replace />
  return <div className="company-page weekly-planning">
    <header className="planning-heading"><div><h1>Pianificazione settimanale</h1><p>Gestisci turni, mezzi e rotte dei tuoi driver</p></div><div className="planning-week-controls"><button aria-label="Settimana precedente" disabled={busy} onClick={() => changeWeek(shiftDay(start, -7))}><ChevronLeft size={18}/></button><label><span className="visually-hidden">Settimana</span><input aria-label="Settimana" type="date" value={start} disabled={busy} onChange={event => { if (event.target.value) changeWeek(weekStart(event.target.value)) }}/></label><button aria-label="Settimana successiva" disabled={busy} onClick={() => changeWeek(shiftDay(start, 7))}><ChevronRight size={18}/></button><button className="planning-primary" title="Copia solo le celle e i fabbisogni vuoti; conserva i dati già presenti" disabled={busy || loading || Boolean(error)} onClick={() => void mutate({ action: 'COPY_PREVIOUS' })}><Copy size={17}/>Copia settimana precedente</button></div></header>
    <div className="planning-week-caption"><CalendarDays size={16}/><strong>{dateLabel(start, { day: 'numeric', month: 'short' })} – {dateLabel(dates[6], { day: 'numeric', month: 'short', year: 'numeric' })}</strong><span>La copia compila solo gli spazi vuoti.</span><button disabled={busy} onClick={retry}>Ricarica</button></div>
    <div className="planning-feedback" aria-live="polite">{error ? <p role="alert" className="notice notice--error">{error}</p> : <span>{loading ? 'Caricamento settimana…' : busy ? 'Salvataggio…' : message}</span>}</div>
    {!loading && <>
      <section className="planning-days" aria-label="Copertura giornaliera">{dates.map(date => {
        const required = data.requirements.find(item => item.assignment_date === date)?.required_drivers ?? null
        const summary = dailySummary(data.entries.filter(item => item.assignment_date === date), required)
        const dayConflicts = data.entries.filter(item => item.assignment_date === date && conflicts.has(entryKey(item.driver_id, date))).length
        return <article key={date} data-attention={Boolean(dayConflicts || summary.missing)}><header><div><h2>{dateLabel(date, { weekday: 'long' })}</h2><time dateTime={date}>{dateLabel(date, { day: '2-digit', month: '2-digit' })}</time></div>{dayConflicts ? <AlertTriangle aria-label="Conflitti" size={20}/> : summary.missing ? <AlertTriangle aria-label="Copertura da completare" size={20}/> : <Check aria-label="Nessun conflitto" size={20}/>}</header><dl><div><dt>Richiesti</dt><dd><Requirement key={`${date}:${required}:${busy}`} date={date} value={required} disabled={busy || Boolean(error)} onSave={value => mutate({ action: 'REQUIREMENT', assignment_date: date, required_drivers: value })}/></dd></div><div><dt>Pianificati</dt><dd>{summary.planned}</dd></div><div><dt>Mezzi</dt><dd>{summary.vehicles}</dd></div></dl><small>{dayConflicts ? `${dayConflicts} celle da verificare` : summary.missing ? `Mancano ${summary.missing} driver` : required == null ? 'Fabbisogno facoltativo' : 'Copertura raggiunta'}</small></article>
      })}</section>
      <section className="planning-filters" aria-label="Filtri pianificazione"><label className="planning-search"><Search size={18}/><input aria-label="Cerca driver" type="search" placeholder="Cerca driver (cognome, nome)…" value={filters.search} onChange={event => changeFilter('search', event.target.value)}/></label><select aria-label="Filtra profilo" value={filters.profile} onChange={event => changeFilter('profile', event.target.value)}><option value="">Tutti i profili</option>{[3, 4, 5, 0, 1, 2, 6, 7].map(days => <option key={days} value={days}>{days} giorni</option>)}</select><select aria-label="Filtra stato" value={filters.status} onChange={event => changeFilter('status', event.target.value)}><option value="">Tutti gli stati</option>{WORK_STATUSES.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select><div className="planning-quick">{quickFilters.map(([value, label]) => <button key={value} aria-pressed={filters.quick === value} onClick={() => changeFilter('quick', value)}>{label}{value === 'all' ? ` (${data.drivers.length})` : ''}</button>)}</div></section>
      <div className="planning-grid-wrap"><table className="planning-grid"><caption className="visually-hidden">Pianificazione dal {start} al {dates[6]}</caption><thead><tr><th scope="col">Driver ↑</th><th scope="col">Profilo</th><th scope="col">Pianificate</th><th scope="col">Scost.</th>{dates.map(date => <th scope="col" key={date}>{dateLabel(date, { weekday: 'short' })}<small>{dateLabel(date, { day: '2-digit', month: '2-digit' })}</small></th>)}</tr></thead><tbody>{displayed.map(driver => {
        const summary = summaries.get(driver.driver_id)
        return <tr key={driver.driver_id}><th scope="row">{driver.last_name} {driver.first_name}{driver.status !== 'active' && <small>Archiviato</small>}</th><td data-label="Profilo"><span className="planning-profile" data-days={driver.expected_weekly_days}>{driver.expected_weekly_days == null ? 'Da impostare' : `${driver.expected_weekly_days} giorni`}</span></td><td data-label="Pianificate">{summary.planned}/{summary.expected ?? '—'}</td><td data-label="Scostamento"><span className="planning-delta" data-direction={summary.delta === 0 ? 'equal' : 'difference'} title="Informazione operativa, non un errore">{summary.delta == null ? '—' : summary.delta > 0 ? `+${summary.delta}` : summary.delta}</span></td>{dates.map(date => {
          const key = entryKey(driver.driver_id, date), item = entries.get(key), actual = effective.get(key), vehicle = vehicles.get(item?.vehicle_id), warnings = conflicts.get(key)
          return <td key={date} data-day={dateLabel(date, { weekday: 'short', day: 'numeric' })}><button className="planning-cell" data-status={item?.work_status ?? 'EMPTY'} disabled={busy || Boolean(error)} title={warnings?.join(' · ') || item?.notes || 'Modifica giornata'} aria-label={`${driver.last_name} ${driver.first_name}, ${date}, ${item ? STATUS_LABELS[item.work_status] : 'Da pianificare'}`} onClick={() => setSelection({ driver, date, planned: item, effective: actual })}><strong>{item ? STATUS_LABELS[item.work_status] : '＋'}</strong>{item?.work_status === 'TURNO' && <><span>{vehicle ? `${vehicle.internal_code} · ${vehicle.plate}` : 'Senza mezzo'}</span><span>{item.route ? `R. ${item.route}` : '—'}</span></>}{warnings && <span className="planning-conflict"><AlertTriangle size={12}/>{warnings.length}</span>}{actual?.source !== 'planned' && actual && <span className="planning-variation" title="È presente una variazione effettiva">Variazione</span>}</button></td>
        })}</tr>
      })}</tbody></table>{!displayed.length && <p className="planning-empty">{data.drivers.length ? 'Nessun driver corrisponde ai filtri.' : <>Nessun driver disponibile. <Link to={COMPANY_ROUTES.drivers}>Aggiungi i driver in anagrafica</Link> per iniziare.</>}</p>}</div>
      <footer className="planning-footer"><span>{filtered.length ? `${(currentPage - 1) * 10 + 1}–${Math.min(currentPage * 10, filtered.length)}` : '0'} di {filtered.length} driver</span><nav aria-label="Pagine driver"><button aria-label="Pagina precedente" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={18}/></button><span>{currentPage} / {pageCount}</span><button aria-label="Pagina successiva" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={18}/></button></nav></footer>
      <div className="planning-legend">{WORK_STATUSES.map(status => <span key={status}><i data-status={status}/>{STATUS_LABELS[status]}</span>)}<span>R. = Rotta</span></div><p className="planning-hint">Pianificate = giornate in turno. Assenze e riposi restano distinti. Lo scostamento dal profilo è informativo e non blocca il lavoro.</p>
    </>}
    {selection && <CellEditor error={error} selection={selection} vehicles={data.vehicles} defaultVehicle={latestPreviousWeeklyVehicle(data.entries, selection.driver.driver_id, selection.date)} busy={busy} onClose={() => setSelection(null)} onSave={async values => { const saved = await mutate({ ...values, driver_id: selection.driver.driver_id, assignment_date: selection.date }); if (saved) setSelection(null) }}/>}
  </div>
}
