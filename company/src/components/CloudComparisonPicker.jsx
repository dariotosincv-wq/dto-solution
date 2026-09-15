import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { createInspectionDownload, loadCompanyInspections } from '../lib/companySupabase.js'
import './cloud-comparison-picker.css'

const vehicle = item => item?.vehiclePlate || item?.vehicleDescription || ''
const typeLabel = item => item.inspectionType === 'pickup' ? 'Presa' : 'Riconsegna'
const dateTime = item => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.inspectedAt))
const searchText = item => `${item.vehiclePlate || ''} ${item.vehicleDescription || ''} ${typeLabel(item)} ${dateTime(item)}`.toLowerCase()

function InspectionDetails({ item }) {
  return <div className="cloud-comparison-details"><span>{dateTime(item)}</span><span><b>Targa</b> {item.vehiclePlate || '—'}</span><span><b>Mezzo</b> {item.vehicleDescription || '—'}</span><span className={`cloud-comparison-type cloud-comparison-type--${item.inspectionType === 'pickup' ? 'pickup' : 'return'}`}>{typeLabel(item)}</span></div>
}

export default function CloudComparisonPicker({ initial = [], onReady }) {
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [first, setFirst] = useState(initial[0] || null)
  const [second, setSecond] = useState(initial[1] || null)
  const [slot, setSlot] = useState(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { void loadCompanyInspections(session.access_token).then(result => setItems(result.items)).catch(() => setItems(current => { if (!current.length) setError('Impossibile caricare le ispezioni aziendali.'); return current })) }, [session.access_token])

  const choose = useMemo(() => items
    .filter(item => (slot !== 'second' || (item.id !== first?.id && vehicle(item) === vehicle(first))) && searchText(item).includes(query.toLowerCase()))
    .sort((a, b) => {
      const aCompatible = slot === 'second' && vehicle(a) === vehicle(first)
      const bCompatible = slot === 'second' && vehicle(b) === vehicle(first)
      if (aCompatible !== bCompatible) return aCompatible ? -1 : 1
      return new Date(a.inspectedAt) - new Date(b.inspectedAt)
    }), [items, slot, first, query])

  const pick = item => { if (slot === 'first') { setFirst(item); setSecond(null) } else setSecond(item); setSlot(null); setQuery('') }
  const download = async () => {
    setBusy(true); setError('')
    try {
      const selected = [first, second].sort((a, b) => new Date(a.inspectedAt) - new Date(b.inspectedAt))
      const files = await Promise.all(selected.map(async (item, index) => {
        const position = index === 0 ? 'prima' : 'seconda'
        try {
          const { url } = await createInspectionDownload(session.access_token, item.id), response = await fetch(url)
          if (!response.ok) throw new Error('UNAVAILABLE')
          const blob = await response.blob(), signature = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer()), contentType = response.headers.get('content-type') || ''
          if (!signature.startsWith('%PDF-')) throw new Error('NOT_PDF')
          return new File([blob], `checkvan-${item.id}.pdf`, { type: contentType.includes('pdf') ? 'application/pdf' : 'application/pdf' })
        } catch (reason) { throw new Error(reason.message === 'NOT_PDF' ? `Il documento della ${position} ispezione non è un PDF valido.` : `Impossibile recuperare il PDF della ${position} ispezione.`, { cause: reason }) }
      }))
      await onReady(files, selected)
    } catch (reason) { setError(reason.message || 'Impossibile recuperare i PDF aziendali.') } finally { setBusy(false) }
  }
  const card = (title, item, which) => <article className={`cloud-comparison-slot${slot === which ? ' is-active' : ''}`}><strong>{title}</strong>{item ? <InspectionDetails item={item} /> : <p>Nessuna ispezione selezionata</p>}<button type="button" className="cloud-comparison-change" onClick={() => setSlot(which)}>{item ? 'Cambia' : 'Seleziona ispezione'}</button></article>

  return <section className="comparison-form cloud-comparison-picker">
    <div className="comparison-summaries">{card('ISPEZIONE PRIMA', first, 'first')}{card('ISPEZIONE DOPO', second, 'second')}</div>
    {slot && <section className="cloud-comparison-list" aria-label={`Selezione ${slot === 'first' ? 'prima' : 'seconda'} ispezione`}><header><div><strong>Seleziona ispezione</strong><small>{slot === 'second' && first ? `Sono evidenziate le ispezioni del mezzo ${vehicle(first)}.` : 'Scegli l’ispezione da usare nel confronto.'}</small></div><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cerca data, targa, mezzo o tipo" aria-label="Cerca ispezioni" /></header>{choose.length ? <div className="cloud-comparison-table" role="list"><div className="cloud-comparison-table__head" aria-hidden="true"><span>Data e ora</span><span>Targa</span><span>Mezzo</span><span>Tipo</span></div>{choose.map(item => { const selected = item.id === first?.id || item.id === second?.id; const compatible = slot === 'second' && vehicle(item) === vehicle(first); return <button type="button" role="listitem" key={item.id} className={`${selected ? 'is-selected' : ''}${compatible ? ' is-compatible' : ''}`} onClick={() => pick(item)}><span data-label="Data e ora">{dateTime(item)}</span><strong data-label="Targa">{item.vehiclePlate || '—'}</strong><span data-label="Mezzo">{item.vehicleDescription || '—'}</span><span data-label="Tipo" className={`cloud-comparison-type cloud-comparison-type--${item.inspectionType === 'pickup' ? 'pickup' : 'return'}`}>{typeLabel(item)}</span></button> })}</div> : <p className="cloud-comparison-empty">Nessuna ispezione corrisponde alla ricerca.</p>}</section>}
    <button type="button" className="button button--primary" disabled={!first || !second || busy} onClick={download}>{busy ? 'Caricamento ispezioni...' : 'Confronta ispezioni'}</button>{error && <p className="checkvan-local-error" role="alert">{error}</p>}
  </section>
}
