import { useCallback, useEffect, useState } from 'react'

const labels = {
  waiting: { title: 'In attesa', text: 'Attendi la chiamata del responsabile.', color: '#b42318', background: '#fef3f2' },
  called: { title: 'È IL TUO TURNO', text: 'Puoi confermare ora la tua partenza.', color: '#067647', background: '#ecfdf3' },
  timed_out: { title: 'Partenza in ritardo', text: 'Puoi ancora confermare la tua partenza.', color: '#b54708', background: '#fffaeb' },
  departed: { title: 'Partenza confermata', text: 'La tua partenza è stata registrata.', color: '#175cd3', background: '#eff8ff' },
}

export default function OperationalDeparturePanel() {
  const [departure, setDeparture] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/operational-access?action=departure-status', { credentials: 'same-origin' })
      if (response.status === 401) { setDeparture(null); return }
      if (!response.ok) throw new Error()
      setDeparture(await response.json())
      setError('')
    } catch { setError('Lo stato della partenza non è al momento disponibile.') }
  }, [])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => void refresh(), 3000)
    return () => { window.clearTimeout(initialTimer); window.clearInterval(timer) }
  }, [refresh])

  const confirmDeparture = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/operational-access?action=departure-confirm', { method: 'POST', credentials: 'same-origin' })
      if (!response.ok) throw new Error()
      await refresh()
    } catch { setError('La partenza non può essere confermata in questo momento. Riprova.') } finally { setBusy(false) }
  }

  if (!departure?.item || !departure?.row) return null
  const { item, row } = departure
  const state = labels[item.status] ?? labels.waiting
  const actionable = item.status === 'called' || item.status === 'timed_out'
  return <section aria-labelledby="departure-title" style={{ margin: '1.5rem 0', padding: '1.25rem', borderRadius: '1rem', background: state.background, border: `1px solid ${state.color}` }}>
    <p style={{ margin: 0, fontWeight: 800, color: state.color }}>PARTENZE</p>
    <h2 id="departure-title" style={{ margin: '0.3rem 0', color: state.color }}>{state.title}</h2>
    <p style={{ marginTop: 0 }}>{state.text} Aggiornamento automatico attivo.</p>
    <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', margin: '1rem 0' }}><div><dt>Ordine</dt><dd><strong>#{item.departure_order}</strong></dd></div><div><dt>Mezzo</dt><dd>{row.vehicle_internal_code ?? '—'}</dd></div><div><dt>Targa</dt><dd>{row.vehicle_plate ?? '—'}</dd></div><div><dt>Rotta</dt><dd>{row.route ?? '—'}</dd></div></dl>
    {actionable && <button type="button" onClick={() => void confirmDeparture()} disabled={busy} style={{ background: state.color, color: '#fff', fontWeight: 800 }}>{busy ? 'Conferma…' : 'Parto ora'}</button>}
    {error && <p role="alert">{error}</p>}
  </section>
}
