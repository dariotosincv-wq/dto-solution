import { Link } from 'react-router-dom'
import { CalendarDays, FileText, Download, Settings2, BookOpen, Scale, ShieldCheck, Check, Clock3, MessageCircle } from 'lucide-react'
import MetaDescription from '../components/common/MetaDescription.jsx'
import DriverDashboardIllustration from '../components/driver/DriverDashboardIllustration.jsx'
import { useI18n } from '../i18n/useI18n.js'
import './driver-dashboard.css'

const tools = [
  { icon: CalendarDays, tone: 'blue', title: ['Turni Driver', 'Driver Shifts'], text: ['Registra giornate lavorate, ferie, malattia, riposi e note. Tieni sempre sotto controllo il tuo diario lavorativo.', 'Record workdays, holidays, sickness, rest and notes. Keep track of your working diary.'], cta: ['Apri Turni', 'Open Shifts'], to: '/area-driver/turni' },
  { icon: FileText, tone: 'green', title: ['Busta Paga Driver', 'Driver Payroll'], text: ['Importa il cedolino, controlla le voci, confronta i mesi e conserva lo storico dei tuoi dati retributivi.', 'Import payslips, review entries, compare months and keep your pay history.'], cta: ['Apri Busta Paga', 'Open Payroll'], to: '/area-driver/busta-paga' },
  { icon: Download, tone: 'purple', title: ['Backup e ripristino', 'Backup and restore'], text: ['Metti al sicuro turni, storico e impostazioni. Esporta i tuoi dati in un file locale e ripristinali quando vuoi.', 'Keep shifts, history and settings safe. Export your data to a local file and restore it when needed.'], cta: ['Gestisci backup', 'Manage backup'], to: '/area-driver/backup' },
  { icon: Settings2, tone: 'orange', title: ['Profilo contrattuale', 'Contract profile'], text: ['Imposta i tuoi parametri contrattuali, ore settimanali, giornate previste e altre informazioni utilizzate nei calcoli.', 'Set your contract details, weekly hours, scheduled days and other information used in calculations.'], cta: ['Configura', 'Configure'], to: '/area-driver/contratto' },
]
const documents = [
  { icon: BookOpen, title: ['CCNL Logistica', 'Logistics collective agreement'], text: ['Il contratto nazionale del settore trasporto merci e logistica, con indice completo e consultazione per argomenti.', 'The national freight transport and logistics agreement, with a full index and browsing by topic.'], cta: ['Consulta il CCNL', 'Read the agreement'], to: '/area-driver/ccnl-logistica-trasporto-merci-spedizione' },
  { icon: FileText, title: ['Accordo Assoespressi – Ultimo miglio Amazon', 'Accordo Assoespressi – Ultimo miglio Amazon'], text: ['La contrattazione specifica per il personale interessato dall’accordo dell’ultimo miglio Amazon.', 'The specific agreement for staff covered by the Amazon last-mile agreement.'], cta: ['Leggi l’accordo', 'Read the agreement'], to: '/area-driver/accordo-asso-espressi-ultimo-miglio-2025' },
  { icon: Scale, title: ['Normativa di riferimento', 'Reference legislation'], text: ['Leggi italiane su orario di lavoro, sicurezza, mansioni, Statuto dei lavoratori e altre disposizioni utili per il driver.', 'Italian laws on working time, safety, duties, workers’ rights and other provisions relevant to drivers.'], cta: ['Vai alla normativa', 'View legislation'], to: '/area-driver/normativa' },
]

