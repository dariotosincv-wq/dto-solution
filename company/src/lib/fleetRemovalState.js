export async function removeVehicleOptimistically({ vehicle, items, setItems, request, setError }) {
  setError(''); setItems(items.filter((item) => item.vehicle_id !== vehicle.vehicle_id))
  try { return await request() }
  catch (error) { setItems(items); setError('Rimozione del veicolo non riuscita.'); throw error }
}
