import ApplicationGrid from '../components/applications/ApplicationGrid.jsx'
import PageIntro from '../components/common/PageIntro.jsx'

function ApplicationsPage() {
  return (
    <section className="page-section">
      <div className="container">
        <PageIntro eyebrow="Applicazioni e software" title="Le soluzioni DTO Solution">
          <p>Applicazioni e software sviluppati per risolvere esigenze concrete nel lavoro e nelle attività quotidiane.</p>
        </PageIntro>
        <ApplicationGrid />
      </div>
    </section>
  )
}

export default ApplicationsPage
