export const optimisticDamage = ({ vehicleId, damageType, vehicleView, x, y, clientId }) => ({
  damage_id: `optimistic-${clientId}`,
  vehicle_id: vehicleId,
  damage_type: damageType,
  vehicle_view: vehicleView,
  normalized_x: x,
  normalized_y: y,
  status: 'PENDING',
  reported_at: new Date().toISOString(),
  saving: true,
})

export const addOptimisticDamage = (items, item) => [...items, item]
export const commitOptimisticDamage = (items, optimisticId, saved) => items.map((item) => item.damage_id === optimisticId ? saved : item)
export const rollbackOptimisticDamage = (items, optimisticId) => items.filter((item) => item.damage_id !== optimisticId)
export const damageClickKey = (vehicleView, damageType, x, y) => `${vehicleView}:${damageType}:${x.toFixed(4)}:${y.toFixed(4)}`
export const selectDamageTool = (toolRef, setTool, nextTool) => {
  toolRef.current = nextTool
  setTool(nextTool)
}
export const reserveDamageClick = (pending, key) => {
  if (pending.has(key)) return false
  pending.add(key)
  return true
}
export const removeOperationalDamage = (items, damageId) => items.filter((item) => item.damage_id !== damageId)
export const restoreOperationalDamage = (items, damage) => items.some((item) => item.damage_id === damage.damage_id) ? items : [...items, damage]
export const replaceDamage = (items, next) => items.map((item) => item.damage_id === next.damage_id ? next : item)
export async function updateDamageOptimistically({ items, damage, changes, setItems, request }) {
  const optimistic = { ...damage, ...changes }
  setItems(replaceDamage(items, optimistic))
  try { const saved = await request(optimistic); setItems((current) => replaceDamage(current, saved)); return saved }
  catch (error) { setItems((current) => replaceDamage(current, damage)); throw error }
}
