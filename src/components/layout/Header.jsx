import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import BrandLogo from '../common/BrandLogo.jsx'
import { useI18n } from '../../i18n/useI18n.js'

const navigation = [
  { label: 'Applicazioni', to: '/applicazioni' },
  { label: 'Chi siamo', to: '/chi-siamo' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Contatti', to: '/contatti' },
]

const areas = [
  { label: 'Area Driver', to: '/area-driver', group: 'free' },
  { label: 'Area Operativa', to: '/area-operativa', group: 'reserved', description: 'Turni, mezzi, rotte e assegnazioni della tua azienda' },
  { label: 'Area Aziende', to: '/azienda/login', group: 'reserved' },
  { label: 'Area Enti', to: '/enti/login', group: 'reserved' },
]

function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [areAreasOpen, setAreAreasOpen] = useState(false)
  const { language, localizedUrl } = useI18n()

  const closeMenu = () => { setIsOpen(false); setAreAreasOpen(false) }

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
          onClick={() => { setIsOpen((current) => !current); setAreAreasOpen(false) }}
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
          <div className="navigation__utility" onKeyDown={(event) => {
            if (event.key === 'Escape' && areAreasOpen) {
              setAreAreasOpen(false)
              event.currentTarget.querySelector('button').focus()
            }
          }}>
            <button type="button" className="navigation__area-cta navigation__utility-toggle" aria-expanded={areAreasOpen} aria-controls="utility-navigation" onClick={() => setAreAreasOpen((current) => !current)}>
              Driver Utility Web <ChevronDown size={18} aria-hidden="true" />
            </button>
          <div id="utility-navigation" className="navigation__areas" role="group" aria-label="Aree DTO Solution" hidden={!areAreasOpen}>
            {areas.map((area, index) => <div key={area.to}>{(index === 0 || area.group !== areas[index - 1].group) && <span className="navigation__areas-label">{area.group === 'free' ? 'Area gratuita' : 'Accessi riservati'}</span>}<NavLink to={area.to} onClick={closeMenu} className={({ isActive }) => `navigation__area-cta${isActive ? ' navigation__area-cta--active' : ''}`}>{area.label}{area.description && <small>{area.description}</small>}</NavLink></div>)}
          </div>
          </div>
          <NavLink to="/nacscan" onClick={closeMenu} className={({ isActive }) => `navigation__area-cta${isActive ? ' navigation__area-cta--active' : ''}`}>NACScan Web</NavLink>
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
