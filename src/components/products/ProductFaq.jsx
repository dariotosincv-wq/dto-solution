function ProductFaq({ productName }) {
  return (
    <section className="product-section" aria-labelledby="product-faq">
      <div className="product-section__heading">
        <p className="eyebrow">Supporto</p>
        <h2 id="product-faq">Domande frequenti</h2>
      </div>
      <div className="faq-placeholder">
        <p>FAQ ufficiali di {productName} da fornire.</p>
      </div>
    </section>
  )
}

export default ProductFaq
