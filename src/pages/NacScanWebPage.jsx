import { useEffect, useRef, useState } from 'react'
import { PDFDocument, degrees } from 'pdf-lib'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import MetaDescription from '../components/common/MetaDescription.jsx'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

function PagePreview({ page, selected, onSelect }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let loadingTask
    let renderTask

    async function render() {
      const canvas = canvasRef.current
      if (!canvas) return
      const context = canvas.getContext('2d')

      if (page.kind === 'image') {
        const image = new Image()
        image.onload = () => {
          if (cancelled) return
          const rotated = page.rotation % 180 !== 0
          const max = 520
          const scale = Math.min(1, max / Math.max(image.width, image.height))
          const width = Math.round(image.width * scale)
          const height = Math.round(image.height * scale)
          canvas.width = rotated ? height : width
          canvas.height = rotated ? width : height
          context.save()
          context.translate(canvas.width / 2, canvas.height / 2)
          context.rotate((page.rotation * Math.PI) / 180)
          context.drawImage(image, -width / 2, -height / 2, width, height)
          context.restore()
        }
        image.src = page.url
        return
      }

      loadingTask = getDocument({ data: page.bytes.slice() })
      const pdf = await loadingTask.promise
      const pdfPage = await pdf.getPage(page.pageNumber)
      const viewport = pdfPage.getViewport({ scale: 0.55, rotation: page.rotation })
      canvas.width = viewport.width
      canvas.height = viewport.height
      renderTask = pdfPage.render({ canvasContext: context, viewport })
      await renderTask.promise
    }

    render().catch(() => {})
    return () => {
      cancelled = true
      renderTask?.cancel()
      loadingTask?.destroy()
    }
  }, [page])

  return (
    <button className={`nacscan-web-page${selected ? ' is-selected' : ''}`} type="button" onClick={onSelect} aria-pressed={selected}>
      <canvas ref={canvasRef} aria-label="Anteprima pagina" />
      {page.signature && <span className="nacscan-web-page__signed">Firmata</span>}
    </button>
  )
}

function SignaturePad({ onSave, onClose }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return [(event.clientX - rect.left) * (canvasRef.current.width / rect.width), (event.clientY - rect.top) * (canvasRef.current.height / rect.height)]
  }

  const start = (event) => {
    drawing.current = true
    const [x, y] = point(event)
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x, y)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const move = (event) => {
    if (!drawing.current) return
    const [x, y] = point(event)
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#10233f'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  return (
    <div className="nacscan-signature" role="dialog" aria-modal="true" aria-labelledby="signature-title">
      <div className="nacscan-signature__panel">
        <h2 id="signature-title">Disegna la firma</h2>
        <p>La firma verrà inserita al centro in basso nella pagina selezionata.</p>
        <canvas ref={canvasRef} width="720" height="240" onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = false }} onPointerCancel={() => { drawing.current = false }} />
        <div className="button-group">
          <button className="button button--secondary" type="button" onClick={() => canvasRef.current.getContext('2d').clearRect(0, 0, 720, 240)}>Cancella</button>
          <button className="button button--primary" type="button" onClick={() => onSave(canvasRef.current.toDataURL('image/png'))}>Inserisci firma</button>
          <button className="button button--text" type="button" onClick={onClose}>Annulla</button>
        </div>
      </div>
    </div>
  )
}

