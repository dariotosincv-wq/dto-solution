import DocumentPublicationPage from '../components/driver/DocumentPublicationPage.jsx'
import { ccnlIndex, ccnlPages } from '../data/driverDocuments.js'

const document = {
  slug: 'ccnl',
  title: 'CCNL Logistica, Trasporto Merci e Spedizione',
  subtitle: 'Testo del Contratto Collettivo Nazionale di Lavoro del settore Logistica, Trasporto Merci e Spedizione.',
  metaTitle: 'CCNL Logistica, Trasporto Merci e Spedizione | Area Driver DTO Solution',
  description: 'Consulta online il testo del CCNL Logistica, Trasporto Merci e Spedizione rinnovato il 6 dicembre 2024.',
  canonical: 'https://www.dtosolution.it/area-driver/ccnl-logistica-trasporto-merci-spedizione',
  searchLabel: 'Cerca nel CCNL',
  facts: [['Documento', 'Testo unico del CCNL'], ['Rinnovo', '6 dicembre 2024'], ['Verbale del testo unico', '25 settembre 2025'], ['Scadenza indicata', '31 dicembre 2027'], ['Fonte', 'PDF fornito per la pubblicazione nell’Area Driver']],
  notice: 'Il testo è pubblicato a fini informativi e di consultazione. Per interpretazioni relative a casi individuali è opportuno rivolgersi alle organizzazioni sindacali o a un professionista qualificato.',
  pages: ccnlPages,
  index: ccnlIndex.filter((item) => item.page < 135),
}

export default function CcnlLogisticaPage() {
  return <DocumentPublicationPage document={document} />
}
