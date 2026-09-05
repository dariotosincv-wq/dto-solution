import { useMemo } from 'react'
import { useLocalStorage } from '../../../vendor/driver-utility/src/hooks/useLocalStorage'
import {
  DEFAULT_DRIVER_CONTRACT_PROFILE, DRIVER_CONTRACT_PROFILE_STORAGE_KEY,
  normalizeDriverContractProfile, type DriverContractProfile, type IsoWeekday,
} from '../../../vendor/driver-utility/src/lib/driverContractProfile'

// Contract section of reference/src/pages/Settings.tsx; identical updates and normalization.
const weekdays: Array<{ value: IsoWeekday; label: string }> = [
  { value: 1, label: 'Lunedì' }, { value: 2, label: 'Martedì' },
  { value: 3, label: 'Mercoledì' }, { value: 4, label: 'Giovedì' },
  { value: 5, label: 'Venerdì' }, { value: 6, label: 'Sabato' }, { value: 7, label: 'Domenica' },
]
export default function DriverContractSettings() {
  const [stored, setStored] = useLocalStorage<DriverContractProfile>(DRIVER_CONTRACT_PROFILE_STORAGE_KEY, DEFAULT_DRIVER_CONTRACT_PROFILE)
  const profile = useMemo(() => normalizeDriverContractProfile(stored), [stored])
  const update = (patch: Partial<DriverContractProfile>) => setStored(normalizeDriverContractProfile({ ...profile, ...patch }))
  const toggle = (weekday: IsoWeekday) => update({ contractualWeekdays: profile.contractualWeekdays.includes(weekday)
    ? profile.contractualWeekdays.filter(day => day !== weekday) : [...profile.contractualWeekdays, weekday] })
  return <section className="driver-card driver-contract">
    <h1>Contratto di lavoro</h1>
    <label htmlFor="contract-type">Tipo contratto</label>
    <select id="contract-type" className="driver-input" value={profile.contractType} onChange={event => update({ contractType: event.target.value === 'part_time' ? 'part_time' : 'full_time' })}>
      <option value="full_time">Full-time</option><option value="part_time">Part-time</option>
    </select>
    <label htmlFor="weekly-hours">Ore settimanali</label>
    <input id="weekly-hours" className="driver-input" type="number" min="1" max="60" step="1" value={profile.weeklyHours} onChange={event => update({ weeklyHours: Number(event.target.value) })} />
    {profile.contractType === 'part_time' && <div>
      <p>Giorni contrattuali settimanali: {profile.contractualWeekdays.length}</p>
      <div className="driver-contract__weekdays">{weekdays.map(({ value, label }) => <button type="button" key={value} aria-pressed={profile.contractualWeekdays.includes(value)} onClick={() => toggle(value)}>{label}</button>)}</div>
    </div>}
  </section>
}
