function ProductFaq({ items, productName }) {
  return (
    <section className="product-section" aria-labelledby="product-faq">
      <div className="product-section__heading">
        <p className="eyebrow">Supporto</p>
        <h2 id="product-faq">Domande frequenti</h2>
      </div>
      {items?.length ? (
        <div className="product-faq-list">
          {items.map(({ answer, question }) => (
            <details className="product-faq-item" key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      ) : (
        <div className="faq-placeholder">
          <p>FAQ ufficiali di {productName} da fornire.</p>
        </div>
      )}
    </section>
  )
}

export default ProductFaq
