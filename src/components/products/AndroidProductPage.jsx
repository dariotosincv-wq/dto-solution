import ProductContentSection from './ProductContentSection.jsx'
import ProductDownload from './ProductDownload.jsx'
import ProductFaq from './ProductFaq.jsx'
import ProductHero from './ProductHero.jsx'
import ProductMedia from './ProductMedia.jsx'

function AndroidProductPage({ children, description, faqItems, features, product, technicalInformation }) {
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
            className={description ? 'product-content--wide' : ''}
          >{description}</ProductContentSection>
          <ProductContentSection
            id={`${product.slug}-features`}
            eyebrow="Caratteristiche"
            title="Funzionalità"
            placeholder="Elenco delle funzionalità da fornire."
            className={features ? 'product-content--wide' : ''}
          >{features}</ProductContentSection>
          <ProductContentSection
            id={`${product.slug}-technical-information`}
            eyebrow="Dettagli"
            title="Informazioni tecniche"
            placeholder="Informazioni tecniche da fornire."
            className={technicalInformation ? 'product-content--wide' : ''}
          >{technicalInformation}</ProductContentSection>
        </div>

        <ProductFaq items={faqItems} productName={product.name} />
        {children}
        <ProductDownload product={product} />
      </div>
    </article>
  )
}

export default AndroidProductPage
