import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Footer from './Footer.jsx'
import Header from './Header.jsx'
import { useI18n } from '../../i18n/useI18n.js'

const pageTitles = {
  it: {
    '/': 'DTO Solution | Sito ufficiale',
    '/applicazioni': 'Applicazioni | DTO Solution',
    '/applicazioni/nacscan': 'NACScan | Scanner ed editor PDF',
    '/applicazioni/nacscan/privacy': 'Privacy Policy NACSCAN | DTO Solution',
    '/applicazioni/shopping-voice': 'Shopping Voice | DTO Solution',
    '/applicazioni/shopping-voice/privacy': 'Privacy Policy Shopping Voice | DTO Solution',
    '/applicazioni/driver-utility': 'Driver Utility | DTO Solution',
    '/applicazioni/driver-utility/privacy': 'Privacy Policy Driver Utility | DTO Solution',
    '/area-driver': 'Area Driver | Contratti e strumenti',
    '/area-driver/turni': 'Turni Driver | DTO Solution',
    '/area-driver/busta-paga': 'Busta Paga Driver | DTO Solution',
    '/area-driver/contratto': 'Profilo contrattuale Driver | DTO Solution',
    '/area-driver/backup': 'Backup e ripristino | Area Driver DTO Solution',
    '/area-driver/normativa': 'Normativa di riferimento | Area Driver DTO Solution',
    '/area-driver/ccnl-logistica-trasporto-merci-spedizione': 'CCNL Logistica, Trasporto Merci e Spedizione | Area Driver DTO Solution',
    '/area-driver/accordo-asso-espressi-ultimo-miglio-2025': 'Accordo Assoespressi 2025 – Ultimo miglio Amazon | Area Driver DTO Solution',
    '/applicazioni/checkvan-pro': 'CheckVan Pro | DTO Solution',
    '/applicazioni/checkvan-pro/privacy': 'Privacy Policy CheckVan Pro | DTO Solution',
    '/software/observa-poker': 'Observa Poker | Software',
    '/chi-siamo': 'Chi siamo | DTO Solution',
    '/privacy': 'Privacy Policy | DTO Solution',
    '/privacy/sito-web': 'Privacy del sito web | DTO Solution',
    '/contatti': 'Contatti | DTO Solution',
  },
  en: {
    '/': 'DTO Solution | Official website',
    '/applicazioni': 'Applications | DTO Solution',
    '/applicazioni/nacscan': 'NACScan | PDF scanner and editor',
    '/applicazioni/nacscan/privacy': 'NACSCAN Privacy Policy | DTO Solution',
    '/applicazioni/shopping-voice': 'Shopping Voice | DTO Solution',
    '/applicazioni/shopping-voice/privacy': 'Shopping Voice Privacy Policy | DTO Solution',
    '/applicazioni/driver-utility': 'Driver Utility | DTO Solution',
    '/applicazioni/driver-utility/privacy': 'Driver Utility Privacy Policy | DTO Solution',
    '/area-driver': 'Driver Area | Contracts and tools',
    '/area-driver/turni': 'Driver Shifts | DTO Solution',
    '/area-driver/busta-paga': 'Driver Payroll | DTO Solution',
    '/area-driver/contratto': 'Driver Contract Profile | DTO Solution',
    '/area-driver/backup': 'Backup and restore | DTO Solution Driver Area',
    '/area-driver/normativa': 'Reference legislation | DTO Solution Driver Area',
    '/area-driver/ccnl-logistica-trasporto-merci-spedizione': 'Logistics, Freight Transport and Shipping Agreement | DTO Solution',
    '/area-driver/accordo-asso-espressi-ultimo-miglio-2025': 'Assoespressi 2025 Amazon last-mile agreement | DTO Solution',
    '/applicazioni/checkvan-pro': 'CheckVan Pro | DTO Solution',
    '/applicazioni/checkvan-pro/privacy': 'CheckVan Pro Privacy Policy | DTO Solution',
    '/software/observa-poker': 'Observa Poker | Software',
    '/chi-siamo': 'About us | DTO Solution',
    '/privacy': 'Privacy Policy | DTO Solution',
    '/privacy/sito-web': 'Website Privacy Policy | DTO Solution',
    '/contatti': 'Contact | DTO Solution',
  },
}

const defaultDescriptions = {
  it: 'DTO Solution sviluppa applicazioni e software per semplificare il lavoro, i documenti e le attività quotidiane.',
  en: 'DTO Solution develops applications and software to simplify work, documents and everyday tasks.',
}

function setAlternateLink(language, href) {
  let link = document.querySelector(`link[rel="alternate"][hreflang="${language}"]`)
  if (!link) {
    link = document.createElement('link')
    link.rel = 'alternate'
    link.hreflang = language
    document.head.appendChild(link)
  }
  link.href = href
}

function PageLayout() {
  const { pathname } = useLocation()
  const { language, origin } = useI18n()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  useEffect(() => {
    const canonicalPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '')
    const canonicalUrl = `${origin}${canonicalPath}`
    const canonical = document.querySelector('link[rel="canonical"]')
    const openGraphUrl = document.querySelector('meta[property="og:url"]')
    const openGraphLocale = document.querySelector('meta[property="og:locale"]')
    const description = document.querySelector('meta[name="description"]')
    const openGraphTitle = document.querySelector('meta[property="og:title"]')
    const openGraphDescription = document.querySelector('meta[property="og:description"]')
    const localizedTitle = pageTitles[language][pathname]
      ?? (language === 'en' ? 'Page not found | DTO Solution' : 'Pagina non trovata | DTO Solution')

    document.title = localizedTitle
    description?.setAttribute('content', defaultDescriptions[language])
    canonical?.setAttribute('href', canonicalUrl)
    openGraphUrl?.setAttribute('content', canonicalUrl)
    openGraphLocale?.setAttribute('content', language === 'en' ? 'en_US' : 'it_IT')
    openGraphTitle?.setAttribute('content', localizedTitle)
    openGraphDescription?.setAttribute('content', defaultDescriptions[language])
    setAlternateLink('it', `https://www.dtosolution.it${canonicalPath}`)
    setAlternateLink('en', `https://www.dtosolution.com${canonicalPath}`)
    setAlternateLink('x-default', `https://www.dtosolution.it${canonicalPath}`)
  }, [language, origin, pathname])

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Vai al contenuto</a>
      <Header />
      <main id="main-content" tabIndex="-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default PageLayout
