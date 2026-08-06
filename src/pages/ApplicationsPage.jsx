import ApplicationGrid from '../components/applications/ApplicationGrid.jsx'
import PageIntro from '../components/common/PageIntro.jsx'

const descriptions = {
  nacscan: 'Scansiona, firma e modifica documenti PDF in modo semplice e veloce.',
  'shopping-voice': 'Crea e gestisci la lista della spesa con la voce.',
  'driver-utility': "L'assistente quotidiano pensato per i driver professionisti.",
  'observa-poker': 'Software di Poker Intelligence per analisi avanzate delle sessioni.',
}

function ApplicationsPage() {
  return (
    <section className="page-section">
      <div className="container">
        <PageIntro eyebrow="Applicazioni e software" title="Le soluzioni DTO Solution">
          <p>Applicazioni e software sviluppati per risolvere esigenze concrete nel lavoro e nelle attività quotidiane.</p>
        </PageIntro>
        <ApplicationGrid descriptions={descriptions} highlightAvailability />
      </div>
    </section>
  )
}

export default ApplicationsPage
