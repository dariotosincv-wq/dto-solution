import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../../company/src/auth/AuthContext.jsx'
import { ENTITIES_ROUTES } from '../routes.js'

export default function EntitiesShell() {
  const { signOut } = useAuth()

  return <div className="company-shell"><aside className="company-sidebar">
    <NavLink className="company-brand" to={ENTITIES_ROUTES.verify}><img src="/brand/dto-solution-horizontal-light.svg" alt="DTO Solution" /><span>Area Enti</span></NavLink>
    <nav aria-label="Navigazione Area Enti"><NavLink to={ENTITIES_ROUTES.verify}>Verifica PDF</NavLink><NavLink to={ENTITIES_ROUTES.compare}>Confronta ispezioni</NavLink></nav>
    <button type="button" onClick={signOut}>Esci</button>
  </aside><main className="company-main"><Outlet /></main></div>
}
