import ButtonLink from '../common/ButtonLink.jsx'
import MediaPlaceholder from '../common/MediaPlaceholder.jsx'

function ApplicationCard({ application }) {
  return (
    <article className="application-card">
      <MediaPlaceholder label={application.screenshotLabel} compact />
      <div className="application-card__body">
        <h3>{application.name}</h3>
        <p>Descrizione e stato del progetto da confermare.</p>
        <ButtonLink to={`/applicazioni/${application.slug}`} variant="text">
          Apri la scheda
        </ButtonLink>
      </div>
    </article>
  )
}

export default ApplicationCard