export default function DriverAreaPage() {
  const { t } = useI18n()
  return <article className="driver-dashboard">
    <MetaDescription content={t('Area Driver DTO Solution: turni, buste paga, contratti e normativa. Strumenti personali con elaborazione locale nel browser.', 'DTO Solution Driver Area: shifts, payslips, contracts and legislation. Personal tools processed locally in your browser.')} />
    <div className="container">
      <header className="driver-dashboard__hero">
        <div className="driver-dashboard__intro">
          <p className="driver-dashboard__eyebrow">{t('LAVORO. DIRITTI. STRUMENTI. SEMPRE CON TE.', 'WORK. RIGHTS. TOOLS. ALWAYS WITH YOU.')}</p>
          <h1>{t('AREA', 'YOUR')} <span>DRIVER</span></h1>
          <p className="driver-dashboard__subtitle">{t('Tutto quello che serve al driver, in un unico posto.', 'Everything a driver needs, all in one place.')}</p>
          <p className="driver-dashboard__description">{t('Turni, buste paga, contratti e normativa per tenere sotto controllo il proprio lavoro, in modo semplice e sicuro.', 'Shifts, payslips, contracts and legislation to keep track of your work, simply and securely.')}</p>
          <ul className="driver-dashboard__benefits">{[[Check, 'Semplice da usare', 'Easy to use'], [ShieldCheck, 'I tuoi dati restano tuoi', 'Your data stays yours'], [Clock3, 'Sempre a disposizione', 'Always available']].map(([Icon, it, en]) => <li key={it}><Icon size={17} aria-hidden="true" />{t(it, en)}</li>)}</ul>
        </div>
        <DriverDashboardIllustration />
      </header>
      <section className="driver-dashboard__section" aria-labelledby="driver-tools-title">
        <div className="driver-dashboard__section-heading"><p className="driver-dashboard__eyebrow">{t('IL TUO SPAZIO DI LAVORO', 'YOUR WORKSPACE')}</p><h2 id="driver-tools-title">{t('I tuoi strumenti', 'Your tools')}</h2><p>{t('Strumenti pratici per organizzare il lavoro e tenere sotto controllo i tuoi dati.', 'Practical tools to organise your work and keep track of your data.')}</p></div>
        <div className="driver-dashboard__tools">{tools.map(({ icon: Icon, tone, title, text, cta, to }) => <article className={`driver-dashboard__tool driver-dashboard__tool--${tone}`} key={to}><span className="driver-dashboard__icon"><Icon size={30} strokeWidth={1.7} aria-hidden="true" /></span><h3>{t(...title)}</h3><p>{t(...text)}</p><Link className="driver-dashboard__cta" to={to}>{t(...cta)}</Link></article>)}</div>
      </section>
    </div>
    <section className="driver-dashboard__rights" aria-labelledby="driver-rights-title"><div className="container">
      <div className="driver-dashboard__section-heading"><p className="driver-dashboard__eyebrow">{t('INFORMATI, OGNI GIORNO', 'STAY INFORMED, EVERY DAY')}</p><h2 id="driver-rights-title">{t('Conosci i tuoi diritti', 'Know your rights')}</h2><p>{t('Contratti, accordi e normativa sempre a disposizione, con testi ufficiali e spiegazioni semplici.', 'Contracts, agreements and legislation at hand, with official texts and straightforward explanations.')}</p></div>
      <div className="driver-dashboard__documents">{documents.map(({ icon: Icon, title, text, cta, to }) => <article className="driver-dashboard__document" key={to}><Icon size={27} strokeWidth={1.7} aria-hidden="true" /><h3>{t(...title)}</h3><p>{t(...text)}</p><Link to={to}>{t(...cta)}</Link></article>)}</div>
      <p className="driver-dashboard__legal">{t('Contenuti informativi: non sostituiscono il testo ufficiale né una consulenza legale o sindacale.', 'Informational content: not a substitute for official texts or legal or trade union advice.')}</p>
    </div></section>
    <div className="container">
      <section className="driver-dashboard__privacy" aria-labelledby="driver-privacy-title"><span className="driver-dashboard__shield"><ShieldCheck size={35} strokeWidth={1.6} aria-hidden="true" /></span><div><h2 id="driver-privacy-title">{t('I tuoi dati restano tuoi', 'Your data stays yours')}</h2><p>{t('Turni e buste paga vengono elaborati localmente nel browser. Nessun archivio cloud DTO Solution. Puoi creare un backup locale quando vuoi.', 'Shifts and payslips are processed locally in your browser. No DTO Solution cloud archive. Create a local backup whenever you want.')}</p><ul>{[['Elaborazione locale', 'Local processing'], ['Nessun cloud DTO', 'No DTO cloud'], ['Backup disponibile', 'Backup available']].map(([it, en]) => <li key={it}><Check size={15} aria-hidden="true" />{t(it, en)}</li>)}</ul></div></section>
      <section className="driver-dashboard__help" aria-labelledby="driver-help-title"><MessageCircle size={26} aria-hidden="true" /><div><h2 id="driver-help-title">{t('Hai bisogno di aiuto?', 'Need help?')}</h2><p>{t('Consulta le informazioni disponibili oppure contatta DTO Solution.', 'Browse the available information or contact DTO Solution.')}</p></div><Link className="driver-dashboard__contact" to="/contatti">{t('Contattaci', 'Contact us')}</Link></section>
    </div>
  </article>
}
