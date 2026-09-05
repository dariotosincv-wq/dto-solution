import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import MetaDescription from '../components/common/MetaDescription.jsx'
import { backupFilename, createDriverBackup, parseDriverBackup, restoreDriverBackup, summarizeDriverBackup } from '../features/driver/backup/driverBackup.js'
import { MAX_BACKUP_BYTES } from '../features/driver/backup/backupPolicy.js'

export default function DriverBackupPage() {
  const [preview, setPreview] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const selection = useRef(0)
  const clearMessages = () => { setMessage(''); setError('') }
  const showError = cause => setError(cause?.code ? cause.message : 'Operazione non riuscita: il browser non consente di accedere al file o ai dati locali. Nessun ripristino è stato completato.')

  function exportBackup() {
    clearMessages()
    try {
      const backup = createDriverBackup(window.localStorage)
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = backupFilename(backup)
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('Backup riuscito: download del file JSON avviato. Conserva il file in un luogo sicuro.')
    } catch (cause) { showError(cause) }
  }

  async function selectBackup(event) {
    const token = ++selection.current
    const file = event.target.files?.[0]
    setPreview(null)
    setConfirmed(false)
    clearMessages()
    event.target.value = ''
    if (!file) { setReading(false); return }
    setReading(true)
    try {
      if (file.size > MAX_BACKUP_BYTES) { setError('Backup troppo grande: il limite è 20 MB.'); return }
      const backup = parseDriverBackup(await file.text())
      if (token === selection.current) setPreview(backup)
    } catch (cause) { if (token === selection.current) showError(cause) }
    finally { if (token === selection.current) setReading(false) }
  }

  function restore() {
    if (!preview || !confirmed) return
    clearMessages()
    try {
      restoreDriverBackup(window.localStorage, preview)
      setPreview(null)
      setConfirmed(false)
      setMessage('Ripristino riuscito. Puoi riaprire Turni Driver e Busta Paga Driver per consultare i dati ripristinati.')
    } catch (cause) { setConfirmed(false); showError(cause) }
  }

  return <article className="page-section driver-area"><MetaDescription content="Esporta e ripristina localmente i dati di Turni Driver e Busta Paga Driver, senza account o invio al server." /><div className="container">
    <header className="page-intro"><Link to="/area-driver">Torna all’Area Driver</Link><p className="eyebrow">Dati personali locali</p><h1>Backup e ripristino</h1><p>Metti al sicuro i dati salvati di Turni Driver e Busta Paga Driver con un file JSON sul tuo dispositivo.</p><p>Il file di backup può contenere dati personali e retributivi. Conservalo in un luogo sicuro.</p><p>Il file non è cifrato. Il sito non lo invia a un server.</p></header>
    <div className="driver-area__grid driver-backup__actions">
      <section className="driver-area-card" aria-labelledby="backup-export-title"><h2 id="backup-export-title">Esporta i tuoi dati</h2><p>Include turni e note, profilo contrattuale, storico cedolini normalizzati, simulazioni e confronti salvati, impostazioni Payroll.</p><p>Non include PDF originali, testo grezzo del parser, diagnostica temporanea o dati di altre aree del sito. Salva le elaborazioni aperte prima di esportare.</p><button type="button" className="button button--primary" onClick={exportBackup}>Esporta backup</button></section>
      <section className="driver-area-card" aria-labelledby="backup-import-title"><h2 id="backup-import-title">Ripristina backup</h2><p>Seleziona un backup JSON versione 1 (massimo 20 MB). Prima di confermare vedrai il riepilogo dei dati contenuti.</p><label htmlFor="driver-backup-file">Seleziona il file di backup</label><input id="driver-backup-file" type="file" accept=".json,application/json" onChange={selectBackup} disabled={reading} /><p>Il ripristino sostituisce tutti i dati salvati di queste funzioni, anche con archivi vuoti. Non unisce due backup. Chiudi le altre schede degli strumenti prima di procedere.</p></section>
    </div>
    <div aria-live="polite" role="status">{reading ? 'Verifica del backup in corso…' : message}</div>
    {error && <p role="alert" className="driver-area__notice">{error}</p>}
    {preview && <section className="driver-area-card driver-backup__preview" aria-labelledby="backup-preview-title"><h2 id="backup-preview-title">Anteprima del ripristino</h2><p>Backup creato il {new Date(preview.createdAt).toLocaleString('it-IT')}.</p><dl className="driver-backup__summary">{summarizeDriverBackup(preview).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>Prima di sovrascrivere puoi esportare una copia dei dati attualmente presenti in questo browser. In caso di errore di scrittura, il sito tenterà il recupero dello stato precedente; un arresto del browser non consente di garantirlo.</p><label className="driver-backup__confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Confermo di voler sostituire tutti i dati locali di Turni e Busta Paga con questo backup, inclusi gli archivi vuoti.</label><div className="driver-backup__buttons"><button className="button button--primary" type="button" disabled={!confirmed} onClick={restore}>Conferma ripristino</button><button className="button button--secondary" type="button" onClick={() => { ++selection.current; setPreview(null); setConfirmed(false) }}>Annulla</button></div></section>}
    <nav className="driver-backup__buttons" aria-label="Strumenti Area Driver"><Link to="/area-driver/turni">Turni Driver</Link><Link to="/area-driver/busta-paga">Busta Paga Driver</Link><Link to="/area-driver/contratto">Profilo contrattuale</Link></nav>
    <p>Le simulazioni devono essere salvate nello strumento. I confronti calcolati a video possono essere ricostruiti dai turni e dai cedolini; le bozze non salvate non fanno parte del backup. I dati restano separati per browser e indirizzo del sito.</p>
  </div></article>
}
