import DocumentPublicationPage from '../components/driver/DocumentPublicationPage.jsx'
import { agreementIndex, agreementPages } from '../data/verifiedAgreement.js'

const document = {
  slug: 'accordo',
  title: 'Accordo Assoespressi – Ultimo miglio Amazon',
  subtitle: 'Accordo nazionale di secondo livello del 26 maggio 2025 per il personale interessato delle aziende aderenti ad Assoespressi che operano nella distribuzione ultimo miglio per Amazon Italia Transport S.r.l. È una disciplina specifica e non il CCNL generale.',
  metaTitle: 'Accordo Assoespressi 2025 – Ultimo miglio Amazon | Area Driver DTO Solution',
  description: 'Consulta l’accordo Assoespressi del 26 maggio 2025 per il personale interessato nell’ultimo miglio Amazon, distinto dal CCNL generale.',
  canonical: 'https://www.dtosolution.it/area-driver/accordo-asso-espressi-ultimo-miglio-2025',
  searchLabel: 'Cerca nell’accordo',
  facts: [['Documento', 'Accordo nazionale di secondo livello'], ['Data', '26 maggio 2025'], ['Validità indicata', '1° maggio 2025 – 30 aprile 2028'], ['Fonte', 'Documento sottoscritto fornito per la pubblicazione nell’Area Driver']],
  notice: 'Il testo è pubblicato a fini informativi e di consultazione. Per interpretazioni relative a casi individuali è opportuno rivolgersi alle organizzazioni sindacali o a un professionista qualificato.',
  signatureNotice: 'Il testo è stato trascritto dal documento sottoscritto. Le firme autografe presenti nell’originale non vengono riprodotte nella versione pubblicata online.',
  pages: agreementPages,
  index: agreementIndex,
}

export default function AccordoAssoespressiPage() {
  return <DocumentPublicationPage document={document} />
}
