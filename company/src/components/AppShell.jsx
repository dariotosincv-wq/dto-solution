import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { canManageDevices, canManageVehicles, canUseTools, canViewInspections } from '../access.js'
import { COMPANY_ROUTES } from '../routes.js'

export default function AppShell() {
  const { access, signOut } = useAuth()
  return <div className="company-shell"><aside className="company-sidebar"><NavLink className="company-brand" to={COMPANY_ROUTES.dashboard}><img src="/brand/dto-solution-horizontal-light.svg" alt="DTO Solution" /><span>Area Aziende</span></NavLink><nav aria-label="Navigazione principale"><NavLink to={COMPANY_ROUTES.dashboard}>Dashboard</NavLink><NavLink to={COMPANY_ROUTES.checkvan}>CheckVan</NavLink>{canManageVehicles(access) && <NavLink to={COMPANY_ROUTES.vehicles}>Veicoli</NavLink>}{canManageVehicles(access) && <NavLink to={COMPANY_ROUTES.drivers}>Driver</NavLink>}{canManageVehicles(access) && <NavLink to={COMPANY_ROUTES.assignments}>Assegnazioni</NavLink>}{canViewInspections(access) && <NavLink to={COMPANY_ROUTES.inspections}>Ispezioni</NavLink>}{canUseTools(access) && <NavLink to={COMPANY_ROUTES.verifyPdf}>Verifica PDF</NavLink>}{canUseTools(access) && <NavLink to={COMPANY_ROUTES.comparePdf}>Confronta ispezioni</NavLink>}{canManageDevices(access) && <NavLink to={COMPANY_ROUTES.devices}>Dispositivi</NavLink>}<NavLink to={COMPANY_ROUTES.account}>Account</NavLink></nav><button type="button" onClick={signOut}>Esci</button></aside><main className="company-main"><Outlet /></main></div>
}
