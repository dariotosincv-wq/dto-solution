import { applications } from '../../data/applications.js'
import ApplicationCard from './ApplicationCard.jsx'

function ApplicationGrid() {
  return (
    <div className="application-grid">
      {applications.map((application) => (
        <ApplicationCard key={application.slug} application={application} />
      ))}
    </div>
  )
}

export default ApplicationGrid
