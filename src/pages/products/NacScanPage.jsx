import ButtonLink from '../../components/common/ButtonLink.jsx'
import LinkPlaceholder from '../../components/common/LinkPlaceholder.jsx'
import MetaDescription from '../../components/common/MetaDescription.jsx'
import ProductFaq from '../../components/products/ProductFaq.jsx'
import { nacScanContent } from '../../data/nacscan.js'

function NacScanPage() {
  return (
    <article className="page-section nacscan-page">
      <MetaDescription content="NACScan consente di scansionare, firmare, modificare, salvare e condividere documenti PDF." />

      <div className="container product-layout">
        <header className="product-hero nacscan-hero">
          <div className="product-hero__content">
            <p className="eyebrow">Applicazione DTO Solution</p>
            <h1>{nacScanContent.name}</h1>
            <p>{nacScanContent.description}</p>
          </div>
          <div className="nacscan-logo-panel">
            <img
              className="nacscan-logo"
              src={nacScanContent.logo}
              alt="Logo ufficiale NACScan"
              width="720"
              height="720"
              decoding="async"
              fetchPriority="high"
            />
          </div>
        </header>

        <section className="product-section" aria-labelledby="nacscan-video-title">
          <div className="product-section__heading">
            <p className="eyebrow">Dimostrazione</p>
            <h2 id="nacscan-video-title">Video dimostrativo</h2>
          </div>
          <video
            className="nacscan-video"
            controls
            playsInline
            preload="metadata"
            poster={nacScanContent.videoPoster}
            width="1080"
            height="2400"
          >
            <source src={nacScanContent.video} type="video/mp4" />
            Il browser non supporta la riproduzione del video.
          </video>
        </section>

        <section className="product-section" aria-labelledby="nacscan-gallery-title">
          <div className="product-section__heading">
            <p className="eyebrow">L’applicazione</p>
            <h2 id="nacscan-gallery-title">Screenshot</h2>
          </div>
          <div className="nacscan-gallery">
            {nacScanContent.screenshots.map((screenshot) => (
              <figure
                className={`nacscan-gallery__item nacscan-gallery__item--${screenshot.format}`}
                key={screenshot.src}
              >
                <img
                  src={screenshot.src}
                  alt={screenshot.alt}
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            ))}
          </div>
        </section>

        <section className="product-section" aria-labelledby="nacscan-features-title">
          <div className="product-section__heading">
            <p className="eyebrow">Caratteristiche</p>
            <h2 id="nacscan-features-title">Funzionalità</h2>
          </div>
          <ul className="nacscan-feature-list">
            {nacScanContent.features.map((feature) => (
              <li className="content-panel" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="content-panel product-content" aria-labelledby="nacscan-technical-title">
          <p className="eyebrow">Dettagli</p>
          <h2 id="nacscan-technical-title">Informazioni tecniche</h2>
          <p className="placeholder-copy">Informazioni tecniche da fornire.</p>
        </section>

        <ProductFaq productName={nacScanContent.name} />

        <section className="product-download" aria-labelledby="nacscan-download-title">
          <div>
            <p className="eyebrow">Disponibilità</p>
            <h2 id="nacscan-download-title">Download e Privacy Policy</h2>
            <p>Link Google Play da inserire.</p>
          </div>
          <div className="button-group">
            <LinkPlaceholder>Link Google Play da inserire</LinkPlaceholder>
            <ButtonLink to="/applicazioni/nacscan/privacy" variant="secondary">
              Privacy Policy di NACScan
            </ButtonLink>
          </div>
        </section>
      </div>
    </article>
  )
}

export default NacScanPage
