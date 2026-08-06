import ButtonLink from '../common/ButtonLink.jsx'
import LinkPlaceholder from '../common/LinkPlaceholder.jsx'

function ApplicationCard({ application }) {
  return (
    <article className="application-card">
      <div className="application-card__media">
        <img src={application.image} alt={application.imageAlt} loading="lazy" decoding="async" />
      </div>
      <div className="application-card__body">
        {application.badge && <p className="status-badge">{application.badge}</p>}
        <h3>{application.name}</h3>
        <p>{application.status}</p>
        <div className="button-group application-card__actions">
          <ButtonLink to={`/applicazioni/${application.slug}`} variant="secondary">
            {application.detailLabel}
          </ButtonLink>
          {application.playStoreUrl ? (
            <a className="button button--primary" href={application.playStoreUrl} target="_blank" rel="noopener noreferrer">
              Scarica dal Play Store
            </a>
          ) : application.slug === 'shopping-voice' ? (
            <LinkPlaceholder>Link Play Store da inserire</LinkPlaceholder>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default ApplicationCard
