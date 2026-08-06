import { applications } from '../../data/applications.js'
import { software } from '../../data/software.js'
import ApplicationCard from './ApplicationCard.jsx'
import SoftwareCard from './SoftwareCard.jsx'

function ApplicationGrid() {
  return (
    <div className="application-grid">
      {applications.filter((application) => application.showInGrid !== false).map((application) => (
        <ApplicationCard key={application.slug} application={application} />
      ))}
      {software.map((product) => (
        <SoftwareCard key={product.slug} product={product} />
      ))}
    </div>
  )
}

export default ApplicationGrid
