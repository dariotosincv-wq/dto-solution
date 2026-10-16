import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Download, Info, Mail, MessageCircle, QrCode, ShieldCheck, Truck, UserRound } from 'lucide-react'
import { shiftDay, weekStart } from '../../company/src/lib/weeklyPlanning.js'
import './operational-area.css'

const labels = { TURNO: 'Turno', RIPOSO: 'Riposo', FERIE: 'Ferie', PERMESSO: 'Permesso', MALATTIA: 'Malattia', ALTRO: 'Altro' }
const date = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const textDate = (value, options) => new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', ...options }).format(new Date(`${value}T12:00:00Z`))

export function OperationalAccessPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    fetch('/api/operational-access?action=exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(response => { if (!response.ok) throw new Error(); if (active) navigate('/area-operativa', { replace: true }) })
      .catch(() => active && setError('Questo QR non è valido o è stato revocato.'))
    return () => { active = false }
  }, [navigate, token])
  return <section className="operational-gate"><div><ShieldCheck size={42}/><h1>Accesso Area Operativa</h1><p>{error || 'Verifica dell’accesso personale in corso…'}</p>{error && <Link className="button" to="/">Torna al sito</Link>}</div></section>
}

export default function OperationalAreaPage() {
  const [start, setStart] = useState(weekStart(date()))
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [qr, setQr] = useState(null)
  const [qrBusy, setQrBusy] = useState(false)
  const [qrNotice, setQrNotice] = useState('')
  useEffect(() => {
    let active = true
    fetch(`/api/operational-access?week_start=${start}`, { credentials: 'same-origin' })
      .then(async response => { if (!response.ok) throw new Error(response.status === 401 ? 'ACCESS_REQUIRED' : 'UNAVAILABLE'); return response.json() })
      .then(value => active && setData(value)).catch(reason => active && setError(reason.message)).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [start])
  const cards = useMemo(() => Array.from({ length: 7 }, (_, index) => { const day = shiftDay(start, index); return { date: day, ...(data?.entries.find(item => item.date === day) ?? { status: 'ALTRO', vehicle: null, route: null, notes: null, source: null }) } }), [data, start])
  const regenerateQr = async () => {
    if (qrBusy || !window.confirm('Rigenerare il tuo QR? Quello precedente e tutte le sessioni aperte verranno revocati.')) return
    setQrBusy(true); setQrNotice('')
    try {
      const response = await fetch('/api/operational-access?action=regenerate', { method: 'POST', credentials: 'same-origin' })
      const value = await response.json().catch(() => ({}))
      if (!response.ok || !value.access_path) throw new Error(value.error || 'REGENERATION_FAILED')
      const QRCode = (await import('qrcode')).default
      const image = await QRCode.toDataURL(`https://www.dtosolution.it${value.access_path}`, { width: 360, margin: 2 })
      setQr({ image })
      setQrNotice('Il nuovo QR è pronto. Quello precedente e le sessioni precedenti non sono più validi.')
    } catch (reason) { setQrNotice(reason.message === 'OPERATIONAL_ACCESS_REQUIRED' ? 'La sessione non è più valida. Apri nuovamente il tuo QR attivo.' : 'Rigenerazione non riuscita. Riprova.') } finally { setQrBusy(false) }
  }
  const shareQr = async channel => {
    if (!qr?.image) return
    try {
      const blob = await fetch(qr.image).then(response => response.blob())
      const file = new File([blob], 'dto-solution-qr-personale.png', { type: 'image/png' })
      if (!navigator.share || !navigator.canShare?.({ files: [file] })) { setQrNotice('La condivisione del QR non è supportata da questo browser.'); return }
      await navigator.share({ title: 'QR personale DTO Solution', text: channel === 'email' ? 'Scegli l’app email e il destinatario per inviare il tuo QR personale DTO Solution.' : 'Scegli l’app con cui condividere il QR personale DTO Solution, incluso WhatsApp se disponibile.', files: [file] })
      setQrNotice('Il QR è stato passato alla condivisione del dispositivo.')
    } catch (reason) { setQrNotice(reason?.name === 'AbortError' ? 'Condivisione annullata.' : 'Condivisione non disponibile. Riprova dal tuo dispositivo.') }
  }
  if (error === 'ACCESS_REQUIRED') return <section className="operational-gate"><div><ShieldCheck size={42}/><h1>Accesso riservato</h1><p>Apri il tuo QR personale per accedere all’Area Operativa.</p></div></section>
  return <article className="operational-area"><section className="operational-hero"><div className="container"><p className="eyebrow">DTO SOLUTION · ACCESSO RISERVATO</p><h1>Area <span>Operativa</span></h1><h2>Le tue assegnazioni, sempre con te.</h2><p>Consulta la tua settimana, il mezzo assegnato e la rotta. Le informazioni vengono aggiornate dalla tua azienda.</p><ul><li><CalendarDays/>Settimana aggiornata</li><li><Truck/>Mezzo e rotta</li><li><ShieldCheck/>Accesso con QR personale</li></ul></div></section><section className="container operational-content">
    {loading ? <p className="operational-loading">Caricamento delle tue assegnazioni…</p> : <><header className="operational-driver"><span><UserRound size={45}/></span><div><h2>Ciao, {data.driver.first_name}</h2><p>Driver{data.organization ? ` · ${data.organization}` : ''}</p><small>Qui trovi le tue assegnazioni per la settimana corrente.</small></div><strong><i/>Accesso attivo<small>Tramite QR personale</small></strong></header><section className="operational-qr" aria-labelledby="operational-qr-title"><div><QrCode/><h2 id="operational-qr-title">Il mio QR personale</h2><p>Rigeneralo se lo hai perso o ritieni che possa essere stato condiviso.</p></div><button type="button" onClick={() => void regenerateQr()} disabled={qrBusy}>{qrBusy ? 'Rigenerazione…' : 'Rigenera il mio QR'}</button>{qr && <div className="operational-qr-result"><img src={qr.image} alt="Nuovo QR personale DTO Solution" width="280" height="280"/><p>Salvalo sul tuo telefono personale oppure usa la condivisione nativa. Il QR non viene memorizzato dall’app.</p><div><a href={qr.image} download="dto-solution-qr-personale.png"><Download size={17}/>Salva QR</a><button type="button" onClick={() => void shareQr('email')}><Mail size={17}/>Invia via email</button>{typeof navigator !== 'undefined' && navigator.share && <button type="button" onClick={() => void shareQr('share')}><MessageCircle size={17}/>Condividi</button>}</div></div>}{qrNotice && <p className="operational-qr-notice" role="status">{qrNotice}</p>}</section>
    <section className="operational-plan"><header><button aria-label="Settimana precedente" onClick={() => { setLoading(true); setError(''); setStart(shiftDay(start, -7)) }}><ChevronLeft/></button><h2><CalendarDays/>{textDate(start, { day: 'numeric', month: 'long' })} – {textDate(shiftDay(start, 6), { day: 'numeric', month: 'long', year: 'numeric' })}</h2><button aria-label="Settimana successiva" onClick={() => { setLoading(true); setError(''); setStart(shiftDay(start, 7)) }}><ChevronRight/></button></header><div className="operational-days">{cards.map(item => <article key={item.date} className="operational-day" data-status={item.status}><h3>{textDate(item.date, { weekday: 'long' })}</h3><time>{textDate(item.date, { day: '2-digit', month: '2-digit' })}</time><span className="operational-status">{labels[item.status]}</span><dl><div><dt>Mezzo</dt><dd>{item.vehicle?.internal_code ?? '—'}</dd></div><div><dt>Targa</dt><dd>{item.vehicle?.plate ?? '—'}</dd></div><div><dt>Rotta</dt><dd>{item.route || 'Non ancora assegnata'}</dd></div><div className="operational-note"><dt>Note {item.source && item.source !== 'planned' ? <em>Modificato</em> : null}</dt><dd>{item.notes || '—'}</dd></div></dl></article>)}</div><p className="operational-alert"><Info/>Le informazioni mostrate sono fornite dalla tua azienda e possono essere soggette a variazioni dell’ultimo momento.</p></section><section className="operational-info"><article><ClipboardList/><div><h3>Informazioni sempre aggiornate</h3><p>Qui trovi le assegnazioni comunicate dalla tua azienda.</p></div></article><article><CalendarDays/><div><h3>Consulta da qualsiasi dispositivo</h3><p>Accedi con il tuo QR e visualizza le tue assegnazioni.</p></div></article><article><ShieldCheck/><div><h3>I tuoi dati sono protetti</h3><p>Accesso personale e sicuro: vedi solo le tue informazioni.</p></div></article></section></>}</section></article>
}
