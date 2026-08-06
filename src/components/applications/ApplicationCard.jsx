import ButtonLink from '../common/ButtonLink.jsx'

function GooglePlayMark() {
  return (
    <svg className="availability-badge__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#00a0ff" d="M3 2.4v19.2L13.7 12 3 2.4Z" />
      <path fill="#00d26a" d="m3 2.4 13.1 7.4-2.4 2.2L3 2.4Z" />
      <path fill="#ffca28" d="m13.7 12 2.4-2.2 3.7 2.1c.7.4.7 1.4 0 1.8l-3.7 2.1-2.4-3.8Z" />
      <path fill="#ff3d45" d="M3 21.6 13.7 12l2.4 3.8L3 21.6Z" />
    </svg>
  )
}

function ApplicationCard({ application, description, highlightAvailability }) {
  const isAvailableOnGooglePlay = highlightAvailability && application.status === 'Disponibile su Google Play'

  return (
    <article className="application-card">
      <div className="application-card__media">
        <img src={application.image} alt={application.imageAlt} loading="lazy" decoding="async" />
      </div>
      <div className="application-card__body">
        {application.badge && <p className="status-badge">{application.badge}</p>}
        <h3>{application.name}</h3>
        {description && <p>{description}</p>}
        {isAvailableOnGooglePlay ? (
          <p className="availability-badge">
            <GooglePlayMark />
            <span>Disponibile ora su Google Play</span>
          </p>
        ) : (
          <p>{application.status}</p>
        )}
        <div className="button-group application-card__actions">
          <ButtonLink to={`/applicazioni/${application.slug}`} variant="secondary">
            {application.detailLabel}
          </ButtonLink>
          {application.playStoreUrl ? (
            <a className="button button--primary" href={application.playStoreUrl} target="_blank" rel="noopener noreferrer">
              Scarica dal Play Store
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default ApplicationCard
