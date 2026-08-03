import PageIntro from '../components/common/PageIntro.jsx'

function ContactPage() {
  return (
    <section className="page-section">
      <div className="container narrow-layout">
        <PageIntro eyebrow="DTO Solution" title="Contatti">
          <p>Contatta DTO Solution per informazioni e assistenza.</p>
        </PageIntro>
        <div className="content-panel prose">
          <h2>Recapiti</h2>
          <p>
            Email:{' '}
            <a href="mailto:dtosolution@gmail.com">dtosolution@gmail.com</a>
          </p>
          <p>
            Sito:{' '}
            <a href="https://dto-solution.it">https://dto-solution.it</a>
          </p>
        </div>
      </div>
    </section>
  )
}

export default ContactPage
