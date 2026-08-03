import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Footer from './Footer.jsx'
import Header from './Header.jsx'

function PageLayout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  useEffect(() => {
    const pageTitles = {
      '/': 'DTO Solution | Sito ufficiale',
      '/applicazioni': 'Applicazioni | DTO Solution',
      '/applicazioni/nacscan': 'NACScan | Scanner ed editor PDF',
      '/applicazioni/nacscan/privacy': 'Privacy Policy NACSCAN | DTO Solution',
      '/applicazioni/driver-utility': 'Driver Utility | DTO Solution',
      '/applicazioni/driver-utility/privacy': 'Privacy Policy Driver Utility | DTO Solution',
      '/applicazioni/checkvan-pro': 'CheckVan Pro | DTO Solution',
      '/applicazioni/checkvan-pro/privacy': 'Privacy Policy CheckVan Pro | DTO Solution',
      '/software/observa-poker': 'Observa Poker | Software',
      '/chi-siamo': 'Chi siamo | DTO Solution',
      '/privacy': 'Privacy Policy | DTO Solution',
      '/contatti': 'Contatti | DTO Solution',
    }

    document.title = pageTitles[pathname]
      ?? 'Pagina non trovata | DTO Solution'
  }, [pathname])

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
