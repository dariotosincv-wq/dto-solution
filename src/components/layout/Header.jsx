import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import BrandLogo from '../common/BrandLogo.jsx'
import { useI18n } from '../../i18n/useI18n.js'

const navigation = [
  { label: 'Applicazioni', to: '/applicazioni' },
  { label: 'Area Driver', to: '/area-driver' },
  { label: 'Chi siamo', to: '/chi-siamo' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Contatti', to: '/contatti' },
]

function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { language, localizedUrl } = useI18n()

  const closeMenu = () => setIsOpen(false)

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link className="brand" to="/" onClick={closeMenu} aria-label="DTO Solution, homepage">
          <BrandLogo className="brand-logo--header" />
        </Link>

        <button
          className="menu-button"
          type="button"
          aria-expanded={isOpen}
          aria-controls="main-navigation"
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="sr-only">Apri o chiudi il menu</span>
          <span aria-hidden="true">{isOpen ? 'Chiudi' : 'Menu'}</span>
        </button>

        <nav
          id="main-navigation"
          className={`navigation${isOpen ? ' navigation--open' : ''}`}
          aria-label="Navigazione principale"
        >
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? 'navigation__link navigation__link--active' : 'navigation__link')}
            >
              {item.label}
            </NavLink>
          ))}
          <div className="language-switcher" aria-label="Selezione lingua">
            <a className={language === 'it' ? 'language-switcher__link language-switcher__link--active' : 'language-switcher__link'} href={localizedUrl('it')} lang="it" aria-current={language === 'it' ? 'page' : undefined}>IT</a>
            <span aria-hidden="true">|</span>
            <a className={language === 'en' ? 'language-switcher__link language-switcher__link--active' : 'language-switcher__link'} href={localizedUrl('en')} lang="en" aria-current={language === 'en' ? 'page' : undefined}>EN</a>
          </div>
        </nav>
      </div>
    </header>
  )
}

export default Header
