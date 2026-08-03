import LinkPlaceholder from '../../components/common/LinkPlaceholder.jsx'
import MediaPlaceholder from '../../components/common/MediaPlaceholder.jsx'
import { software } from '../../data/software.js'

const product = software[0]

function ObservaPokerPage() {
  return (
    <article className="page-section software-page">
      <div className="container product-layout">
        <header className="product-hero">
          <div className="product-hero__content">
            <p className="eyebrow">Software — progetto separato</p>
            <h1>{product.name}</h1>
            <p>Observa Poker è un progetto separato dalle applicazioni DTO Solution.</p>
          </div>
          <MediaPlaceholder label={product.logoLabel} compact />
        </header>

        <section className="content-panel product-content" aria-labelledby="observa-description">
          <p className="eyebrow">Presentazione</p>
          <h2 id="observa-description">Descrizione</h2>
          <p className="placeholder-copy">Testo descrizione da fornire.</p>
        </section>

        <MediaPlaceholder label={product.screenshotLabel} />

        <section className="product-download" aria-labelledby="observa-website">
          <div>
            <p className="eyebrow">Sito ufficiale</p>
            <h2 id="observa-website">Observa Poker</h2>
            <p>Informazioni introduttive da fornire.</p>
          </div>
          <LinkPlaceholder>Link al sito ufficiale da inserire</LinkPlaceholder>
        </section>
      </div>
    </article>
  )
}

export default ObservaPokerPage
