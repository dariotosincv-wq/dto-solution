import { useEffect, useRef, useState } from 'react'
import { PDFDocument, degrees, rgb } from 'pdf-lib'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import MetaDescription from '../components/common/MetaDescription.jsx'
import { inspectNacScanPdf } from '../lib/nacscanPdf.js'
import { createCoverAnnotation, createSignatureAnnotation, createTextAnnotation, movePagePointFromVisualDelta, pageToVisualPoint, updateTextAnnotation, visualToPagePoint } from '../lib/nacscanAnnotations.js'
import { drawNacScanText, embedNacScanTextFonts } from '../lib/nacscanPdfText.js'

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

    render().catch((error) => {
      if (import.meta.env.DEV) console.error('[NACScan Web] PDF preview failed', error)
    })
    return () => {
      cancelled = true
      renderTask?.cancel()
      loadingTask?.destroy()
    }
  }, [page])

  return (
    <button className={`nacscan-web-page${selected ? ' is-selected' : ''}`} type="button" onClick={onSelect} aria-pressed={selected}>
      <canvas ref={canvasRef} aria-label="Anteprima pagina" />
      {(page.annotations || []).some((item) => item.type === 'signature') && <span className="nacscan-web-page__signed">Firmata</span>}
    </button>
  )
}

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2]

