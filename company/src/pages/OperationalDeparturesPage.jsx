import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { canManageVehicles } from '../access.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { loadOperationalDepartureQueue, startOperationalDepartureQueue } from '../lib/companySupabase.js'
import { boardRows, connectionPresentation, departurePresentation, formatOperationalTimestamp } from '../lib/operationalDepartureBoard.js'
import { departureDriverLabel } from '../lib/operationalDeparturePreview.js'
import { COMPANY_ROUTES } from '../routes.js'

const operationalDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

function Badge({ value }) {
  return <span style={{ display: 'inline-block', padding: '0.25rem 0.55rem', borderRadius: '999px', color: value.color, background: value.background, fontWeight: 700 }}>{value.label}</span>
}

function DepartureTable({ rows }) {
  return <div className="company-card" style={{ overflowX: 'auto' }}><table><thead><tr><th>Ordine</th><th>Driver</th><th>Mezzo</th><th>Targa</th><th>Rotta</th><th>Wave</th><th>Partenza</th><th>Connessione</th><th>Ultimo contatto</th><th>Partenza effettiva</th></tr></thead><tbody>{rows.map(({ row, item, departure_state, connection }) => {
    const departure = departurePresentation(departure_state)
    return <tr key={row.id} style={departure_state === 'called' ? { outline: '2px solid #12b76a', outlineOffset: '-2px' } : undefined}><td>{row.departure_order}</td><td><strong>{departureDriverLabel(row)}</strong>{departure_state === 'called' && <div>Attualmente chiamato</div>}</td><td>{row.vehicle_internal_code_snapshot ?? '—'}</td><td>{row.vehicle_plate_snapshot ?? '—'}</td><td>{row.route_snapshot ?? '—'}</td><td>{row.departure_wave ?? '—'}</td><td><Badge value={departure} /></td><td><Badge value={connectionPresentation(connection)} /></td><td>{formatOperationalTimestamp(connection?.last_contact_at)}</td><td>{formatOperationalTimestamp(item?.departed_at)}</td></tr>
  })}</tbody></table></div>
}

export default function OperationalDeparturesPage() {
  const { access, session } = useAuth()
  const [date, setDate] = useState(operationalDate)
  const [timeout, setTimeoutSeconds] = useState(30)
  const [board, setBoard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!session?.access_token) return
    try {
      setBoard(await loadOperationalDepartureQueue(session.access_token, date))
      setError('')
    } catch (reason) {
      setError(reason.message === 'COMPANY_ADMIN_REQUIRED' ? 'Non sei autorizzato a consultare le partenze.' : 'Impossibile aggiornare la coda partenze.')
    } finally { setLoading(false) }
  }, [date, session])

  useEffect(() => {
    const timer = window.setTimeout(() => { setLoading(true); void refresh() }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 3000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const rows = useMemo(() => boardRows(board), [board])
  const queue = board?.queue ?? null
  const departed = useMemo(() => rows.filter(({ departure_state }) => departure_state === 'departed').length, [rows])
  const called = useMemo(() => rows.find(({ departure_state }) => departure_state === 'called') ?? null, [rows])
  const confirmedDay = board?.day?.status === 'confirmed'

  const start = async () => {
    if (starting || !window.confirm('Avviare l’unica coda globale delle partenze per questa giornata?')) return
    setStarting(true); setError('')
    try {
      await startOperationalDepartureQueue(session.access_token, { operating_date: date, timeout_seconds: timeout })
      await refresh()
    } catch (reason) { setError(reason.message === 'OPEN_ANOMALIES' ? 'Prima risolvi le anomalie ancora aperte della giornata.' : 'Impossibile avviare la coda partenze.') } finally { setStarting(false) }
  }

  if (!canManageVehicles(access)) return <Navigate to={COMPANY_ROUTES.dashboard} replace />
  return <section className="company-page"><header className="company-page-header"><div><p className="eyebrow">GIORNATA OPERATIVA</p><h1>Partenze</h1><p>Elenco, stato della partenza e collegamento del driver sono verificati separatamente.</p></div></header>
    <div className="company-card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'end', marginBottom: '1rem' }}><label>Data operativa<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Timeout (secondi)<input type="number" min="1" max="600" value={timeout} onChange={(event) => setTimeoutSeconds(Number(event.target.value) || 30)} disabled={Boolean(queue)} /></label><button type="button" onClick={() => void start()} disabled={starting || Boolean(queue) || !confirmedDay}>{starting ? 'Avvio…' : 'Avvia partenze'}</button><span aria-live="polite">Aggiornamento automatico ogni 3 secondi.</span></div>
    {error && <p role="alert" className="company-error">{error}</p>}
    {loading ? <p>Caricamento partenze…</p> : !confirmedDay ? <div className="company-card"><h2>Nessuna giornata confermata</h2><p>Conferma prima la giornata operativa per visualizzare e avviare la sequenza.</p></div> : <>{!queue && <div className="company-card" style={{ marginBottom: '1rem', border: '1px solid #d0d5dd', background: '#f8fafc' }}><h2>Partenze non avviate</h2><p>La giornata è confermata: tutti i driver TURNO sono già elencati. Connessione e ultimo contatto non modificano la sequenza.</p></div>}{queue && <div className="company-card" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1rem' }}><div><strong>{departed} / {rows.length}</strong><p>driver partiti</p></div><div><strong>{called ? `${departureDriverLabel(called.row)} · #${called.row.departure_order}` : queue.status === 'completed' ? 'Coda completata' : 'Nessun driver chiamato'}</strong><p>driver attualmente chiamato</p></div></div>}{rows.length ? <DepartureTable rows={rows} /> : <div className="company-card"><h2>Nessuna riga TURNO ordinata</h2><p>La giornata è confermata ma non contiene righe TURNO con ordine di partenza valido.</p></div>}</>}</section>
}
