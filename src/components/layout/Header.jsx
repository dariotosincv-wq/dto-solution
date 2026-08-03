import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import BrandLogo from '../common/BrandLogo.jsx'

const navigation = [
  { label: 'Applicazioni', to: '/applicazioni' },
  { label: 'Chi siamo', to: '/chi-siamo' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Contatti', to: '/contatti' },
]

function Header() {
  const [isOpen, setIsOpen] = useState(false)

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
        </nav>
      </div>
    </header>
  )
}

export default Header
