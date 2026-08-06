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
            <img src="/products/shopping-voice.png" alt="Banner promozionale di Shopping Voice" decoding="async" fetchPriority="high" />
          </div>
        </header>

        <section className="product-download" aria-labelledby="shopping-voice-download-title">
          <div>
            <p className="eyebrow">Disponibilità</p>
            <h2 id="shopping-voice-download-title">Google Play</h2>
          </div>
          <a
            className="button button--primary"
            href="https://play.google.com/store/apps/details?id=com.dariotosin.spesasmart"
            target="_blank"
            rel="noopener noreferrer"
          >
            Scarica dal Play Store
          </a>
        </section>
      </div>
    </article>
  )
}

export default ShoppingVoicePage
