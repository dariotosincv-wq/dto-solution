import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { canUseTools } from '../access.js'
import { COMPANY_ROUTES } from '../routes.js'

export default function ToolGuard({ children, fallbackRoute = COMPANY_ROUTES.dashboard }) {
  return canUseTools(useAuth().access) ? children : <Navigate to={fallbackRoute} replace />
}
