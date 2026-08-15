import { useCallback, useEffect, useRef, useState } from 'react'
import MetaDescription from '../components/common/MetaDescription.jsx'
import ZoomablePhoto from '../components/checkvan/ZoomablePhoto.jsx'
import { clampZoom } from '../lib/zoom.js'
import { CHECKVAN_CATEGORIES, platesDiffer, readCheckvanPdf, releaseComparison, validatePdfFile } from '../lib/checkvanComparison.js'
import { useI18n } from '../i18n/useI18n.js'

const initialTransform = { zoom: 1, x: 0, y: 0 }

function CheckVanComparisonPage() {
  const { language, t } = useI18n()
  const firstInput = useRef(null)
  const secondInput = useRef(null)
  const inputs = [firstInput, secondInput]
  const [files, setFiles] = useState([null, null])
  const [documents, setDocuments] = useState([])
  const documentsRef = useRef([])
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [active, setActive] = useState(null)
  const [transforms, setTransforms] = useState({})

  const reset = useCallback(async () => {
    await releaseComparison(documents)
    ;[firstInput, secondInput].forEach((input) => { if (input.current) input.current.value = '' })
    setFiles([null, null]); setDocuments([]); setActive(null); setTransforms({}); setError(''); setProgress('')
  }, [documents, firstInput, secondInput])

  useEffect(() => { documentsRef.current = documents }, [documents])
  useEffect(() => () => { releaseComparison(documentsRef.current) }, [])

  const compare = async (event) => {
    event.preventDefault(); setError(''); setProgress(t('Preparazione del confronto…', 'Preparing the comparison…'))
    if (files.some((file) => validatePdfFile(file))) { setError(t('Seleziona due file PDF validi e non vuoti.', 'Select two valid, non-empty PDF files.')); setProgress(''); return }
    const results = []
    try {
      for (let index = 0; index < 2; index += 1) {
        results.push(await readCheckvanPdf(files[index], (page, total) => setProgress(t(`Documento ${index + 1}: pagina ${page} di ${total}…`, `Document ${index + 1}: page ${page} of ${total}…`))))
      }
      setDocuments(results); setProgress('')
    } catch (reason) {
      await releaseComparison(results); setProgress('')
      const known = reason.message === 'not-checkvan' || reason.message === 'no-categories'
      setError(known ? t('Il PDF non è stato riconosciuto come ispezione CheckVan con fotografie guidate.', 'The PDF was not recognized as a CheckVan inspection with guided photos.') : t('Non è stato possibile leggere uno dei PDF.', 'One of the PDFs could not be read.'))
    }
  }

  const updateTransform = (id, value) => setTransforms((current) => ({ ...current, [id]: value }))
  const transformFor = (id) => transforms[id] ?? initialTransform
  const categoryLabel = (category) => language === 'en' ? category.en : category.it
  const summary = (document, heading) => <article className="comparison-summary"><strong>{heading}</strong><span>{document.metadata.inspectionType || '—'}</span><span>{[document.metadata.date, document.metadata.time].filter(Boolean).join(' — ') || '—'}</span><span>{t('Targa', 'Plate')} {document.metadata.plate || '—'}</span><span>{t('Mezzo', 'Vehicle')} {document.metadata.vehicle || '—'}</span></article>
  const photo = (document, category, side, enlarged = false) => <ZoomablePhoto src={document.photos[category.id]} unavailable={!document.photos[category.id] ? t('Foto non presente', 'Photo not available') : ''} alt={`${categoryLabel(category)} — ${side}`} transform={transformFor(`${category.id}-${enlarged ? 'modal' : 'list'}`)} onTransform={(value) => updateTransform(`${category.id}-${enlarged ? 'modal' : 'list'}`, value)} />

  return <>
    <MetaDescription title={t('Confronta ispezioni CheckVan | DTO Solution', 'Compare CheckVan inspections | DTO Solution')} content={t('Confronta affiancate le fotografie guidate di due ispezioni CheckVan. I PDF rimangono sul tuo dispositivo.', 'Compare the guided photographs from two CheckVan inspections side by side. The PDFs remain on your device.')} canonical="https://dtosolution.it/confronta-checkvan" openGraphUrl="https://dtosolution.it/confronta-checkvan" />
    <section className="page-section checkvan-comparison-page"><div className="container comparison-layout">
      <header className="checkvan-verification-hero"><p className="eyebrow">CheckVan · Driver Utility</p><h1>{t('Confronta due ispezioni CheckVan', 'Compare two CheckVan inspections')}</h1><p>{t('Seleziona due PDF dello stesso veicolo per visualizzare affiancate le 14 fotografie guidate. La valutazione resta completamente umana.', 'Select two PDFs for the same vehicle to view the 14 guided photographs side by side. The assessment remains entirely human.')}</p></header>
      <aside className="checkvan-privacy-note"><span className="checkvan-privacy-note__icon" aria-hidden="true">✓</span><div><strong>{t('I PDF rimangono sul tuo dispositivo', 'The PDFs remain on your device')}</strong><p>{t('File e fotografie vengono elaborati soltanto in questo browser e rimossi con il reset.', 'Files and photographs are processed only in this browser and removed on reset.')}</p></div></aside>
      {!documents.length ? <form className="checkvan-verification-form comparison-form" onSubmit={compare}>
        {[0, 1].map((index) => <label className="checkvan-file-field" key={index}><span><strong>{index ? t('PDF dopo', 'After PDF') : t('PDF prima', 'Before PDF')}</strong><small>{files[index]?.name ?? t('Seleziona un PDF CheckVan', 'Select a CheckVan PDF')}</small></span><input ref={inputs[index]} type="file" accept="application/pdf,.pdf" onChange={(event) => setFiles((current) => current.map((file, position) => position === index ? event.target.files?.[0] ?? null : file))} /></label>)}
        <button className="button button--primary" disabled={files.some((file) => !file) || Boolean(progress)}>{progress || t('Confronta ispezioni', 'Compare inspections')}</button>
        {error && <p className="checkvan-local-error" role="alert">{error}</p>}
      </form> : <>
        <div className="comparison-summaries">{summary(documents[0], t('PRIMA', 'BEFORE'))}{summary(documents[1], t('DOPO', 'AFTER'))}</div>
        {platesDiffer(documents[0].metadata.plate, documents[1].metadata.plate) && <p className="comparison-warning" role="alert">{t('Attenzione: i due documenti sembrano riferirsi a veicoli diversi.', 'Warning: the two documents appear to refer to different vehicles.')}</p>}
        <div className="comparison-heading"><div><p className="eyebrow">14 {t('viste guidate', 'guided views')}</p><h2>{t('Confronto ispezioni', 'Inspection comparison')}</h2></div><button className="button button--secondary" onClick={reset}>{t('Nuovo confronto', 'New comparison')}</button></div>
        <div className="comparison-list">{CHECKVAN_CATEGORIES.map((category, index) => <article className="comparison-pair" key={category.id}><header><h3>{index + 1}. {categoryLabel(category)}</h3><button type="button" onClick={() => { setActive(index); updateTransform(`${category.id}-modal`, initialTransform) }}>{t('Apri confronto', 'Open comparison')}</button></header><div className="comparison-grid"><div><strong>{t('PRIMA', 'BEFORE')}</strong>{photo(documents[0], category, t('Prima', 'Before'))}</div><div><strong>{t('DOPO', 'AFTER')}</strong>{photo(documents[1], category, t('Dopo', 'After'))}</div></div><div className="zoom-controls"><button onClick={() => updateTransform(`${category.id}-list`, { ...transformFor(`${category.id}-list`), zoom: clampZoom(transformFor(`${category.id}-list`).zoom - .25) })}>−</button><span>{Math.round(transformFor(`${category.id}-list`).zoom * 100)}%</span><button onClick={() => updateTransform(`${category.id}-list`, { ...transformFor(`${category.id}-list`), zoom: clampZoom(transformFor(`${category.id}-list`).zoom + .25) })}>+</button><button onClick={() => updateTransform(`${category.id}-list`, initialTransform)}>{t('Reimposta', 'Reset')}</button></div></article>)}</div>
      </>}
    </div></section>
    {active !== null && <div className="comparison-modal" role="dialog" aria-modal="true" aria-label={categoryLabel(CHECKVAN_CATEGORIES[active])}><div className="comparison-modal__panel"><header><button disabled={active === 0} onClick={() => setActive(active - 1)}>← {t('Precedente', 'Previous')}</button><h2>{categoryLabel(CHECKVAN_CATEGORIES[active])}</h2><button disabled={active === 13} onClick={() => setActive(active + 1)}>{t('Successiva', 'Next')} →</button><button aria-label={t('Chiudi', 'Close')} onClick={() => setActive(null)}>×</button></header><div className="comparison-grid"><div>{photo(documents[0], CHECKVAN_CATEGORIES[active], t('Prima', 'Before'), true)}</div><div>{photo(documents[1], CHECKVAN_CATEGORIES[active], t('Dopo', 'After'), true)}</div></div><div className="zoom-controls"><button onClick={() => updateTransform(`${CHECKVAN_CATEGORIES[active].id}-modal`, { ...transformFor(`${CHECKVAN_CATEGORIES[active].id}-modal`), zoom: clampZoom(transformFor(`${CHECKVAN_CATEGORIES[active].id}-modal`).zoom - .25) })}>−</button><span>{Math.round(transformFor(`${CHECKVAN_CATEGORIES[active].id}-modal`).zoom * 100)}%</span><button onClick={() => updateTransform(`${CHECKVAN_CATEGORIES[active].id}-modal`, { ...transformFor(`${CHECKVAN_CATEGORIES[active].id}-modal`), zoom: clampZoom(transformFor(`${CHECKVAN_CATEGORIES[active].id}-modal`).zoom + .25) })}>+</button><button onClick={() => updateTransform(`${CHECKVAN_CATEGORIES[active].id}-modal`, initialTransform)}>{t('Reimposta', 'Reset')}</button></div></div></div>}
  </>
}

export default CheckVanComparisonPage
