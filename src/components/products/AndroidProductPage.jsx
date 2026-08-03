import ProductContentSection from './ProductContentSection.jsx'
import ProductDownload from './ProductDownload.jsx'
import ProductFaq from './ProductFaq.jsx'
import ProductHero from './ProductHero.jsx'
import ProductMedia from './ProductMedia.jsx'

function AndroidProductPage({ product }) {
  return (
    <article className="page-section product-page">
      <div className="container product-layout">
        <ProductHero product={product} />
        <ProductMedia product={product} />

        <div className="product-information-grid">
          <ProductContentSection
            id={`${product.slug}-description`}
            eyebrow="Presentazione"
            title="Descrizione"
            placeholder="Testo descrizione da fornire."
          />
          <ProductContentSection
            id={`${product.slug}-features`}
            eyebrow="Caratteristiche"
            title="Funzionalità"
            placeholder="Elenco delle funzionalità da fornire."
          />
          <ProductContentSection
            id={`${product.slug}-technical-information`}
            eyebrow="Dettagli"
            title="Informazioni tecniche"
            placeholder="Informazioni tecniche da fornire."
          />
        </div>

        <ProductFaq productName={product.name} />
        <ProductDownload product={product} />
      </div>
    </article>
  )
}

export default AndroidProductPage