function AnnotationOverlay({ annotation, onUpdate, rotation, selected, onSelect }) {
  const dragRef = useRef(null)
  const visual = pageToVisualPoint(annotation.x, annotation.y, rotation)

  const startDrag = (event) => {
    event.stopPropagation()
    dragRef.current = { clientX: event.clientX, clientY: event.clientY, x: visual.x, y: visual.y, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveDrag = (event) => {
    if (!dragRef.current) return
    const stage = event.currentTarget.closest('.nacscan-viewer__stage').getBoundingClientRect()
    const pixelDeltaX = event.clientX - dragRef.current.clientX
    const pixelDeltaY = event.clientY - dragRef.current.clientY
    if (!dragRef.current.moved && Math.hypot(pixelDeltaX, pixelDeltaY) < 3) return
    const deltaX = pixelDeltaX / stage.width
    const deltaY = pixelDeltaY / stage.height
    dragRef.current.moved = true
    onUpdate(annotation.id, { ...annotation, ...movePagePointFromVisualDelta(annotation, deltaX, deltaY, rotation) })
  }

  const finishDrag = (event) => {
    event.stopPropagation()
    const moved = dragRef.current?.moved
    dragRef.current = null
    if (!moved) {
      if (annotation.type === 'text') onSelect(annotation.id)
      else if (window.confirm('Eliminare questo elemento?')) onUpdate(annotation.id, null)
    }
  }

  return (
    <div className="nacscan-annotation-anchor" style={{ left: `${visual.x * 100}%`, top: `${visual.y * 100}%`, width: annotation.width ? `${annotation.width * 100}%` : undefined, height: annotation.height ? `${annotation.height * 100}%` : undefined }}>
    <div
      className={`nacscan-annotation nacscan-annotation--${annotation.type}${selected ? ' is-selected' : ''}`}
      style={{ fontSize: annotation.fontSize ? `${annotation.fontSize}px` : undefined, color: annotation.color, fontWeight: annotation.fontWeight, fontStyle: annotation.fontStyle, textDecoration: annotation.textDecoration, transform: `rotate(${rotation}deg)` }}
      role="button"
      tabIndex="0"
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
      onPointerCancel={() => { dragRef.current = null }}
      aria-label={annotation.type === 'text' ? 'Testo PDF; trascina per spostare o tocca per modificare' : 'Elemento PDF; trascina per spostare o tocca per eliminare'}
    >{annotation.type === 'text' ? annotation.text : annotation.type === 'signature' ? <img src={annotation.image} alt="Firma" /> : ''}{annotation.type === 'signature' && <span className="nacscan-signature-size" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}><button type="button" aria-label="Riduci firma" onClick={(event) => { event.stopPropagation(); onUpdate(annotation.id, { ...annotation, width: Math.max(.12, annotation.width - .05) }) }}>−</button><button type="button" aria-label="Ingrandisci firma" onClick={(event) => { event.stopPropagation(); onUpdate(annotation.id, { ...annotation, width: Math.min(.65, annotation.width + .05) }) }}>+</button></span>}</div>
    </div>
  )
}

function DocumentViewer({ page, pageNumber, pageCount, onPrevious, onNext, activeTool, onAddAnnotation, onUpdateAnnotation, selectedAnnotationId, onSelectAnnotation }) {
  const canvasRef = useRef(null)
  const viewportRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [fitWidth, setFitWidth] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [availableWidth, setAvailableWidth] = useState(900)

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(Math.max(280, entry.contentRect.width - 32)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [fullscreen])

  useEffect(() => {
    if (!fullscreen) return undefined
    const closeOnEscape = (event) => { if (event.key === 'Escape') setFullscreen(false) }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [fullscreen])

  useEffect(() => {
    let cancelled = false
    let loadingTask
    let renderTask

    async function render() {
      const canvas = canvasRef.current
      if (!canvas || !page) return
      const context = canvas.getContext('2d')
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)

      if (page.kind === 'image') {
        const image = new Image()
        image.onload = () => {
          if (cancelled) return
          const rotated = page.rotation % 180 !== 0
          const sourceWidth = rotated ? image.height : image.width
          const sourceHeight = rotated ? image.width : image.height
          const cssWidth = fitWidth ? availableWidth : sourceWidth * zoom
          const scale = cssWidth / sourceWidth
          canvas.width = Math.round(cssWidth * pixelRatio)
          canvas.height = Math.round(sourceHeight * scale * pixelRatio)
          canvas.style.width = `${cssWidth}px`
          canvas.style.height = `${sourceHeight * scale}px`
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
          context.translate(cssWidth / 2, (sourceHeight * scale) / 2)
          context.rotate((page.rotation * Math.PI) / 180)
          context.drawImage(image, -(image.width * scale) / 2, -(image.height * scale) / 2, image.width * scale, image.height * scale)
        }
        image.src = page.url
        return
      }

      loadingTask = getDocument({ data: page.bytes.slice() })
      const pdf = await loadingTask.promise
      const pdfPage = await pdf.getPage(page.pageNumber)
      const baseViewport = pdfPage.getViewport({ scale: 1, rotation: page.rotation })
      const scale = fitWidth ? availableWidth / baseViewport.width : zoom
      const viewport = pdfPage.getViewport({ scale: scale * pixelRatio, rotation: page.rotation })
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${viewport.width / pixelRatio}px`
      canvas.style.height = `${viewport.height / pixelRatio}px`
      renderTask = pdfPage.render({ canvasContext: context, viewport })
      await renderTask.promise
    }

    render().catch((error) => { if (import.meta.env.DEV) console.error('[NACScan Web] Large preview failed', error) })
    return () => {
      cancelled = true
      renderTask?.cancel()
      loadingTask?.destroy()
    }
  }, [page, zoom, fitWidth, availableWidth])

  const changeZoom = (direction) => {
    const current = fitWidth ? 1 : zoom
    const index = ZOOM_LEVELS.findIndex((level) => level >= current)
    const target = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, index + direction))
    setFitWidth(false)
    setZoom(ZOOM_LEVELS[target])
  }

  const handlePageClick = (event) => {
    if (!activeTool || event.target !== canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const visualX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const visualY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    onAddAnnotation(visualToPagePoint(visualX, visualY, page.rotation))
  }

  return (
    <section className={`nacscan-viewer${fullscreen ? ' is-fullscreen' : ''}`} aria-label="Visualizzatore documento">
      <div className="nacscan-viewer__toolbar">
        <button type="button" onClick={onPrevious} disabled={pageNumber <= 1} aria-label="Pagina precedente">←</button>
        <strong>{pageNumber} / {pageCount}</strong>
        <button type="button" onClick={onNext} disabled={pageNumber >= pageCount} aria-label="Pagina successiva">→</button>
        <span className="nacscan-viewer__divider" />
        <button type="button" onClick={() => changeZoom(-1)} aria-label="Riduci zoom">−</button>
        <span>{fitWidth ? 'Adatta' : `${Math.round(zoom * 100)}%`}</span>
        <button type="button" onClick={() => changeZoom(1)} aria-label="Aumenta zoom">+</button>
        <button type="button" onClick={() => setFitWidth(true)}>Adatta alla larghezza</button>
        <button className="nacscan-viewer__fullscreen" type="button" onClick={() => setFullscreen((value) => !value)}>{fullscreen ? 'Chiudi schermo intero' : 'Schermo intero'}</button>
      </div>
      <div className={`nacscan-viewer__viewport${activeTool ? ' is-editing' : ''}`} ref={viewportRef}>
        <div className="nacscan-viewer__stage" onClick={handlePageClick}>
          <canvas ref={canvasRef} aria-label={`Pagina ${pageNumber} del documento`} />
          {(page.annotations || []).map((annotation) => <AnnotationOverlay annotation={annotation} key={annotation.id} onUpdate={onUpdateAnnotation} rotation={page.rotation} selected={annotation.id === selectedAnnotationId} onSelect={onSelectAnnotation} />)}
        </div>
      </div>
    </section>
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
        <p>Disegnala qui oppure importa un’immagine. Poi clicca sulla pagina per posizionarla.</p>
        <canvas ref={canvasRef} width="720" height="240" onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = false }} onPointerCancel={() => { drawing.current = false }} />
        <div className="button-group">
          <button className="button button--secondary" type="button" onClick={() => canvasRef.current.getContext('2d').clearRect(0, 0, 720, 240)}>Cancella</button>
          <button className="button button--primary" type="button" onClick={() => onSave(canvasRef.current.toDataURL('image/png'))}>Inserisci firma</button>
          <label className="button button--secondary">Importa firma<input className="nacscan-hidden-input" type="file" accept="image/png,image/jpeg" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => onSave(String(reader.result)); reader.readAsDataURL(file) }} /></label>
          <button className="button button--text" type="button" onClick={onClose}>Annulla</button>
        </div>
      </div>
    </div>
  )
}

function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState(() => navigator.mediaDevices?.getUserMedia ? '' : 'Fotocamera non disponibile. Puoi importare un’immagine dal dispositivo.')

  useEffect(() => {
    let active = true
    if (!navigator.mediaDevices?.getUserMedia) {
      return undefined
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((stream) => { if (!active) { stream.getTracks().forEach((track) => track.stop()); return }; streamRef.current = stream; videoRef.current.srcObject = stream })
      .catch(() => setError('Fotocamera non disponibile o permesso negato. Puoi importare un’immagine dal dispositivo.'))
    return () => { active = false; streamRef.current?.getTracks().forEach((track) => track.stop()) }
  }, [])

  const takePhoto = () => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => { if (blob) onCapture(new File([blob], `Scansione-${Date.now()}.jpg`, { type: 'image/jpeg' })) }, 'image/jpeg', .92)
  }

  return <div className="nacscan-signature" role="dialog" aria-modal="true" aria-labelledby="camera-title"><div className="nacscan-signature__panel"><h2 id="camera-title">Scansiona</h2>{error ? <p role="alert">{error}</p> : <video className="nacscan-camera-preview" ref={videoRef} autoPlay muted playsInline />}<div className="button-group">{!error && <button className="button button--primary" type="button" onClick={takePhoto}>Scatta foto</button>}<label className="button button--secondary">Importa immagine<input className="nacscan-hidden-input" type="file" accept="image/png,image/jpeg" onChange={(event) => { const file = event.target.files?.[0]; if (file) onCapture(file) }} /></label><button className="button button--text" type="button" onClick={onClose}>Annulla</button></div></div></div>
}

function NacScanWebPage() {
  const [pages, setPages] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTool, setActiveTool] = useState('')
  const [textOptions, setTextOptions] = useState({ size: 18, color: 'black' })
  const [extractedText, setExtractedText] = useState('')
  const [toolsOpen, setToolsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [pendingSignature, setPendingSignature] = useState('')
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null)

  const selectedIndex = pages.findIndex((page) => page.id === selectedId)
  const selectedText = (pages[selectedIndex]?.annotations || []).find((annotation) => annotation.id === selectedAnnotationId && annotation.type === 'text') || null

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
          const { pageCount } = await inspectNacScanPdf(bytes)
          for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) additions.push({ id: makeId(), kind: 'pdf', bytes, pageNumber, rotation: 0, name: file.name })
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
    } catch (error) {
      if (import.meta.env.DEV) console.error('[NACScan Web] Document import failed', error)
      setMessage('Non è stato possibile leggere il documento. Verifica che il file non sia protetto o danneggiato.')
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  function updateSelected(updater) {
    setPages((current) => current.map((page) => page.id === selectedId ? updater(page) : page))
  }

  function addAnnotation(point) {
    const { x, y } = point
    if (activeTool === 'text') {
      const text = window.prompt('Testo da inserire')?.trim()
      if (!text) return
      const annotation = createTextAnnotation(x, y, text, textOptions.size, textOptions.color)
      updateSelected((page) => ({ ...page, annotations: [...(page.annotations || []), annotation] }))
      setSelectedAnnotationId(annotation.id)
    } else if (activeTool === 'cover') {
      updateSelected((page) => ({ ...page, annotations: [...(page.annotations || []), createCoverAnnotation(x, y)] }))
    } else if (activeTool === 'signature' && pendingSignature) {
      updateSelected((page) => ({ ...page, annotations: [...(page.annotations || []), createSignatureAnnotation(x, y, pendingSignature)] }))
      setPendingSignature('')
    }
    setActiveTool('')
  }

  async function addCapturedFile(file) {
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    await importFiles({ target: { files: dataTransfer.files, value: '' } })
    setCameraOpen(false)
  }

  function updateAnnotation(id, value) {
    updateSelected((page) => ({ ...page, annotations: value ? (page.annotations || []).map((item) => item.id === id ? value : item) : (page.annotations || []).filter((item) => item.id !== id) }))
    if (!value) setSelectedAnnotationId((current) => current === id ? null : current)
  }

  function updateSelectedText(changes) {
    if (selectedText) updateAnnotation(selectedText.id, updateTextAnnotation(selectedText, changes))
  }

  async function extractText() {
    setBusy(true)
    try {
      const chunks = []
      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index]
        if (page.kind !== 'pdf') continue
        const task = getDocument({ data: page.bytes.slice() })
        const pdf = await task.promise
        const content = await (await pdf.getPage(page.pageNumber)).getTextContent()
        chunks.push(`Pagina ${index + 1}\n${content.items.map((item) => item.str).join(' ')}`)
        await pdf.destroy()
      }
      setExtractedText(chunks.join('\n\n') || 'Il documento non contiene testo digitale estraibile.')
    } catch {
      setMessage('Estrazione del testo non riuscita.')
    } finally { setBusy(false) }
  }

  async function extractTextFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const task = getDocument({ data: bytes.slice() })
      const pdf = await task.promise
      const chunks = []
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const content = await (await pdf.getPage(pageNumber)).getTextContent()
        chunks.push(`Pagina ${pageNumber}\n${content.items.map((item) => item.str).join(' ')}`)
      }
      await pdf.destroy()
      setExtractedText(chunks.join('\n\n') || 'Il documento non contiene testo digitale estraibile.')
    } catch { setMessage('Estrazione del testo non riuscita.') } finally { setBusy(false); event.target.value = '' }
  }

  function returnHome() {
    setPages([])
    setSelectedId(null)
    setActiveTool('')
    setToolsOpen(false)
    setMessage('')
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
      const textFonts = await embedNacScanTextFonts(output)
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
          targetPage = output.addPage([embedded.width, embedded.height])
          targetPage.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height })
          targetPage.setRotation(degrees(page.rotation))
        }
        for (const annotation of page.annotations || []) {
          const { width, height } = targetPage.getSize()
          if (annotation.type === 'text') {
            drawNacScanText(targetPage, annotation, textFonts)
          } else if (annotation.type === 'cover') {
            targetPage.drawRectangle({ x: annotation.x * width, y: (1 - annotation.y) * height, width: annotation.width * width, height: annotation.height * height, color: rgb(0, 0, 0) })
          } else if (annotation.type === 'signature') {
            const signature = annotation.image.startsWith('data:image/jpeg') ? await output.embedJpg(annotation.image) : await output.embedPng(annotation.image)
            const signatureWidth = annotation.width * width
            const signatureHeight = signature.height * (signatureWidth / signature.width)
            targetPage.drawImage(signature, { x: annotation.x * width, y: (1 - annotation.y) * height, width: signatureWidth, height: signatureHeight })
          }
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
        <header className="nacscan-app-header">
          <img src="/nacscan/logo-nacscan.webp" alt="NACScan" />
          <div><p className="eyebrow">NACScan Web</p><h1>Scansiona · Firma · Salva</h1></div>
          <span className="nacscan-web__privacy">Elaborazione locale</span>
        </header>
        {busy && <p className="nacscan-web__progress" role="status">Elaborazione in corso…</p>}

        <section className="nacscan-web__workspace" aria-label="Editor documenti">
          {pages.length > 0 && <div className="nacscan-internal-header"><button type="button" onClick={returnHome}>← Home</button><strong>{pages[0]?.name || 'Documento PDF'}</strong><span>{pages.length} {pages.length === 1 ? 'pagina' : 'pagine'}</span></div>}
          {pages.length > 0 && <div className="nacscan-web__import">
            <label className="button button--primary">
              {busy ? 'Elaborazione…' : 'Aggiungi pagine'}
              <input type="file" accept="application/pdf,image/jpeg,image/png" multiple onChange={importFiles} disabled={busy} />
            </label>
            <button className="button button--secondary" type="button" onClick={() => setCameraOpen(true)}>Scansiona con fotocamera</button>
            <span className="nacscan-web__privacy">Elaborazione locale</span>
          </div>}

          {pages.length === 0 ? (
            <main className="nacscan-home" aria-label="Home NACScan">
              <img className="nacscan-home__banner" src="/nacscan/banner-nacscan.webp" alt="NACScan: scansiona, firma e salva" />
              <nav className="nacscan-home__actions" aria-label="Azioni NACScan">
                <button className="nacscan-home-action nacscan-home-action--scan" type="button" onClick={() => setCameraOpen(true)}><strong>SC</strong><span>Scansiona</span><small>Usa la fotocamera</small></button>
                <label className="nacscan-home-action nacscan-home-action--pdf"><strong>PDF</strong><span>Modifica PDF</span><small>Apri e compila un documento</small><input type="file" accept="application/pdf" onChange={importFiles} /></label>
                <label className="nacscan-home-action nacscan-home-action--text"><strong>TXT</strong><span>Estrai testo</span><small>Leggi il testo digitale</small><input type="file" accept="application/pdf" onChange={extractTextFile} /></label>
                <label className="nacscan-home-action nacscan-home-action--archive"><strong>AR</strong><span>Archivio</span><small>Apri dal dispositivo</small><input type="file" accept="application/pdf" onChange={importFiles} /></label>
                <button className="nacscan-home-action nacscan-home-action--settings" type="button" onClick={() => setSettingsOpen(true)}><strong>IM</strong><span>Impostazioni</span><small>Preferenze editor PDF</small></button>
              </nav>
              <p className="nacscan-home__privacy">I documenti rimangono sul dispositivo e non vengono caricati online.</p>
            </main>
          ) : (
            <>
              <div className="nacscan-web__toolbar" aria-label="Strumenti pagina">
                <strong>Pagina {selectedIndex + 1} di {pages.length}</strong>
                <button type="button" onClick={() => moveSelected(-1)} disabled={selectedIndex <= 0}>← Sposta</button>
                <button type="button" onClick={() => moveSelected(1)} disabled={selectedIndex === pages.length - 1}>Sposta →</button>
                <button type="button" onClick={() => updateSelected((page) => ({ ...page, rotation: (page.rotation + 90) % 360 }))}>Ruota</button>
                <button className="is-danger" type="button" onClick={removeSelected}>Elimina</button>
              </div>
              <div className="nacscan-web__pages">
                {pages.map((page, index) => <div className="nacscan-web__page-item" key={page.id}><span>{index + 1}</span><PagePreview page={page} selected={page.id === selectedId} onSelect={() => setSelectedId(page.id)} /></div>)}
              </div>
              <DocumentViewer
                page={pages[selectedIndex]}
                pageNumber={selectedIndex + 1}
                pageCount={pages.length}
                onPrevious={() => setSelectedId(pages[selectedIndex - 1]?.id || selectedId)}
                onNext={() => setSelectedId(pages[selectedIndex + 1]?.id || selectedId)}
                activeTool={activeTool}
                onAddAnnotation={addAnnotation}
                onUpdateAnnotation={updateAnnotation}
                selectedAnnotationId={selectedAnnotationId}
                onSelectAnnotation={setSelectedAnnotationId}
              />
              {selectedText && <div className="nacscan-text-toolbar" aria-label="Modifica testo selezionato"><label>Testo<input type="text" value={selectedText.text} onChange={(event) => updateSelectedText({ text: event.target.value })} /></label><label>Dimensione<input type="number" min="8" max="72" value={selectedText.fontSize} onChange={(event) => updateSelectedText({ fontSize: Math.max(8, Math.min(72, Number(event.target.value) || 8)) })} /></label><button className={selectedText.fontWeight === 'bold' ? 'is-active' : ''} type="button" aria-pressed={selectedText.fontWeight === 'bold'} aria-label="Grassetto" onClick={() => updateSelectedText({ fontWeight: selectedText.fontWeight === 'bold' ? 'normal' : 'bold' })}>B</button><button className={selectedText.fontStyle === 'italic' ? 'is-active' : ''} type="button" aria-pressed={selectedText.fontStyle === 'italic'} aria-label="Corsivo" onClick={() => updateSelectedText({ fontStyle: selectedText.fontStyle === 'italic' ? 'normal' : 'italic' })}><em>I</em></button><button className={selectedText.textDecoration === 'underline' ? 'is-active' : ''} type="button" aria-pressed={selectedText.textDecoration === 'underline'} aria-label="Sottolineato" onClick={() => updateSelectedText({ textDecoration: selectedText.textDecoration === 'underline' ? 'none' : 'underline' })}><u>U</u></button><select aria-label="Colore testo selezionato" value={selectedText.color} onChange={(event) => updateSelectedText({ color: event.target.value })}><option value="black">Nero</option><option value="blue">Blu</option><option value="red">Rosso</option></select><button className="is-danger" type="button" onClick={() => updateAnnotation(selectedText.id, null)}>Elimina</button></div>}
              <div className="nacscan-viewer-actions">
                <button type="button" onClick={extractText}>Trova testo</button>
                <button type="button" onClick={() => setSelectedId(pages[selectedIndex - 1]?.id || selectedId)} disabled={selectedIndex <= 0}>Pagina precedente</button>
                <button type="button" onClick={() => setSelectedId(pages[selectedIndex + 1]?.id || selectedId)} disabled={selectedIndex >= pages.length - 1}>Pagina successiva</button>
                <button className="nacscan-tools-button" type="button" onClick={() => setToolsOpen((value) => !value)}>Strumenti</button>
              </div>
              {toolsOpen && <aside className="nacscan-tools-panel" aria-label="Strumenti PDF"><h2>Strumenti</h2><button type="button" onClick={exportPdf}>Condividi / Salva</button><button type="button" onClick={() => { setActiveTool('text'); setToolsOpen(false) }}>Compila PDF</button><button type="button" onClick={() => updateSelected((page) => ({ ...page, rotation: (page.rotation + 90) % 360 }))}>Raddrizza pagina</button><label>Aggiungi pagine<input type="file" accept="application/pdf,image/jpeg,image/png" multiple onChange={importFiles} /></label><button type="button" onClick={() => { setActiveTool('cover'); setToolsOpen(false) }}>Copri testo</button><button className="is-primary" type="button" onClick={() => { setSignatureOpen(true); setToolsOpen(false) }}>Firma</button></aside>}
              {activeTool === 'text' && <div className="nacscan-edit-options"><strong>Compila PDF</strong><span>Clicca sulla pagina per inserire il testo.</span><select aria-label="Dimensione testo" value={textOptions.size} onChange={(event) => setTextOptions((value) => ({ ...value, size: Number(event.target.value) }))}><option>12</option><option>18</option><option>24</option><option>32</option></select><select aria-label="Colore testo" value={textOptions.color} onChange={(event) => setTextOptions((value) => ({ ...value, color: event.target.value }))}><option value="black">Nero</option><option value="blue">Blu</option><option value="red">Rosso</option></select><button type="button" onClick={() => setActiveTool('')}>Esci</button></div>}
              {activeTool === 'cover' && <div className="nacscan-edit-options"><strong>Copri testo</strong><span>Clicca sulla pagina per coprire un’area.</span><button type="button" onClick={() => setActiveTool('')}>Esci</button></div>}
              <div className="nacscan-web__export">
                <p>{message || 'Seleziona una pagina per modificarla.'}</p>
                <button className="button button--primary" type="button" onClick={exportPdf} disabled={busy}>Salva PDF</button>
              </div>
            </>
          )}
          {message && pages.length === 0 && <p className="nacscan-web__message" role="status">{message}</p>}
        </section>
      </div>
      {signatureOpen && <SignaturePad onClose={() => setSignatureOpen(false)} onSave={(signature) => { setPendingSignature(signature); setActiveTool('signature'); setSignatureOpen(false); setMessage('Clicca sulla pagina nel punto in cui vuoi inserire la firma.') }} />}
      {cameraOpen && <CameraCapture onClose={() => setCameraOpen(false)} onCapture={addCapturedFile} />}
      {extractedText && <div className="nacscan-signature" role="dialog" aria-modal="true" aria-labelledby="extracted-title"><div className="nacscan-signature__panel"><h2 id="extracted-title">Testo estratto</h2><textarea className="nacscan-extracted-text" readOnly value={extractedText} /><div className="button-group"><button className="button button--secondary" type="button" onClick={() => navigator.clipboard?.writeText(extractedText)}>Copia</button><button className="button button--primary" type="button" onClick={() => setExtractedText('')}>Chiudi</button></div></div></div>}
      {settingsOpen && <div className="nacscan-signature" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="nacscan-signature__panel"><h2 id="settings-title">Impostazioni</h2><div className="nacscan-settings-row"><label>Dimensione testo predefinita<select value={textOptions.size} onChange={(event) => setTextOptions((value) => ({ ...value, size: Number(event.target.value) }))}><option>12</option><option>18</option><option>24</option><option>32</option></select></label><label>Colore testo predefinito<select value={textOptions.color} onChange={(event) => setTextOptions((value) => ({ ...value, color: event.target.value }))}><option value="black">Nero</option><option value="blue">Blu</option><option value="red">Rosso</option></select></label></div><p>I file sono elaborati localmente e non vengono archiviati da DTO Solution.</p><button className="button button--primary" type="button" onClick={() => setSettingsOpen(false)}>Chiudi</button></div></div>}
    </article>
  )
}

export default NacScanWebPage
