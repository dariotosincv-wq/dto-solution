import MediaPlaceholder from '../common/MediaPlaceholder.jsx'

function ProductMedia({ product }) {
  return (
    <section className="product-section" aria-labelledby={`${product.slug}-media`}>
      <div className="product-section__heading">
        <p className="eyebrow">Anteprima</p>
        <h2 id={`${product.slug}-media`}>Video e screenshot</h2>
      </div>

      <MediaPlaceholder label={product.videoLabel} />

      <div className="screenshot-grid">
        {product.screenshots.map((screenshot) => (
          <MediaPlaceholder key={screenshot} label={screenshot} compact />
        ))}
      </div>
    </section>
  )
}

export default ProductMedia
