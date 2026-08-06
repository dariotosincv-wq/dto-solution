import ButtonLink from '../common/ButtonLink.jsx'

function SoftwareCard({ product }) {
  return (
    <article className="application-card">
      <div className="application-card__media">
        <img src={product.image} alt={product.imageAlt} loading="lazy" decoding="async" />
      </div>
      <div className="application-card__body">
        <p className="eyebrow">Software</p>
        <p className="status-badge">{product.badge}</p>
        <h3>{product.name}</h3>
        <p>{product.subtitle}</p>
        <p>{product.status}</p>
        <div className="button-group application-card__actions">
          <ButtonLink to={`/software/${product.slug}`} variant="secondary">
            Scopri Observa
          </ButtonLink>
          <a
            className="button button--primary"
            href={product.officialWebsite}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visita il sito ufficiale
          </a>
        </div>
      </div>
    </article>
  )
}

export default SoftwareCard
