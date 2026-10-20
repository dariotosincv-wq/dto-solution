import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { canManageVehicles } from '../access.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { loadOperationalDepartureQueue, startOperationalDepartureQueue } from '../lib/companySupabase.js'
import { COMPANY_ROUTES } from '../routes.js'

const operationalDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const states = {
  waiting: { label: 'In attesa', color: '#b42318', background: '#fef3f2' },
  called: { label: 'Chiamato', color: '#067647', background: '#ecfdf3' },
  timed_out: { label: 'In ritardo', color: '#b54708', background: '#fffaeb' },
  departed: { label: 'Partito', color: '#175cd3', background: '#eff8ff' },
}

function Status({ status }) {
  const value = states[status] ?? states.waiting
  return <span style={{ display: 'inline-block', padding: '0.25rem 0.55rem', borderRadius: '999px', color: value.color, background: value.background, fontWeight: 700 }}>{value.label}</span>
}

export default function OperationalDeparturesPage() {
  const { access, session } = useAuth()
  const [date, setDate] = useState(operationalDate)
  const [timeout, setTimeoutSeconds] = useState(30)
  const [queue, setQueue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!session?.access_token) return
    try {
      const data = await loadOperationalDepartureQueue(session.access_token, date)
      setQueue(data ?? null)
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

  const items = useMemo(() => queue?.items ?? [], [queue])
  const departed = useMemo(() => items.filter(({ item }) => item.status === 'departed').length, [items])
  const called = useMemo(() => items.find(({ item }) => item.status === 'called') ?? null, [items])

  const start = async () => {
    if (starting || !window.confirm('Avviare l’unica coda globale delle partenze per questa giornata?')) return
    setStarting(true); setError('')
    try {
      await startOperationalDepartureQueue(session.access_token, { operating_date: date, timeout_seconds: timeout })
      await refresh()
    } catch (reason) { setError(reason.message === 'OPEN_ANOMALIES' ? 'Prima risolvi le anomalie ancora aperte della giornata.' : 'Impossibile avviare la coda partenze.') } finally { setStarting(false) }
  }

  if (!canManageVehicles(access)) return <Navigate to={COMPANY_ROUTES.dashboard} replace />
  return <section className="company-page"><header className="company-page-header"><div><p className="eyebrow">GIORNATA OPERATIVA</p><h1>Partenze</h1><p>Un’unica sequenza continua ordinata esclusivamente per ordine di partenza.</p></div></header>
    <div className="company-card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'end', marginBottom: '1rem' }}><label>Data operativa<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Timeout (secondi)<input type="number" min="1" max="600" value={timeout} onChange={(event) => setTimeoutSeconds(Number(event.target.value) || 30)} disabled={Boolean(queue?.queue)} /></label><button type="button" onClick={() => void start()} disabled={starting || Boolean(queue?.queue)}>{starting ? 'Avvio…' : 'Avvia partenze'}</button><span aria-live="polite">Aggiornamento automatico ogni 3 secondi.</span></div>
    {error && <p role="alert" className="company-error">{error}</p>}
    {loading ? <p>Caricamento coda partenze…</p> : !queue?.queue ? <div className="company-card"><h2>Coda non avviata</h2><p>Verifica la giornata confermata e avvia la sequenza quando sei pronto.</p></div> : <><div className="company-card" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1rem' }}><div><strong>{departed} / {items.length}</strong><p>driver partiti</p></div><div><strong>{called ? `${called.row.driver_name} · #${called.item.departure_order}` : queue.queue.status === 'completed' ? 'Coda completata' : 'Nessun driver chiamato'}</strong><p>driver attualmente chiamato</p></div></div>
      <div className="company-card" style={{ overflowX: 'auto' }}><table><thead><tr><th>Ordine</th><th>Driver</th><th>Mezzo</th><th>Targa</th><th>Rotta</th><th>Wave</th><th>Stato</th></tr></thead><tbody>{items.map(({ item, row }) => <tr key={item.id} style={item.status === 'called' ? { outline: '2px solid #12b76a', outlineOffset: '-2px' } : undefined}><td>{item.departure_order}</td><td><strong>{row.driver_name}</strong>{item.status === 'called' && <div>Attualmente chiamato</div>}</td><td>{row.vehicle_internal_code ?? '—'}</td><td>{row.vehicle_plate ?? '—'}</td><td>{row.route ?? '—'}</td><td>{row.departure_wave ?? '—'}</td><td><Status status={item.status} /></td></tr>)}</tbody></table></div></>}</section>
}