function NacScanWebPage() {
  const [pages, setPages] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const selectedIndex = pages.findIndex((page) => page.id === selectedId)

  async function importFiles(event) {
    const files = [...event.target.files]
    if (!files.length) return
    setBusy(true)
    setMessage('')
    try {
      const additions = []
      for (const file of files) {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const bytes = new Uint8Array(await file.arrayBuffer())
          const pdf = await getDocument({ data: bytes.slice() }).promise
          for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) additions.push({ id: makeId(), kind: 'pdf', bytes, pageNumber, rotation: 0, name: file.name })
          await pdf.destroy()
        } else if (file.type === 'image/jpeg' || file.type === 'image/png') {
          const bytes = new Uint8Array(await file.arrayBuffer())
          additions.push({ id: makeId(), kind: 'image', bytes, mime: file.type, url: URL.createObjectURL(file), rotation: 0, name: file.name })
        } else {
          throw new Error('Unsupported image format')
        }
      }
      setPages((current) => [...current, ...additions])
      setSelectedId((current) => current || additions[0]?.id || null)
      setMessage(`${additions.length} ${additions.length === 1 ? 'pagina importata' : 'pagine importate'}.`)
    } catch {
      setMessage('Non è stato possibile leggere il documento. Verifica che il file non sia protetto o danneggiato.')
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  function updateSelected(updater) {
    setPages((current) => current.map((page) => page.id === selectedId ? updater(page) : page))
  }

  function moveSelected(offset) {
    if (selectedIndex < 0) return
    const target = selectedIndex + offset
    if (target < 0 || target >= pages.length) return
    setPages((current) => {
      const next = [...current]
      const [page] = next.splice(selectedIndex, 1)
      next.splice(target, 0, page)
      return next
    })
  }

  function removeSelected() {
    if (selectedIndex < 0) return
    const removed = pages[selectedIndex]
    if (removed.kind === 'image') URL.revokeObjectURL(removed.url)
    const next = pages.filter((page) => page.id !== selectedId)
    setPages(next)
    setSelectedId(next[Math.min(selectedIndex, next.length - 1)]?.id || null)
  }

  async function exportPdf() {
    setBusy(true)
    setMessage('Creazione PDF in corso…')
    try {
      const output = await PDFDocument.create()
      for (const page of pages) {
        let targetPage
        if (page.kind === 'pdf') {
          const source = await PDFDocument.load(page.bytes)
          const [copied] = await output.copyPages(source, [page.pageNumber - 1])
          output.addPage(copied)
          copied.setRotation(degrees((copied.getRotation().angle + page.rotation) % 360))
          targetPage = copied
        } else {
          const embedded = page.mime === 'image/png' ? await output.embedPng(page.bytes) : await output.embedJpg(page.bytes)
          const rotated = page.rotation % 180 !== 0
          const width = rotated ? embedded.height : embedded.width
          const height = rotated ? embedded.width : embedded.height
          targetPage = output.addPage([width, height])
          targetPage.drawImage(embedded, page.rotation === 90 ? { x: width, y: 0, width: embedded.width, height: embedded.height, rotate: degrees(90) } : page.rotation === 180 ? { x: width, y: height, width: embedded.width, height: embedded.height, rotate: degrees(180) } : page.rotation === 270 ? { x: 0, y: height, width: embedded.width, height: embedded.height, rotate: degrees(270) } : { x: 0, y: 0, width, height })
        }
        if (page.signature) {
          const signature = await output.embedPng(page.signature)
          const { width, height } = targetPage.getSize()
          const signatureWidth = Math.min(width * 0.35, 220)
          const signatureHeight = signature.height * (signatureWidth / signature.width)
          targetPage.drawImage(signature, { x: (width - signatureWidth) / 2, y: height * 0.08, width: signatureWidth, height: signatureHeight })
        }
      }
      const blob = new Blob([await output.save()], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `NACScan-${new Date().toISOString().slice(0, 10)}.pdf`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('PDF creato e scaricato sul dispositivo.')
    } catch {
      setMessage('Esportazione non riuscita. Prova con un documento diverso.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="page-section nacscan-web">
      <MetaDescription content="NACScan Web: importa, organizza, firma ed esporta documenti PDF direttamente nel browser." />
      <div className="container nacscan-web__layout">
        <header className="nacscan-web__header">
          <p className="eyebrow">NACScan Web</p>
          <h1>Gestisci i tuoi documenti direttamente dal browser.</h1>
          <p>PDF e immagini vengono elaborati solo sul tuo dispositivo: nessun file viene caricato o conservato da DTO Solution.</p>
        </header>

        <section className="nacscan-web__workspace" aria-label="Editor documenti">
          <div className="nacscan-web__import">
            <label className="button button--primary">
              {busy ? 'Elaborazione…' : 'Carica PDF o immagini'}
              <input type="file" accept="application/pdf,image/jpeg,image/png" multiple onChange={importFiles} disabled={busy} />
            </label>
            <label className="button button--secondary">
              Scansiona con fotocamera
              <input type="file" accept="image/jpeg,image/png" capture="environment" multiple onChange={importFiles} disabled={busy} />
            </label>
            <span className="nacscan-web__privacy">Elaborazione locale</span>
          </div>

          {pages.length === 0 ? (
            <div className="nacscan-web__empty">
              <span aria-hidden="true">PDF</span>
              <h2>Inizia caricando un documento</h2>
              <p>Puoi selezionare un PDF, più immagini oppure usare la fotocamera dello smartphone.</p>
            </div>
          ) : (
            <>
              <div className="nacscan-web__toolbar" aria-label="Strumenti pagina">
                <strong>Pagina {selectedIndex + 1} di {pages.length}</strong>
                <button type="button" onClick={() => moveSelected(-1)} disabled={selectedIndex <= 0}>← Sposta</button>
                <button type="button" onClick={() => moveSelected(1)} disabled={selectedIndex === pages.length - 1}>Sposta →</button>
                <button type="button" onClick={() => updateSelected((page) => ({ ...page, rotation: (page.rotation + 90) % 360 }))}>Ruota</button>
                <button type="button" onClick={() => setSignatureOpen(true)}>Firma</button>
                <button className="is-danger" type="button" onClick={removeSelected}>Elimina</button>
              </div>
              <div className="nacscan-web__pages">
                {pages.map((page, index) => <div className="nacscan-web__page-item" key={page.id}><span>{index + 1}</span><PagePreview page={page} selected={page.id === selectedId} onSelect={() => setSelectedId(page.id)} /></div>)}
              </div>
              <div className="nacscan-web__export">
                <p>{message || 'Seleziona una pagina per modificarla.'}</p>
                <button className="button button--primary" type="button" onClick={exportPdf} disabled={busy}>Scarica PDF finale</button>
              </div>
            </>
          )}
          {message && pages.length === 0 && <p className="nacscan-web__message" role="status">{message}</p>}
        </section>
      </div>
      {signatureOpen && <SignaturePad onClose={() => setSignatureOpen(false)} onSave={(signature) => { updateSelected((page) => ({ ...page, signature })); setSignatureOpen(false); setMessage('Firma aggiunta alla pagina selezionata.') }} />}
    </article>
  )
}

export default NacScanWebPage
