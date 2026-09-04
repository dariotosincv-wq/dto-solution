import { Navigate, Route, Routes } from 'react-router-dom'
import CheckVanComparisonPage from '../../src/pages/CheckVanComparisonPage.jsx'
import CheckVanVerificationPage from '../../src/pages/CheckVanVerificationPage.jsx'
import { AuthProvider } from '../../company/src/auth/AuthContext.jsx'
import ProtectedRoute from '../../company/src/components/ProtectedRoute.jsx'
import ToolGuard from '../../company/src/components/ToolGuard.jsx'
import ToolPage from '../../company/src/pages/ToolPage.jsx'
import EntitiesShell from './components/EntitiesShell.jsx'
import EntitiesLoginPage from './pages/EntitiesLoginPage.jsx'
import { ENTITIES_ROUTES } from './routes.js'
import '../../company/src/styles.css'

const ENTITY_ROLES = ['UNION_GUEST']

export default function App() {
  return <AuthProvider><Routes>
    <Route path="login" element={<EntitiesLoginPage />} />
    <Route element={<ProtectedRoute allowedRoles={ENTITY_ROLES} loginRoute={ENTITIES_ROUTES.login} />}>
      <Route element={<EntitiesShell />}>
        <Route path="verifica" element={<ToolGuard fallbackRoute={ENTITIES_ROUTES.login}><ToolPage title="Verifica PDF"><CheckVanVerificationPage /></ToolPage></ToolGuard>} />
        <Route path="confronta" element={<ToolGuard fallbackRoute={ENTITIES_ROUTES.login}><ToolPage title="Confronta ispezioni"><CheckVanComparisonPage /></ToolPage></ToolGuard>} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to={ENTITIES_ROUTES.verify} replace />} />
  </Routes></AuthProvider>
}
