import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { Toaster } from 'sonner'
import './driver-tools.css'

const Attendance = lazy(() => import('../../../vendor/driver-utility/src/pages/Attendance'))
const Payroll = lazy(() => import('../../../vendor/driver-utility/src/pages/DriverPayroll'))
const Contract = lazy(() => import('./DriverContractSettings'))

export default function DriverToolsPage({ tool }: { tool: 'turni' | 'busta-paga' }) {
  return <article className="driver-tools container">
    <nav className="driver-tools__navigation" aria-label="Strumenti Area Driver">
      <Link to="/area-driver">Area Driver</Link>
      <Link to="/area-driver/turni" aria-current={tool === 'turni' ? 'page' : undefined}>Turni Driver</Link>
      <Link to="/area-driver/busta-paga" aria-current={tool === 'busta-paga' ? 'page' : undefined}>Busta Paga Driver</Link>
      <Link to="/area-driver/contratto">Profilo contrattuale</Link>
      <Link to="/area-driver/backup">Backup e ripristino</Link>
    </nav>
    <p className="driver-tools__privacy">I dati restano in questo browser. I PDF delle buste paga vengono letti localmente e non vengono archiviati.</p>
    <Suspense fallback={<p role="status">Caricamento strumento…</p>}>
      {tool === 'turni' ? <Attendance /> : <Payroll />}
    </Suspense>
    <div id="driver-portals" />
    <Toaster richColors />
  </article>
}

export function DriverContractPage() {
  return <article className="driver-tools container">
    <Link className="driver-tools__back" to="/area-driver/turni">Torna ai Turni Driver</Link>
    <Suspense fallback={<p role="status">Caricamento profilo…</p>}><Contract /></Suspense>
  </article>
}
