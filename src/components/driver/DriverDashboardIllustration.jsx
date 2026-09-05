import { CalendarDays, FileText, BookOpen, Scale } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n.js'

export default function DriverDashboardIllustration() {
  const { t } = useI18n()
  return <div className="driver-dashboard__art" aria-hidden="true">
    <img src="/images/area-driver/driver-hero-v2.png" width="1536" height="1024" alt="" fetchPriority="high" />
    <div className="driver-dashboard__art-labels">{[[CalendarDays, 'Turni', 'Shifts'], [FileText, 'Busta paga', 'Payslips'], [BookOpen, 'Contratti', 'Contracts'], [Scale, 'Normativa', 'Legislation']].map(([Icon, it, en]) => <span key={it}><Icon size={27} />{t(it, en)}</span>)}</div>
  </div>
}
