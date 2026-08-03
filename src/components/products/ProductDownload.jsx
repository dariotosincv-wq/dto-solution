import ButtonLink from '../common/ButtonLink.jsx'
import LinkPlaceholder from '../common/LinkPlaceholder.jsx'

function ProductDownload({ product }) {
  return (
    <section className="product-download" aria-labelledby="product-download-title">
      <div>
        <p className="eyebrow">Disponibilità</p>
        <h2 id="product-download-title">Download e Privacy Policy</h2>
        <p>Le informazioni ufficiali sulla disponibilità di {product.name} sono da fornire.</p>
      </div>
      <div className="button-group">
        <LinkPlaceholder>Link Google Play da inserire</LinkPlaceholder>
        <ButtonLink to={`/applicazioni/${product.slug}/privacy`} variant="secondary">
          Privacy Policy di {product.name}
        </ButtonLink>
      </div>
    </section>
  )
}

export default ProductDownload
