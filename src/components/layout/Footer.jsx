import { Link } from 'react-router-dom'
import BrandLogo from '../common/BrandLogo.jsx'

function Footer() {
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
            <a href="https://dtosolution.it">dtosolution.it</a>
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
