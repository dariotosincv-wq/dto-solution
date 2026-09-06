import { useEffect, useState } from 'react'
import { Smartphone, FileText, TriangleAlert, Users } from 'lucide-react'
import { canManageVehicles, canViewInspections } from '../access.js'
import { loadCompanyDrivers, loadCompanyInspections, loadVehicleReports } from '../lib/companySupabase.js'

export default function CheckVanSummary({ access, token }) {
  const inspect = canViewInspections(access), manage = canManageVehicles(access)
  const [results, setResults] = useState({})
  useEffect(() => {
    let current = true
    if (!token) return undefined
    const tasks = [
      ...(inspect ? [['inspections', () => loadCompanyInspections(token, { limit: 1 }), result => {
        if (!Number.isSafeInteger(result.total) || result.total < 0) throw new Error('COUNT_UNAVAILABLE')
        return result.total
      }]] : []),
      ...(manage ? [
        ['reports', () => loadVehicleReports(token), result => result.items.filter(item => item.status === 'OPEN').length],
        ['drivers', () => loadCompanyDrivers(token), result => result.items.filter(item => item.status === 'active').length],
      ] : []),
    ]
    for (const [key, load, count] of tasks) {
      load().then(result => { const value = count(result); if (current) setResults(previous => ({ ...previous, [key]: { value } })) }).catch(() => { if (current) setResults(previous => ({ ...previous, [key]: { error: true } })) })
    }
    return () => { current = false }
  }, [token, inspect, manage])
  const note = (key, allowed, description) => !allowed ? 'Non disponibile con questo accesso' : results[key]?.error ? 'Dati non disponibili' : results[key] ? description : 'Caricamento…'
  const cards = [
    [Smartphone, 'green', access?.devices?.active, 'Dispositivi attivi', `${access?.devices?.available ?? '—'} slot liberi su ${access?.devices?.capacity ?? '—'}`],
    [FileText, 'blue', inspect ? results.inspections?.value : null, 'Ispezioni disponibili', note('inspections', inspect, 'Totale documenti nell’archivio aziendale')],
    [TriangleAlert, 'orange', manage ? results.reports?.value : null, 'Segnalazioni aperte', note('reports', manage, 'Segnalazioni tecniche da verificare')],
    [Users, 'purple', manage ? results.drivers?.value : null, 'Driver attivi', note('drivers', manage, 'Attivi nell’anagrafica aziendale')],
  ]
  return <section className="checkvan-kpis" aria-label="Riepilogo operativo CheckVan">{cards.map(([Icon, tone, value, label, description]) => <article key={label} className={`fleet-kpi fleet-tone-${tone}`}><span className="fleet-icon"><Icon size={27} aria-hidden="true" /></span><div><strong>{value ?? '—'}</strong><h2>{label}</h2><small>{description}</small></div></article>)}</section>
}
