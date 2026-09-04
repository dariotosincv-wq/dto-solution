import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_COMPANY_SUPABASE_URL
const publishableKey = import.meta.env.VITE_COMPANY_SUPABASE_ANON_KEY

export const isCompanySupabaseConfigured = Boolean(url && publishableKey)
export const companySupabase = isCompanySupabaseConfigured
  ? createClient(url, publishableKey, { auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, flowType: 'pkce' } })
  : null

export async function loadCompanyAccess(accessToken, signal) {
  const response = await fetch('/api/company-access', { headers: { Authorization: `Bearer ${accessToken}` }, signal })
  if (!response.ok) throw new Error(response.status === 401 ? 'SESSION_EXPIRED' : 'ACCESS_UNAVAILABLE')
  return response.json()
}

async function authorizedRequest(path, accessToken, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...options.headers, Authorization: `Bearer ${accessToken}` } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'REQUEST_FAILED')
  return body
}

export const loadCompanyDevices = (accessToken) => authorizedRequest('/api/company-devices', accessToken)
export const createEnrollmentToken = (accessToken) => authorizedRequest('/api/company-enrollment-token', accessToken, { method: 'POST' })
export const provisionCompanyTrial = (accessToken, organizationName) => authorizedRequest('/api/company-trial', accessToken, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationName }),
})
export const loadCompanyInspections = (accessToken, filters = {}) => {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value != null))
  return authorizedRequest(`/api/company-inspections?${query}`, accessToken)
}
export const createInspectionDownload = (accessToken, id) => authorizedRequest('/api/company-inspection-download', accessToken, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
})
export const loadCompanyVehicles = (token) => authorizedRequest('/api/company-vehicles', token)
export const createCompanyVehicle = (token, value) => authorizedRequest('/api/company-vehicles', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
export const importCompanyVehicles = (token, vehicles) => authorizedRequest('/api/company-vehicles', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vehicles }) })
export const removeCompanyVehicle = (token, id) => authorizedRequest(`/api/company-vehicle?id=${encodeURIComponent(id)}`, token, { method: 'DELETE' })
export const loadVehicleRemovalPlan = (token, id) => authorizedRequest(`/api/company-vehicle?id=${encodeURIComponent(id)}&removal_check=1`, token)
export const updateCompanyVehicle = (token, id, value) => authorizedRequest(`/api/company-vehicle?id=${encodeURIComponent(id)}`, token, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
export const loadVehicleDamages = (token, vehicleId) => authorizedRequest(`/api/company-vehicle-damages?vehicle_id=${encodeURIComponent(vehicleId)}`, token)
export const loadVehicleReports = (token, vehicleId='') => authorizedRequest(`/api/company-vehicle-reports${vehicleId?`?vehicle_id=${encodeURIComponent(vehicleId)}`:''}`, token)
export const resolveVehicleReport = (token, reportId) => authorizedRequest('/api/company-vehicle-reports', token, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'RESOLVE',report_id:reportId}) })
export const createVehicleDamage = (token, value) => authorizedRequest('/api/company-vehicle-damages', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
export const updateVehicleDamage = (token, value) => authorizedRequest('/api/company-vehicle-damages', token, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
export const loadDamagePhoto = (token, damageId) => authorizedRequest('/api/company-damage-photo', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ damage_id: damageId }) })
export async function createCompanyDamageWithPhoto(token, value, file, clientId) {
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const created = await authorizedRequest('/api/company-damage-photo', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'CREATE', ...value, client_generated_id: clientId, photo_hash: hash, photo_size_bytes: file.size, photo_mime_type: file.type }) })
  const finalize = () => authorizedRequest('/api/company-damage-photo', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'FINALIZE', damage_id: created.damage.damage_id }) })
  const upload = await fetch(created.signedUploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
  if (!upload.ok) return finalize()
  return finalize()
}
export const loadCompanyDrivers = (token) => authorizedRequest('/api/company-drivers', token)
export const createCompanyDriver = (token, value) => authorizedRequest('/api/company-drivers', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
export const updateCompanyDriver = (token, value) => authorizedRequest('/api/company-drivers', token, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
export const importCompanyDrivers = (token, drivers) => authorizedRequest('/api/company-drivers', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ drivers }) })
export const loadCompanyAssignments = (token, date) => authorizedRequest(`/api/company-assignments?date=${encodeURIComponent(date)}`, token)
export const saveCompanyAssignment = (token, value) => authorizedRequest('/api/company-assignments', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
export const copyPreviousAssignments = (token, date) => saveCompanyAssignment(token, { action: 'COPY_PREVIOUS', assignment_date: date })
