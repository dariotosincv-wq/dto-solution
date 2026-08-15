import { useEffect, useState } from 'react'
import MediaPlaceholder from '../common/MediaPlaceholder.jsx'

function ProductMedia({ product }) {
  const realScreenshots = product.screenshots?.filter((screenshot) => typeof screenshot === 'object') ?? []
  const [active, setActive] = useState(null)

  useEffect(() => {
    if (active === null) return undefined
    const closeOnEscape = (event) => { if (event.key === 'Escape') setActive(null) }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [active])

  return (
    <section className="product-section" aria-labelledby={`${product.slug}-media`}>
      <div className="product-section__heading">
        <p className="eyebrow">Anteprima</p>
        <h2 id={`${product.slug}-media`}>{product.hideVideo ? 'Screenshot' : 'Video e screenshot'}</h2>
      </div>

      {!product.hideVideo ? <MediaPlaceholder label={product.videoLabel} /> : null}

      <div className={realScreenshots.length ? 'screenshot-gallery' : 'screenshot-grid'}>
        {product.screenshots.map((screenshot) => (
          typeof screenshot === 'object' ? (
            <figure className="screenshot-gallery__item" key={screenshot.src}>
              <button type="button" onClick={() => setActive(realScreenshots.findIndex((item) => item.src === screenshot.src))} aria-label={`Ingrandisci: ${screenshot.label}`}>
                <img src={screenshot.src} alt={screenshot.alt} loading="lazy" />
              </button>
              <figcaption>{screenshot.label}</figcaption>
            </figure>
          ) : <MediaPlaceholder key={screenshot} label={screenshot} compact />
        ))}
      </div>

      {active !== null && realScreenshots[active] ? (
        <div className="screenshot-lightbox" role="dialog" aria-modal="true" aria-label={realScreenshots[active].label} onClick={() => setActive(null)}>
          <div className="screenshot-lightbox__panel" onClick={(event) => event.stopPropagation()}>
            <button className="screenshot-lightbox__close" type="button" aria-label="Chiudi" onClick={() => setActive(null)}>×</button>
            <button type="button" aria-label="Immagine precedente" disabled={active === 0} onClick={() => setActive((index) => index - 1)}>←</button>
            <figure>
              <img src={realScreenshots[active].src} alt={realScreenshots[active].alt} />
              <figcaption>{realScreenshots[active].label}</figcaption>
            </figure>
            <button type="button" aria-label="Immagine successiva" disabled={active === realScreenshots.length - 1} onClick={() => setActive((index) => index + 1)}>→</button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default ProductMedia
