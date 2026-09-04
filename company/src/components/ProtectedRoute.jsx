import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { COMPANY_ROUTES } from '../routes.js'

export default function ProtectedRoute({ allowedRoles = null, deniedRoles = null, loginRoute = COMPANY_ROUTES.login, unauthorizedRoute = loginRoute }) {
  const { session, access, loading } = useAuth(); const location = useLocation()
  if (loading) return <div className="company-state">Verifica della sessione...</div>
  if (!session) return <Navigate to={loginRoute} replace state={{ from: location }} />
  if (allowedRoles && !allowedRoles.includes(access?.role)) return <Navigate to={loginRoute} replace state={{ accessDenied: true }} />
  if (deniedRoles?.includes(access?.role)) return <Navigate to={unauthorizedRoute} replace state={{ accessDenied: true }} />
  return <Outlet />
}
