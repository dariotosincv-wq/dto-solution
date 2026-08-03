import MediaPlaceholder from '../common/MediaPlaceholder.jsx'

function ProductHero({ product }) {
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
