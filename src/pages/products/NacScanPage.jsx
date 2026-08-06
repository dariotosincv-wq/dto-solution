import ButtonLink from '../../components/common/ButtonLink.jsx'
import MetaDescription from '../../components/common/MetaDescription.jsx'
import { getApplicationBySlug } from '../../data/applications.js'
import { nacScanContent } from '../../data/nacscan.js'

const application = getApplicationBySlug('nacscan')

const features = [
  ['scan', 'Scansione documenti', 'Acquisisci documenti dalla fotocamera e trasformali rapidamente in PDF.'],
  ['signature', 'Firma PDF', 'Disegna, salva e inserisci la tua firma nei documenti in pochi tocchi.'],
  ['edit', 'Modifica PDF', 'Aggiungi testo, firme ed elementi grafici direttamente sulle pagine.'],
  ['text', 'Estrazione testo', 'Estrai il testo digitale presente nei PDF per consultarlo o salvarlo.'],
  ['privacy', 'Protezione dati sensibili', 'Copri visivamente le informazioni che non vuoi mostrare nel documento.'],
  ['share', 'Condivisione documenti', 'Salva ed esporta i PDF utilizzando le funzioni di condivisione Android.'],
]

function FeatureIcon({ type }) {
  const icons = {
    scan: <><path d="M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M7 21H5a2 2 0 0 1-2-2v-2M17 21h2a2 2 0 0 0 2-2v-2" /><path d="M7 12h10" /></>,
    signature: <><path d="M4 17c2.5-4 4-6 5-6 1.5 0-1 6 1 6 1.5 0 2-4 3-4s0 4 2 4c1 0 2-.7 3-2" /><path d="M4 20h16" /></>,
    edit: <><path d="M4 20h4l11-11-4-4L4 16v4Z" /><path d="m13 7 4 4M4 12V4h8" /></>,
    text: <><path d="M5 5h14M12 5v14M8 19h8" /><path d="M4 9V5h16v4" /></>,
    privacy: <><path d="M12 3 5 6v5c0 4.8 3 8.1 7 10 4-1.9 7-5.2 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></>,
    share: <><circle cx="18" cy="5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="19" r="2" /><path d="m8 11 8-5M8 13l8 5" /></>,
  }

  return (
    <span className="nacscan-feature-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {icons[type]}
      </svg>
    </span>
  )
}

function NacScanPage() {
  return (
    <article className="page-section nacscan-page nacscan-landing">
      <MetaDescription content="NACScan consente di scansionare, firmare, modificare, proteggere, salvare e condividere documenti PDF." />

      <div className="container product-layout">
        <header className="product-hero nacscan-hero">
          <div className="product-hero__content">
            <p className="eyebrow">Applicazione DTO Solution</p>
            <h1>{nacScanContent.name}</h1>
            <p>NACScan è un’app Android pensata per gestire documenti PDF in modo semplice e immediato. Permette di scansionare pagine, aggiungere firme e testo, modificare documenti, estrarre contenuti digitali, coprire dati sensibili e condividere il risultato direttamente dal dispositivo.</p>
            <div className="button-group nacscan-hero__actions">
              <a className="button button--primary" href={application.playStoreUrl} target="_blank" rel="noopener noreferrer">Scarica dal Play Store</a>
              <a className="button button--secondary" href="#nacscan-video">Guarda il video</a>
            </div>
          </div>
          <div className="nacscan-logo-panel">
            <img
              className="nacscan-logo"
              src={nacScanContent.logo}
              alt="Logo ufficiale NACScan"
              width="720"
              height="720"
              decoding="async"
              fetchPriority="high"
            />
          </div>
        </header>

        <section className="nacscan-showcase" aria-labelledby="nacscan-showcase-title">
          <div className="product-section__heading">
            <p className="eyebrow">L’applicazione</p>
            <h2 id="nacscan-showcase-title">Tutti gli strumenti essenziali in un’unica app.</h2>
          </div>
          <figure className="nacscan-showcase__image">
            <img
              src="/nacscan/playstore-it-home.webp"
              alt="Presentazione italiana delle funzioni principali di NACScan"
              width="820"
              height="1230"
              loading="lazy"
              decoding="async"
            />
          </figure>
        </section>

        <section className="product-section" aria-labelledby="nacscan-features-title">
          <div className="product-section__heading">
            <p className="eyebrow">Caratteristiche</p>
            <h2 id="nacscan-features-title">Funzionalità principali</h2>
          </div>
          <ul className="nacscan-feature-list nacscan-feature-list--compact">
            {features.map(([type, title, description]) => (
              <li className="content-panel" key={title}>
                <FeatureIcon type={type} />
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="nacscan-video" className="product-section nacscan-video-section" aria-labelledby="nacscan-video-title">
          <div className="product-section__heading">
            <p className="eyebrow">Dimostrazione</p>
            <h2 id="nacscan-video-title">Video dimostrativo</h2>
          </div>
          <video
            className="nacscan-video"
            controls
            playsInline
            preload="metadata"
            poster={nacScanContent.videoPoster}
            width="1080"
            height="2400"
          >
            <source src={nacScanContent.video} type="video/mp4" />
            Il browser non supporta la riproduzione del video.
          </video>
        </section>

        <aside className="nacscan-update-note">
          <p>Nuovi screenshot e approfondimenti saranno aggiunti nelle prossime versioni del sito.</p>
          <ButtonLink to="/applicazioni/nacscan/privacy" variant="text">Privacy Policy di NACScan</ButtonLink>
        </aside>
      </div>
    </article>
  )
}

export default NacScanPage
