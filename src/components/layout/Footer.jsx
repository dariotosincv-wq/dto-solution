import { Link } from 'react-router-dom'
import BrandLogo from '../common/BrandLogo.jsx'
import { useI18n } from '../../i18n/useI18n.js'

function Footer() {
  const { domain, origin } = useI18n()
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div>
          <Link className="brand brand--footer" to="/" aria-label="DTO Solution, homepage">
            <BrandLogo className="brand-logo--footer" />
          </Link>
          <p className="site-footer__note">Applicazioni e software nati da problemi reali.</p>
          <div className="site-footer__contacts">
            <a href="mailto:dtosolution@gmail.com">dtosolution@gmail.com</a>
            <a href={origin}>{domain.replace('www.', '')}</a>
          </div>
        </div>
        <nav className="footer-navigation" aria-label="Navigazione nel footer">
          <Link to="/privacy">Privacy</Link>
          <Link to="/contatti">Contatti</Link>
        </nav>
      </div>
    </footer>
  )
}

export default Footer
