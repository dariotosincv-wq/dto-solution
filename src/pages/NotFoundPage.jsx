import ButtonLink from '../components/common/ButtonLink.jsx'

function NotFoundPage() {
  return (
    <section className="page-section not-found">
      <div className="container narrow-layout">
        <p className="eyebrow">Errore 404</p>
        <h1>Pagina non trovata</h1>
        <p>La pagina richiesta non è disponibile.</p>
        <ButtonLink to="/">Torna alla homepage</ButtonLink>
      </div>
    </section>
  )
}

export default NotFoundPage
