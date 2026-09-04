export const toggledVehicleStatus = (vehicle) => vehicle.status === 'active' ? 'inactive' : 'active'

export async function toggleVehicleStatusOptimistically({ vehicle, setVehicle, setUpdating, setError, request }) {
  const optimistic = { ...vehicle, status: toggledVehicleStatus(vehicle) }
  setError('')
  setVehicle(optimistic)
  setUpdating(true)
  try {
    const saved = await request(optimistic)
    setVehicle(saved ?? optimistic)
    return true
  } catch {
    setVehicle(vehicle)
    setError('Aggiornamento stato veicolo non riuscito.')
    return false
  } finally {
    setUpdating(false)
  }
}
