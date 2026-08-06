import LinkPlaceholder from '../../components/common/LinkPlaceholder.jsx'

function ShoppingVoicePage() {
  return (
    <article className="page-section product-page">
      <div className="container product-layout">
        <header className="product-hero">
          <div className="product-hero__content">
            <p className="eyebrow">Applicazione DTO Solution</p>
            <h1>Shopping Voice</h1>
            <p>Disponibile su Google Play</p>
          </div>
          <div className="product-image-panel">
            <img src="/products/shopping-voice.png" alt="Shopping Voice" decoding="async" fetchPriority="high" />
          </div>
        </header>

        <section className="product-download" aria-labelledby="shopping-voice-download-title">
          <div>
            <p className="eyebrow">Disponibilità</p>
            <h2 id="shopping-voice-download-title">Google Play</h2>
          </div>
          <LinkPlaceholder>Link Play Store da inserire</LinkPlaceholder>
        </section>
      </div>
    </article>
  )
}

export default ShoppingVoicePage
