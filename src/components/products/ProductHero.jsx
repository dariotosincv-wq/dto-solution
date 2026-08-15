import MediaPlaceholder from '../common/MediaPlaceholder.jsx'

function ProductHero({ product }) {
  if (product.logo) {
    return (
      <header className="product-hero product-hero--branded">
        <p className="eyebrow">Applicazione DTO Solution</p>
        <div className="product-hero__identity">
          <img src={product.logo} alt={product.logoAlt} />
          <div>
            <h1>{product.name}</h1>
            <p>{product.heroDescription}</p>
          </div>
        </div>
        {product.heroHighlights?.length ? (
          <ul className="product-hero__highlights">
            {product.heroHighlights.map((highlight) => <li key={highlight}><span aria-hidden="true">✓</span>{highlight}</li>)}
          </ul>
        ) : null}
      </header>
    )
  }

  return (
    <header className="product-hero">
      <div className="product-hero__content">
        <p className="eyebrow">Applicazione DTO Solution</p>
        <h1>{product.name}</h1>
        <p>Testo descrizione da fornire.</p>
      </div>
      <MediaPlaceholder label={product.logoLabel} compact />
    </header>
  )
}

export default ProductHero
