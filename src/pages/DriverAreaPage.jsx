import { Link } from 'react-router-dom'
import MetaDescription from '../components/common/MetaDescription.jsx'
import { useI18n } from '../i18n/useI18n.js'

const documents = [
  ['CCNL Logistica, Trasporto Merci e Spedizione', 'Logistics, Freight Transport and Shipping National Agreement', 'Consulta il contratto collettivo nazionale di riferimento del settore.', 'Consult the national collective agreement for the sector.', 'Consulta il CCNL', 'View the agreement', '/area-driver/ccnl-logistica-trasporto-merci-spedizione'],
  ['Contrattazione di secondo livello', 'Second-level collective bargaining', 'Accordo nazionale Assoespressi 2025 per la distribuzione ultimo miglio.', '2025 Assoespressi national agreement for last-mile distribution.', 'Consulta l’accordo Assoespressi 2025', 'View the 2025 Assoespressi agreement', '/area-driver/accordo-asso-espressi-ultimo-miglio-2025'],
  ['Normativa di riferimento', 'Reference legislation', 'Leggi e disposizioni utili per gli aspetti non disciplinati direttamente dal contratto collettivo.', 'Relevant laws and provisions for matters not directly governed by the collective agreement.', 'Consulta la normativa', 'View legislation', null],
]

const futureTools = [
  ['Guide e spiegazioni', 'Guides and explanations', 'Contenuti pratici per orientarsi nelle attività quotidiane.', 'Practical content for navigating everyday work.'],
  ['Turni di lavoro', 'Work shifts', 'Uno spazio personale dedicato all’organizzazione dei turni.', 'A personal space dedicated to shift organization.'],
  ['Busta paga', 'Payslip', 'Strumenti informativi per organizzare e consultare i documenti di lavoro.', 'Informational tools for organizing and viewing work documents.'],
  ['Assistente CCNL', 'National agreement assistant', 'Uno strumento per orientarsi tra contratto collettivo, accordi e normativa di riferimento.', 'A tool for navigating the collective agreement, supplementary agreements and reference legislation.'],
]

function DriverAreaPage() {
  const { t } = useI18n()

  return (
    <article className="page-section driver-area">
      <MetaDescription content={t('Area Driver DTO Solution: contratti, informazioni e futuri strumenti pratici per driver e lavoratori della logistica.', 'DTO Solution Driver Area: contracts, information and future practical tools for drivers and logistics workers.')} />
      <div className="container">
        <header className="page-intro driver-area__hero">
          <p className="eyebrow">DTO Solution</p>
          <h1>{t('Area Driver', 'Driver Area')}</h1>
          <p className="driver-area__lead">{t('Contratti, informazioni e strumenti utili per il lavoro quotidiano.', 'Contracts, information and useful tools for everyday work.')}</p>
          <p>{t('Una sezione pubblica pensata per raccogliere documenti contrattuali, guide e strumenti pratici dedicati a chi lavora nella logistica e nel trasporto.', 'A public section designed to collect contractual documents, guides and practical tools for people working in logistics and transport.')}</p>
          <p className="driver-area__notice">{t('I contenuti hanno finalità esclusivamente informativa e non costituiscono consulenza legale o sindacale.', 'Content is provided for information only and does not constitute legal or trade union advice.')}</p>
        </header>

        <section className="driver-area__section" aria-labelledby="driver-documents-title">
          <div className="section-heading"><p className="eyebrow">{t('Documentazione', 'Documentation')}</p><h2 id="driver-documents-title">{t('Contratti e documenti', 'Contracts and documents')}</h2><p className="section-heading__copy">{t('Documenti di riferimento pubblicati in formato HTML per una consultazione accessibile e ricercabile.', 'Reference documents published as accessible, searchable HTML pages.')}</p></div>
          <div className="driver-area__grid">
            {documents.map(([itTitle, enTitle, itDescription, enDescription, itCta, enCta, to]) => <article className="driver-area-card" key={itTitle}><h3>{t(itTitle, enTitle)}</h3><p>{t(itDescription, enDescription)}</p>{to ? <Link className="button button--secondary" to={to}>{t(itCta, enCta)}</Link> : <button type="button" disabled aria-describedby="driver-documents-status">{t(itCta, enCta)}</button>}</article>)}
          </div>
          <p className="driver-area__status" id="driver-documents-status">{t('La normativa di riferimento sarà collegata dopo la verifica delle fonti.', 'Reference legislation will be linked after its sources have been verified.')}</p>
        </section>

        <section className="driver-area__section driver-area__section--future" aria-labelledby="driver-tools-title">
          <div className="section-heading"><p className="eyebrow">{t('In evoluzione', 'In development')}</p><h2 id="driver-tools-title">{t('Strumenti per il lavoro quotidiano', 'Tools for everyday work')}</h2><p className="section-heading__copy">{t('Questi spazi sono predisposti per sviluppi futuri e non contengono ancora funzionalità operative.', 'These areas are prepared for future developments and do not yet contain operational features.')}</p></div>
          <div className="driver-area__grid driver-area__grid--future">
            {futureTools.map(([itTitle, enTitle, itDescription, enDescription]) => <article className="driver-area-card driver-area-card--future" key={itTitle}><span className="status-badge">{t('Prossimamente', 'Coming soon')}</span><h3>{t(itTitle, enTitle)}</h3><p>{t(itDescription, enDescription)}</p></article>)}
          </div>
        </section>
      </div>
    </article>
  )
}

export default DriverAreaPage
