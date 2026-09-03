import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MetaDescription from '../common/MetaDescription.jsx'
import { useI18n } from '../../i18n/useI18n.js'
import { documentLineText, normalizeDocumentText, searchDocumentPages } from '../../lib/documentSearch.js'

function HighlightedLine({ line, query }) {
  const text = documentLineText(line)
  if (!query.trim()) return text
  const target = normalizeDocumentText(query.trim())
  const source = normalizeDocumentText(text)
  const parts = []
  let cursor = 0
  let match = source.indexOf(target)
  while (match >= 0) {
    parts.push(text.slice(cursor, match), <mark key={`${match}-${cursor}`}>{text.slice(match, match + target.length)}</mark>)
    cursor = match + target.length
    match = source.indexOf(target, cursor)
  }
  parts.push(text.slice(cursor))
  return parts
}

function DocumentPublicationPage({ document }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const results = useMemo(() => {
    return searchDocumentPages(document.pages, query)
  }, [document.pages, query])

  const anchorsByPage = useMemo(() => document.index.reduce((map, item) => {
    map.set(item.page, [...(map.get(item.page) ?? []), item])
    return map
  }, new Map()), [document.index])

  return (
    <article className="page-section contract-publication" id="document-top">
      <MetaDescription title={document.metaTitle} content={document.description} canonical={document.canonical} openGraphUrl={document.canonical} />
      <div className="container contract-publication__container">
        <header className="page-intro contract-publication__hero">
          <p className="eyebrow">{t('Area Driver · Documento di riferimento', 'Driver Area · Reference document')}</p>
          <h1>{document.title}</h1>
          <p className="contract-publication__lead">{document.subtitle}</p>
          <dl className="contract-publication__facts">{document.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <p className="driver-area__notice">{document.notice}</p>
          {document.signatureNotice && <p className="driver-area__notice">{document.signatureNotice}</p>}
          <Link className="button button--secondary" to="/area-driver">{t("Torna all’Area Driver", 'Back to the Driver Area')}</Link>
        </header>

        <div className="contract-publication__layout">
          <aside className="contract-publication__tools" aria-label={t('Indice e ricerca', 'Contents and search')}>
            <form className="contract-search" role="search" onSubmit={(event) => event.preventDefault()}>
              <label htmlFor={`${document.slug}-search`}>{document.searchLabel}</label>
              <input id={`${document.slug}-search`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
              <p aria-live="polite">{query.trim() ? t(`${results.length} pagine pertinenti`, `${results.length} matching pages`) : t('Inserisci una parola o espressione.', 'Enter a word or phrase.')}</p>
              {results.length > 0 && <ol className="contract-search__results">{results.map((page) => <li key={page.page}><a href={`#${document.slug}-page-${page.page}`}>{t(`Pagina ${page.page}`, `Page ${page.page}`)}</a></li>)}</ol>}
            </form>
            <details className="contract-index" open>
              <summary>{t('Indice del documento', 'Document contents')}</summary>
              <ol>{document.index.map((item) => <li key={item.id}><a href={`#${item.id}`}>{item.title}</a></li>)}</ol>
            </details>
          </aside>

          <main className="contract-text" aria-label={t('Testo del documento', 'Document text')}>
            {document.pages.map((page) => <section className="contract-page" id={`${document.slug}-page-${page.page}`} key={page.page}>
              {(anchorsByPage.get(page.page) ?? []).map((item) => <span className="contract-anchor" id={item.id} key={item.id} />)}
              <p className="contract-page__number">{t(`Pagina ${page.page} del documento originale`, `Original document page ${page.page}`)}</p>
              {page.lines.map((line, index) => typeof line === 'object'
                ? <h2 id={line.id} key={`${page.page}-${index}`}><HighlightedLine line={line} query={query} /></h2>
                : <p key={`${page.page}-${index}`}><HighlightedLine line={line} query={query} /></p>)}
            </section>)}
            <a className="contract-back-to-top" href="#document-top">{t('Torna su', 'Back to top')}</a>
          </main>
        </div>
      </div>
    </article>
  )
}

export default DocumentPublicationPage
