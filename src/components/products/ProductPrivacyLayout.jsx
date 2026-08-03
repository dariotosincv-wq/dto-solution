import ButtonLink from '../common/ButtonLink.jsx'

function ProductPrivacyLayout({ product }) {
  return (
    <article className="page-section">
      <div className="container narrow-layout">
        <header className="page-intro">
          <p className="eyebrow">Informativa dedicata</p>
          <h1>Privacy Policy di {product.name}</h1>
          <div className="page-intro__copy">
            <p>Informativa ufficiale pubblicata da DTO Solution.</p>
          </div>
        </header>

        <section className="content-panel prose" aria-labelledby="privacy-content-title">
          <h2 id="privacy-content-title">Contenuto della Privacy Policy</h2>
          <p>Sviluppatore, titolare del trattamento e proprietario del software: DTO Solution.</p>
          <p>
            Email:{' '}
            <a href="mailto:dtosolution@gmail.com">dtosolution@gmail.com</a>
          </p>
          <p>
            Sito ufficiale:{' '}
            <a href="https://dto-solution.it">https://dto-solution.it</a>
          </p>
        </section>

        <ButtonLink to={`/applicazioni/${product.slug}`} variant="secondary">
          Torna a {product.name}
        </ButtonLink>
      </div>
    </article>
  )
}

export default ProductPrivacyLayout
