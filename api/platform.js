import { authenticateRequest, clientsFromEnvironment, resolveCompanyContext, sendError, sendJson } from './_lib/companyLicensing.js'
import { authenticateDeviceRequest, resolveDeviceContext } from './_lib/deviceAuthentication.js'
import { damageInput, damagePhotoInput, publicDamage, publicVehicle, requireCompanyAdmin, uuid, vehicleBatchInput, vehicleInput } from './_lib/companyVehicles.js'
import { handleDeviceVehicleDamages } from './_lib/deviceVehicleDamages.js'
import { assignmentInput, driverBatchInput, driverInput, publicAssignment, publicDriver } from './_lib/companyDrivers.js'
import { planningWeek, readPlanning, mutatePlanning } from './_lib/companyPlanning.js'
import { driverWeek, hashSecret, newSecret, operationalSession, sessionCookie } from './_lib/operationalAccess.js'
import { weekStart } from '../company/src/lib/weeklyPlanning.js'
import superAdminHandler from './_lib/superAdminHandler.js'
import { assertCompanyVehicle, assignedReportContext, publicVehicleReport, vehicleReportInput } from './_lib/vehicleReports.js'
import { beginGoogleDriveOAuth, cloudArchiveStatus, completeGoogleDriveOAuth, createArchiveFolder, disconnectGoogleDrive, queueCloudSyncs, verifyGoogleDriveConnection } from './_lib/cloudArchive.js'

const deviceResources = new Set(['device-vehicles', 'device-damages', 'device-driver-assignments', 'device-vehicle-reports', 'device-operational-assignment'])
const deviceOrigins = new Set(['http://localhost', 'https://localhost', 'capacitor://localhost'])
const deviceAllowedHeaders = 'content-type, x-checkvan-device-id, x-checkvan-key-id, x-checkvan-timestamp, x-checkvan-request-id, x-checkvan-signature'

function handleDeviceCors(request, response, resource) {
  if (!deviceResources.has(resource)) return false
  const origin = request.headers.origin
  if (deviceOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', deviceAllowedHeaders)
    response.setHeader('Access-Control-Max-Age', '600')
    response.setHeader('Vary', 'Origin')
  }
  if (request.method === 'OPTIONS') {
    if (!deviceOrigins.has(origin)) return sendJson(response, 403, { error: 'ORIGIN_NOT_ALLOWED' })
    response.status(204).end()
    return true
  }
  return false
}

async function companyContext(request, clients) {
  const user = await authenticateRequest(request, clients)
  const context = await resolveCompanyContext(user.id, clients)
  requireCompanyAdmin(context)
  return { user, context }
}

async function companyVehicles(request, response, clients) {
  const { user, context } = await companyContext(request, clients)
  if (request.method === 'GET') {
    const { data, error } = await clients.checkvan.from('checkvan_vehicles').select('*').eq('organization_id', context.organization.id).order('internal_code')
    if (error) throw new Error('VEHICLES_UNAVAILABLE')
    const{data:openReports,error:reportsError}=await clients.checkvan.from('checkvan_vehicle_reports').select('vehicle_id').eq('organization_id',context.organization.id).eq('status','OPEN')
    if(reportsError)throw new Error('REPORTS_UNAVAILABLE')
    const counts=(openReports??[]).reduce((map,row)=>map.set(row.vehicle_id,(map.get(row.vehicle_id)??0)+1),new Map())
    const vehicles = (data ?? []).map(row=>({...publicVehicle(row),open_report_count:counts.get(row.id)??0}))
    return sendJson(response, 200, { items: vehicles.filter((vehicle) => vehicle.status !== 'archived'), existing: vehicles.map(({ internal_code, plate }) => ({ internal_code, plate })) })
  }
  if (request.method === 'POST') {
    if (Array.isArray(request.body?.vehicles)) {
      const vehicles = vehicleBatchInput(request.body)
      const { data, error } = await clients.checkvan.rpc('internal_admin_import_checkvan_vehicles', { p_auth_subject: user.id, p_organization_id: context.organization.id, p_rows: vehicles })
      if (error) throw Object.assign(new Error(error.message), { status: 400 })
      return sendJson(response, 200, data)
    }
    const input = vehicleInput(request.body)
    const { data, error } = await clients.checkvan.from('checkvan_vehicles').insert({ organization_id: context.organization.id, ...input }).select('*').single()
    if (error) throw Object.assign(new Error(error.code === '23505' ? 'VEHICLE_PLATE_EXISTS' : 'VEHICLES_UNAVAILABLE'), { status: error.code === '23505' ? 409 : 503 })
    return sendJson(response, 201, publicVehicle(data))
  }
  return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
}

async function companyVehicle(request, response, clients) {
  const { user, context } = await companyContext(request, clients)
  const id = request.query?.id
  if (!uuid(id)) return sendJson(response, 400, { error: 'INVALID_VEHICLE_ID' })
  if (request.method === 'GET') {
    if (request.query?.removal_check === '1') {
      const [inspections, damages, events, reports] = await Promise.all([
        clients.checkvan.from('checkvan_inspections').select('id', { count: 'exact', head: true }).eq('vehicle_id', id),
        clients.checkvan.from('checkvan_vehicle_damages').select('id', { count: 'exact', head: true }).eq('organization_id', context.organization.id).eq('vehicle_id', id),
        clients.checkvan.from('checkvan_vehicle_events').select('id', { count: 'exact', head: true }).eq('organization_id', context.organization.id).eq('vehicle_id', id),
        clients.checkvan.from('checkvan_vehicle_reports').select('id', { count: 'exact', head: true }).eq('organization_id', context.organization.id).eq('vehicle_id', id),
      ])
      if ([inspections, damages, events, reports].some((result) => result.error)) throw new Error('VEHICLE_HISTORY_UNAVAILABLE')
      return sendJson(response, 200, { hasHistory: [inspections, damages, events, reports].some((result) => (result.count ?? 0) > 0) })
    }
    const { data, error } = await clients.checkvan.from('checkvan_vehicles').select('*').eq('id', id).eq('organization_id', context.organization.id).maybeSingle()
    if (error) throw new Error('VEHICLES_UNAVAILABLE')
    return data ? sendJson(response, 200, publicVehicle(data)) : sendJson(response, 404, { error: 'VEHICLE_NOT_FOUND' })
  }
  if (request.method === 'PATCH') {
    const input = vehicleInput(request.body)
    const { data, error } = await clients.checkvan.from('checkvan_vehicles').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id).eq('organization_id', context.organization.id).select('*').maybeSingle()
    if (error) throw Object.assign(new Error(error.code === '23505' ? 'VEHICLE_PLATE_EXISTS' : 'VEHICLES_UNAVAILABLE'), { status: error.code === '23505' ? 409 : 503 })
    return data ? sendJson(response, 200, publicVehicle(data)) : sendJson(response, 404, { error: 'VEHICLE_NOT_FOUND' })
  }
  if (request.method === 'DELETE') {
    const { data, error } = await clients.checkvan.rpc('internal_admin_remove_checkvan_vehicle', { p_auth_subject: user.id, p_organization_id: context.organization.id, p_vehicle_id: id })
    if (error) throw Object.assign(new Error(error.message), { status: 400 })
    return sendJson(response, 200, { mode: data.mode, vehicle: publicVehicle(data.vehicle) })
  }
  return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
}

async function companyDamages(request, response, clients) {
  const { user, context } = await companyContext(request, clients)
  if (request.method === 'GET') {
    const vehicleId = request.query?.vehicle_id
    if (!uuid(vehicleId)) return sendJson(response, 400, { error: 'INVALID_VEHICLE_ID' })
    const { data, error } = await clients.checkvan.from('checkvan_vehicle_damages').select('*').eq('organization_id', context.organization.id).eq('vehicle_id', vehicleId).order('reported_at', { ascending: false })
    if (error) throw new Error('DAMAGES_UNAVAILABLE')
    return sendJson(response, 200, { items: (data ?? []).filter((d) => d.photo_upload_status !== 'UPLOADING').map(publicDamage) })
  }
  if (request.method === 'POST') {
    return sendJson(response, 400, { error: 'DAMAGE_PHOTO_REQUIRED' })
  }
  if (request.method === 'PATCH') {
    if (!uuid(request.body?.damage_id)) return sendJson(response, 400, { error: 'INVALID_DAMAGE_ID' })
    const decision = ['APPROVE', 'REJECT'].includes(request.body.action)
    const rpc = decision ? 'internal_admin_decide_checkvan_damage' : request.body.action ? 'internal_admin_transition_checkvan_damage' : 'internal_admin_update_checkvan_damage'
    const args = request.body.action
      ? { p_auth_subject: user.id, p_organization_id: context.organization.id, p_damage_id: request.body.damage_id, p_action: request.body.action, ...(decision ? { p_note: request.body.note ?? null } : {}) }
      : (() => { const d = damageInput(request.body); return { p_auth_subject: user.id, p_organization_id: context.organization.id, p_damage_id: request.body.damage_id, p_damage_type: d.damage_type, p_vehicle_view: d.vehicle_view, p_x: d.x, p_y: d.y } })()
    const previous = request.body.action === 'REMOVE' ? await clients.checkvan.from('checkvan_vehicle_damages').select('photo_bucket,photo_object_path,status').eq('id',request.body.damage_id).eq('organization_id',context.organization.id).maybeSingle() : null
    const { data, error } = await clients.checkvan.rpc(rpc, args)
    if (error) throw Object.assign(new Error(error.message), { status: 400 })
    if (request.body.action === 'REMOVE' && previous?.data?.status === 'PENDING' && previous.data.photo_bucket && previous.data.photo_object_path) void clients.checkvan.storage.from(previous.data.photo_bucket).remove([previous.data.photo_object_path])
    return sendJson(response, 200, publicDamage(data))
  }
  return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
}

async function deviceVehicles(request, response, clients) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  const device = await authenticateDeviceRequest(request, clients, '/api/device-vehicles')
  const context = await resolveDeviceContext(device, clients)
  const { data, error } = await clients.checkvan.from('checkvan_vehicles').select('id,internal_code,plate,silhouette_category,status').eq('organization_id', context.organization.id).eq('status', 'active').order('internal_code')
  if (error) throw new Error('VEHICLES_UNAVAILABLE')
  return sendJson(response, 200, { items: (data ?? []).map(publicVehicle) })
}

async function deviceDamages(request, response, clients) {
  return handleDeviceVehicleDamages(request, response, { clients, authenticate: (req, value) => authenticateDeviceRequest(req, value, '/api/device-vehicle-damages'), resolveContext: resolveDeviceContext })
}

async function deviceVehicleReports(request,response,clients){
  if(request.method!=='POST')return sendJson(response,405,{error:'METHOD_NOT_ALLOWED'})
  const device=await authenticateDeviceRequest(request,clients,'/api/device-vehicle-reports'),context=await resolveDeviceContext(device,clients),body=request.body??{}
  const assigned=await assignedReportContext(clients,context.organization.id,body.driver_id,body.vehicle_id)
  if(body.action==='LIST'){const{data,error}=await clients.checkvan.from('checkvan_vehicle_reports').select('*').eq('organization_id',context.organization.id).eq('vehicle_id',body.vehicle_id).eq('status','OPEN').order('reported_at',{ascending:false});if(error)throw new Error('REPORTS_UNAVAILABLE');return sendJson(response,200,{items:(data??[]).map(publicVehicleReport)})}
  if(body.action==='CREATE'){
    if(!uuid(body.client_generated_id))return sendJson(response,400,{error:'INVALID_CLIENT_GENERATED_ID'})
    const input=vehicleReportInput(body),existingQuery=()=>{let query=clients.checkvan.from('checkvan_vehicle_reports').select('*').eq('organization_id',context.organization.id).eq('vehicle_id',body.vehicle_id).eq('report_type',input.report_type).eq('status','OPEN');return input.report_type==='OTHER'?query.ilike('description',input.description):query}
    const{data:retry,error:retryError}=await clients.checkvan.from('checkvan_vehicle_reports').select('*').eq('reporter_device_id',device.id).eq('client_generated_id',body.client_generated_id).maybeSingle();if(retryError)throw new Error('REPORTS_UNAVAILABLE');if(retry)return sendJson(response,200,publicVehicleReport(retry))
    let duplicate=existingQuery();if(input.report_type==='OTHER')duplicate=duplicate.eq('description',input.description);const{data:open}=await duplicate.maybeSingle();if(open)return sendJson(response,200,publicVehicleReport(open))
    const{data,error}=await clients.checkvan.from('checkvan_vehicle_reports').insert({organization_id:context.organization.id,vehicle_id:assigned.vehicleId,reporter_device_id:device.id,driver_id:assigned.driverId,client_generated_id:body.client_generated_id,...input}).select('*').single()
    if(error){if(error.code==='23505'){let raced=existingQuery();if(input.report_type==='OTHER')raced=raced.eq('description',input.description);const result=await raced.maybeSingle();if(result.data)return sendJson(response,200,publicVehicleReport(result.data))}throw new Error('REPORT_CREATE_FAILED')}
    return sendJson(response,201,publicVehicleReport(data))
  }
  return sendJson(response,400,{error:'INVALID_ACTION'})
}

async function companyVehicleReports(request,response,clients){
  const{user,context}=await companyContext(request,clients),vehicleId=request.method==='GET'?request.query?.vehicle_id:request.body?.vehicle_id
  if(vehicleId)await assertCompanyVehicle(clients,context.organization.id,vehicleId)
  if(request.method==='GET'){let query=clients.checkvan.from('checkvan_vehicle_reports').select('*,checkvan_drivers(first_name,last_name)').eq('organization_id',context.organization.id).order('reported_at',{ascending:false});if(vehicleId)query=query.eq('vehicle_id',vehicleId);const{data,error}=await query;if(error)throw new Error('REPORTS_UNAVAILABLE');return sendJson(response,200,{items:(data??[]).map(row=>({...publicVehicleReport(row),driver:row.checkvan_drivers?`${row.checkvan_drivers.first_name} ${row.checkvan_drivers.last_name}`:null}))})}
  if(request.method==='PATCH'){if(request.body?.action!=='RESOLVE'||!uuid(request.body?.report_id))return sendJson(response,400,{error:'INVALID_REPORT_ACTION'});const now=new Date().toISOString(),{data,error}=await clients.checkvan.from('checkvan_vehicle_reports').update({status:'RESOLVED',resolved_at:now,resolved_by:user.id,updated_at:now}).eq('id',request.body.report_id).eq('organization_id',context.organization.id).eq('status','OPEN').select('*').maybeSingle();if(error)throw new Error('REPORT_RESOLVE_FAILED');return data?sendJson(response,200,publicVehicleReport(data)):sendJson(response,404,{error:'OPEN_REPORT_NOT_FOUND'})}
  return sendJson(response,405,{error:'METHOD_NOT_ALLOWED'})
}

async function companyDrivers(request, response, clients) {
  const { user, context } = await companyContext(request, clients)
  if (request.method === 'GET') {
    const { data, error } = await clients.checkvan.from('checkvan_drivers').select('*').eq('organization_id', context.organization.id).order('last_name').order('first_name')
    if (error) throw new Error('DRIVERS_UNAVAILABLE')
    return sendJson(response, 200, { items: (data ?? []).map(publicDriver) })
  }
  if (request.method === 'POST') {
    if (Array.isArray(request.body?.drivers)) {
      const { data, error } = await clients.checkvan.rpc('internal_admin_import_checkvan_drivers', { p_auth_subject: user.id, p_organization_id: context.organization.id, p_rows: driverBatchInput(request.body) })
      if (error) throw Object.assign(new Error(error.message), { status: 400 })
      return sendJson(response, 200, data)
    }
    const { data, error } = await clients.checkvan.from('checkvan_drivers').insert({ organization_id: context.organization.id, ...driverInput(request.body) }).select('*').single()
    if (error) throw Object.assign(new Error(error.code === '23505' ? 'DRIVER_CODE_EXISTS' : 'DRIVERS_UNAVAILABLE'), { status: error.code === '23505' ? 409 : 503 })
    return sendJson(response, 201, publicDriver(data))
  }
  if (request.method === 'PATCH') {
    if (!uuid(request.body?.driver_id)) return sendJson(response, 400, { error: 'INVALID_DRIVER_ID' })
    if (request.body.action === 'PROFILE') {
      const days = request.body.expected_weekly_days
      if (days !== null && (!Number.isInteger(days) || days < 0 || days > 7)) return sendJson(response, 400, { error: 'INVALID_DRIVER_PROFILE' })
      const { data, error } = await clients.checkvan.rpc('internal_admin_set_driver_profile', { p_auth_subject: user.id, p_organization_id: context.organization.id, p_driver_id: request.body.driver_id, p_days: days })
      if (error) throw Object.assign(new Error('DRIVER_PROFILE_SAVE_FAILED'), { status: 400 })
      return sendJson(response, 200, publicDriver(data))
    }
    const values = request.body.action === 'ARCHIVE' ? { status: 'archived', archived_at: new Date().toISOString(), updated_at: new Date().toISOString() } : { ...driverInput(request.body), status: 'active', archived_at: null, updated_at: new Date().toISOString() }
    const { data, error } = await clients.checkvan.from('checkvan_drivers').update(values).eq('id', request.body.driver_id).eq('organization_id', context.organization.id).select('*').maybeSingle()
    if (error) throw new Error('DRIVERS_UNAVAILABLE')
    return data ? sendJson(response, 200, publicDriver(data)) : sendJson(response, 404, { error: 'DRIVER_NOT_FOUND' })
  }
  return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
}

async function companyAssignments(request, response, clients) {
  const { user, context } = await companyContext(request, clients)
  const date = request.method === 'GET' ? request.query?.date : request.body?.assignment_date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return sendJson(response, 400, { error: 'INVALID_ASSIGNMENT_DATE' })
  if (request.method === 'GET') {
    const [planning, drivers, vehicles] = await Promise.all([
      readPlanning(clients.checkvan, context.organization.id, date, date),
      clients.checkvan.from('checkvan_drivers').select('*').eq('organization_id', context.organization.id).eq('status', 'active').order('last_name'),
      clients.checkvan.from('checkvan_vehicles').select('*').eq('organization_id', context.organization.id).eq('status', 'active').order('internal_code'),
    ])
    if ([drivers, vehicles].some((value) => value.error)) throw new Error('ASSIGNMENTS_UNAVAILABLE')
    const assignments = planning.effective.filter(item => item.work_status === 'TURNO').map(item => ({ ...publicAssignment(item), work_status: item.work_status, route: item.route, notes: item.notes, source: item.source }))
    return sendJson(response, 200, { date, assignments, operational: planning.effective, drivers: drivers.data.map(publicDriver), vehicles: vehicles.data.map(publicVehicle) })
  }
  if (request.method === 'POST') {
    if (request.body?.action === 'COPY_PREVIOUS') {
      const { data, error } = await clients.checkvan.rpc('internal_admin_copy_operational_assignments', { p_auth_subject: user.id, p_organization_id: context.organization.id, p_date: date })
      if (error) throw Object.assign(new Error(error.message), { status: 400 })
      return sendJson(response, 200, data)
    }
    const input = assignmentInput(request.body)
    const [driver, vehicle] = await Promise.all([
      clients.checkvan.from('checkvan_drivers').select('id').eq('id', input.driver_id).eq('organization_id', context.organization.id).eq('status', 'active').maybeSingle(),
      clients.checkvan.from('checkvan_vehicles').select('id').eq('id', input.vehicle_id).eq('organization_id', context.organization.id).eq('status', 'active').maybeSingle(),
    ])
    if (!driver.data || !vehicle.data) return sendJson(response, 409, { error: 'ASSIGNMENT_TARGET_UNAVAILABLE' })
    const { data, error } = await clients.checkvan.rpc('internal_admin_set_operational_vehicle', { p_auth_subject: user.id, p_organization_id: context.organization.id, p_date: date, p_driver_id: input.driver_id, p_vehicle_id: input.vehicle_id })
    if (error) throw Object.assign(new Error('ASSIGNMENT_CONFLICT'), { status: 409 })
    return sendJson(response, 200, publicAssignment(data))
  }
  return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
}

async function companyCloudArchive(request, response, clients) {
  const action = request.query?.action ?? request.body?.action
  if (action === 'callback' || (request.method === 'GET' && (request.query?.code || request.query?.error))) {
    const target = new URL('/azienda/account', 'https://www.dtosolution.it')
    try {
      if (request.query?.error) throw Object.assign(new Error('OAUTH_CANCELLED'), { status: 400 })
      const completed = await completeGoogleDriveOAuth(clients, request.query?.code, request.query?.state)
      if (completed.includeHistory) {
        const { data } = await clients.checkvan.from('checkvan_inspections').select('id').eq('organization_id', completed.organizationId).eq('upload_status', 'available').limit(100)
        await queueCloudSyncs(clients, completed.organizationId, (data ?? []).map(item => item.id))
      }
      target.searchParams.set('cloud', 'connected')
    } catch (error) { target.searchParams.set('cloud', error.message === 'OAUTH_CANCELLED' ? 'cancelled' : 'error') }
    return response.redirect(302, target.toString())
  }
  const { user, context } = await companyContext(request, clients)
  if (!context.organization) return sendJson(response, 403, { error: 'CLOUD_ARCHIVE_FORBIDDEN' })
  if (request.method === 'GET') return sendJson(response, 200, await cloudArchiveStatus(clients, context.organization.id))
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  if (action === 'OAUTH_START') return sendJson(response, 200, await beginGoogleDriveOAuth(clients, context, user.id, request.body?.include_history === true))
  if (action === 'VERIFY') return sendJson(response, 200, await verifyGoogleDriveConnection(clients, context.organization.id))
  if (action === 'DISCONNECT') { await disconnectGoogleDrive(clients, context.organization.id); return sendJson(response, 200, { disconnected: true }) }
  if (action === 'CREATE_FOLDER') return sendJson(response, 200, await createArchiveFolder(clients, context.organization.id, request.body?.folder_name))
  if (action === 'SET_SETTINGS') {
    const settings = { backup_enabled: request.body?.backup_enabled === true, backup_pickup: request.body?.backup_pickup !== false, backup_return: request.body?.backup_return !== false, updated_at: new Date().toISOString() }
    const { error } = await clients.checkvan.from('checkvan_cloud_connections').update(settings).eq('organization_id', context.organization.id)
    if (error) throw new Error('CLOUD_ARCHIVE_UNAVAILABLE')
    return sendJson(response, 200, await cloudArchiveStatus(clients, context.organization.id))
  }
  if (action === 'RETRY') {
    const { data, error } = await clients.checkvan.from('checkvan_cloud_document_syncs').select('inspection_id').eq('organization_id', context.organization.id).in('status', ['PENDING', 'FAILED']).limit(100)
    if (error) throw new Error('CLOUD_ARCHIVE_UNAVAILABLE')
    return sendJson(response, 200, await queueCloudSyncs(clients, context.organization.id, (data ?? []).map(item => item.inspection_id)))
  }
  if (action === 'EXPORT') return sendJson(response, 200, await queueCloudSyncs(clients, context.organization.id, Array.isArray(request.body?.inspection_ids) ? request.body.inspection_ids : []))
  return sendJson(response, 400, { error: 'INVALID_CLOUD_ARCHIVE_ACTION' })
}
const operationalCookie = value => `${sessionCookie}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`
const operationalUuid = value => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value ?? '')
async function operationalAccess(request, response, clients) {
  const action = request.query?.action
  if (action === 'manage') {
    const user = await authenticateRequest(request, clients), context = await resolveCompanyContext(user.id, clients)
    if (context.membership.role !== 'COMPANY_ADMIN') return sendJson(response, 403, { error: 'COMPANY_ADMIN_REQUIRED' })
    const driverId = request.method === 'GET' ? request.query?.driver_id : request.body?.driver_id
    if (!operationalUuid(driverId)) return sendJson(response, 400, { error: 'INVALID_DRIVER_ID' })
    const { data: driver } = await clients.checkvan.from('checkvan_drivers').select('id').eq('id', driverId).eq('organization_id', context.organization.id).eq('status', 'active').maybeSingle()
    if (!driver) return sendJson(response, 404, { error: 'DRIVER_NOT_FOUND' })
    if (request.method === 'GET') { const { data } = await clients.checkvan.from('checkvan_driver_access_tokens').select('id,created_at,last_used_at,status').eq('organization_id', context.organization.id).eq('driver_id', driverId).eq('status', 'active').maybeSingle(); return sendJson(response, 200, { token: data ?? null }) }
    if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
    const { data: active, error: activeError } = await clients.checkvan.from('checkvan_driver_access_tokens').select('id,created_at,last_used_at,status').eq('organization_id', context.organization.id).eq('driver_id', driverId).eq('status', 'active').maybeSingle()
    if (activeError) throw new Error('OPERATIONAL_ACCESS_UNAVAILABLE')
    if (active && request.body?.action !== 'REGENERATE') return sendJson(response, 200, { status: 'existing', token: active })
    if (active) {
      const { error: revokeError } = await clients.checkvan.from('checkvan_driver_access_tokens').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', active.id).eq('status', 'active')
      if (revokeError) throw new Error('OPERATIONAL_ACCESS_UNAVAILABLE')
    }
    const secret = newSecret()
    const { error } = await clients.checkvan.from('checkvan_driver_access_tokens').insert({ organization_id: context.organization.id, driver_id: driverId, token_hash: hashSecret(secret), created_by: user.id })
    if (error) throw new Error('OPERATIONAL_ACCESS_UNAVAILABLE')
    return sendJson(response, 201, { status: 'created', access_path: `/area-operativa/access/${secret}` })
  }
  if (action === 'exchange') {
    if (request.method !== 'POST' || typeof request.body?.token !== 'string' || request.body.token.length < 32) return sendJson(response, 400, { error: 'INVALID_ACCESS_TOKEN' })
    const { data } = await clients.checkvan.from('checkvan_driver_access_tokens').select('id,organization_id,driver_id').eq('token_hash', hashSecret(request.body.token)).eq('status', 'active').maybeSingle()
    if (!data) return sendJson(response, 401, { error: 'INVALID_ACCESS_TOKEN' })
    const secret = newSecret(), expires = new Date(Date.now() + 28800000).toISOString()
    const { error } = await clients.checkvan.from('checkvan_driver_access_sessions').insert({ organization_id: data.organization_id, driver_id: data.driver_id, session_hash: hashSecret(secret), expires_at: expires })
    if (error) throw new Error('OPERATIONAL_ACCESS_UNAVAILABLE')
    response.setHeader('Set-Cookie', operationalCookie(secret)); return sendJson(response, 200, { ok: true })
  }
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  return sendJson(response, 200, await driverWeek(clients, await operationalSession(request, clients), planningWeek(request.query?.week_start)))
}

async function companyPlanning(request, response, clients) {
  const { user, context } = await companyContext(request, clients)
  if (request.method === 'GET') {
    const start = planningWeek(request.query?.week_start)
    const [planning, drivers, vehicles] = await Promise.all([
      readPlanning(clients.checkvan, context.organization.id, start),
      clients.checkvan.from('checkvan_drivers').select('*').eq('organization_id', context.organization.id).order('last_name').order('first_name'),
      clients.checkvan.from('checkvan_vehicles').select('*').eq('organization_id', context.organization.id).order('internal_code'),
    ])
    if (drivers.error || vehicles.error) throw new Error('PLANNING_UNAVAILABLE')
    const referenced = new Set([...planning.entries, ...planning.effective].map(item => item.driver_id))
    return sendJson(response, 200, { ...planning, drivers: drivers.data.filter(row => row.status === 'active' || referenced.has(row.id)).map(publicDriver), vehicles: vehicles.data.map(publicVehicle) })
  }
  if (request.method === 'POST') return sendJson(response, 200, await mutatePlanning(clients.checkvan, context.organization.id, user.id, request.body))
  return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
}

async function deviceDriverAssignments(request, response, clients) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  const device = await authenticateDeviceRequest(request, clients, '/api/device-driver-assignments'), context = await resolveDeviceContext(device, clients)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(request.body?.date || '') ? request.body.date : new Date().toISOString().slice(0, 10)
  const [drivers, assignments] = await Promise.all([
    clients.checkvan.from('checkvan_drivers').select('id,driver_code,first_name,last_name').eq('organization_id', context.organization.id).eq('status', 'active').order('last_name').order('first_name'),
    clients.checkvan.from('checkvan_daily_assignments').select('id,assignment_date,driver_id,checkvan_vehicles!inner(*)').eq('organization_id', context.organization.id).eq('assignment_date', date).eq('checkvan_vehicles.status', 'active'),
  ])
  if (drivers.error || assignments.error) throw new Error('DRIVER_ASSIGNMENTS_UNAVAILABLE')
  return sendJson(response, 200, { date, items: (drivers.data ?? []).map((driver) => { const assignment = assignments.data?.find((item) => item.driver_id === driver.id); return { driver_id: driver.id, driver_code: driver.driver_code, first_name: driver.first_name, last_name: driver.last_name, assignment: assignment ? { assignment_id: assignment.id, assignment_date: assignment.assignment_date, vehicle: publicVehicle(assignment.checkvan_vehicles) } : null } }) })
}

const operationalToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const invalidOperationalQr = () => Object.assign(new Error('OPERATIONAL_QR_INVALID'), { status: 401 })
async function deviceOperationalAssignment(request, response, clients) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  const token = typeof request.body?.token === 'string' ? request.body.token : ''
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) throw invalidOperationalQr()
  const { data: access, error } = await clients.checkvan.from('checkvan_driver_access_tokens').select('organization_id,driver_id').eq('token_hash', hashSecret(token)).eq('status', 'active').maybeSingle()
  if (error) throw new Error('OPERATIONAL_ACCESS_UNAVAILABLE')
  if (!access) throw invalidOperationalQr()
  const date = operationalToday()
  const [planning, driverResult, vehiclesResult] = await Promise.all([
    readPlanning(clients.checkvan, access.organization_id, weekStart(date)),
    clients.checkvan.from('checkvan_drivers').select('id,first_name,last_name').eq('id', access.driver_id).eq('organization_id', access.organization_id).eq('status', 'active').maybeSingle(),
    clients.checkvan.from('checkvan_vehicles').select('id,internal_code,plate,silhouette_category').eq('organization_id', access.organization_id),
  ])
  if (driverResult.error || !driverResult.data || vehiclesResult.error) throw new Error('OPERATIONAL_DATA_UNAVAILABLE')
  const entry = planning.effective.find(item => item.driver_id === access.driver_id && item.assignment_date === date)
  const vehicle = entry?.vehicle_id ? (vehiclesResult.data ?? []).find(item => item.id === entry.vehicle_id) ?? null : null
  if (entry?.work_status === 'TURNO' && !vehicle) return sendJson(response, 200, { date, driver: driverResult.data, status: 'TURNO', assignment: null })
  return sendJson(response, 200, { date, driver: driverResult.data, status: entry?.work_status ?? 'ALTRO', assignment: entry?.work_status === 'TURNO' ? { vehicle_id: vehicle.id, internal_code: vehicle.internal_code, plate: vehicle.plate, silhouette_category: vehicle.silhouette_category, route: entry.route ?? null, notes: entry.notes ?? null, source: entry.source } : null })
}

async function companyDamagePhoto(request,response,clients){const{user,context}=await companyContext(request,clients);if(request.method!=='POST')return sendJson(response,405,{error:'METHOD_NOT_ALLOWED'});const action=request.body?.action??'VIEW';if(action==='CREATE'){if(!uuid(request.body?.vehicle_id))return sendJson(response,400,{error:'INVALID_VEHICLE_ID'});const d=damageInput(request.body),photo=damagePhotoInput(request.body),bucket='checkvan-vehicle-damages';let{data:damage,error}=await clients.checkvan.from('checkvan_vehicle_damages').select('*').eq('organization_id',context.organization.id).is('reported_by_device_id',null).eq('client_generated_id',photo.client_generated_id).maybeSingle();if(error)throw new Error('DAMAGES_UNAVAILABLE');if(!damage){const id=randomUUID(),ext={"image/jpeg":'jpg',"image/png":'png',"image/webp":'webp'}[photo.photo_mime_type],path=`organizations/${context.organization.id}/vehicles/${request.body.vehicle_id}/damages/${id}/original.${ext}`;({data:damage,error}=await clients.checkvan.from('checkvan_vehicle_damages').insert({id,organization_id:context.organization.id,vehicle_id:request.body.vehicle_id,damage_type:d.damage_type,vehicle_view:d.vehicle_view,normalized_x:d.x,normalized_y:d.y,status:'CONFIRMED',confirmed_by_auth_subject:user.id,confirmed_at:new Date().toISOString(),...photo,photo_bucket:bucket,photo_object_path:path,photo_upload_status:'UPLOADING'}).select('*').single());if(error)throw new Error('DAMAGE_CREATE_FAILED')}const{data:signed,error:signError}=await clients.checkvan.storage.from(damage.photo_bucket).createSignedUploadUrl(damage.photo_object_path,{upsert:false});if(signError)throw new Error('UPLOAD_AUTHORIZATION_FAILED');return sendJson(response,200,{damage:publicDamage(damage),signedUploadUrl:signed.signedUrl})}if(action==='FINALIZE'){if(!uuid(request.body?.damage_id))return sendJson(response,400,{error:'INVALID_DAMAGE_ID'});const{data:damage}=await clients.checkvan.from('checkvan_vehicle_damages').select('*').eq('id',request.body.damage_id).eq('organization_id',context.organization.id).maybeSingle();if(!damage)throw Object.assign(new Error('DAMAGE_NOT_FOUND'),{status:404});const parts=damage.photo_object_path.split('/'),file=parts.pop(),folder=parts.join('/'),{data:objects,error:storageError}=await clients.checkvan.storage.from(damage.photo_bucket).list(folder,{search:file,limit:2}),object=objects?.find(item=>item.name===file);if(storageError||!object)throw Object.assign(new Error('UPLOAD_NOT_FOUND'),{status:409});if(Number(object.metadata?.size)!==Number(damage.photo_size_bytes))throw Object.assign(new Error('UPLOAD_SIZE_MISMATCH'),{status:409});const{data,error}=await clients.checkvan.rpc('internal_admin_finalize_checkvan_damage_photo',{p_auth_subject:user.id,p_organization_id:context.organization.id,p_damage_id:damage.id});if(error)throw Object.assign(new Error(error.message),{status:400});return sendJson(response,200,publicDamage(data))}if(!uuid(request.body?.damage_id))return sendJson(response,400,{error:'INVALID_DAMAGE_ID'});const{data:damage,error}=await clients.checkvan.from('checkvan_vehicle_damages').select('photo_bucket,photo_object_path,photo_upload_status').eq('id',request.body.damage_id).eq('organization_id',context.organization.id).maybeSingle();if(error)throw new Error('DAMAGES_UNAVAILABLE');if(!damage||damage.photo_upload_status!=='AVAILABLE')return sendJson(response,404,{error:'DAMAGE_PHOTO_NOT_FOUND'});const{data:signed,error:signError}=await clients.checkvan.storage.from(damage.photo_bucket).createSignedUrl(damage.photo_object_path,300);if(signError)throw new Error('PHOTO_AUTHORIZATION_FAILED');return sendJson(response,200,{signedUrl:signed.signedUrl,expiresIn:300})}

const publicPaths = [
  '/',
  '/applicazioni',
  '/applicazioni/nacscan',
  '/nacscan',
  '/applicazioni/nacscan/privacy',
  '/applicazioni/shopping-voice',
  '/applicazioni/shopping-voice/privacy',
  '/applicazioni/driver-utility',
  '/applicazioni/driver-utility/privacy',
  '/area-driver',
  '/area-driver/normativa',
  '/area-driver/backup',
  '/area-driver/ccnl-logistica-trasporto-merci-spedizione',
  '/area-driver/accordo-asso-espressi-ultimo-miglio-2025',
  '/applicazioni/checkvan-pro',
  '/applicazioni/checkvan-pro/privacy',
  '/software/observa-poker',
  '/chi-siamo',
  '/contatti',
  '/privacy',
  '/privacy/sito-web',
]
function seo(request, response) {
  const forwarded = request.headers['x-forwarded-host']
  const host = (Array.isArray(forwarded) ? forwarded[0] : forwarded ?? request.headers.host ?? '').split(',')[0].trim().split(':')[0].toLowerCase().replace(/^www\./, '')
  const origin = host === 'dtosolution.com' ? 'https://www.dtosolution.com' : 'https://www.dtosolution.it'
  response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600')
  if (request.query.type === 'robots') { response.setHeader('Content-Type', 'text/plain; charset=utf-8'); return response.status(200).send(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`) }
  response.setHeader('Content-Type', 'application/xml; charset=utf-8')
  return response.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicPaths.map(path => `  <url>\n    <loc>${origin}${path}</loc>\n  </url>`).join('\n')}\n</urlset>\n`)
}

export default async function handler(request, response) {
  try {
    const resource = request.query?.resource
    if (handleDeviceCors(request, response, resource)) return
    if (resource === 'seo') return seo(request, response)
    if (resource === 'super-admin') return superAdminHandler(request, response)
    const clients = clientsFromEnvironment()
    if (resource === 'company-vehicles') return await companyVehicles(request, response, clients)
    if (resource === 'company-vehicle') return await companyVehicle(request, response, clients)
    if (resource === 'company-damages') return await companyDamages(request, response, clients)
    if (resource === 'company-damage-photo') return await companyDamagePhoto(request, response, clients)
    if (resource === 'device-vehicles') return await deviceVehicles(request, response, clients)
    if (resource === 'device-damages') return await deviceDamages(request, response, clients)
    if (resource === 'device-vehicle-reports') return await deviceVehicleReports(request,response,clients)
    if (resource === 'company-vehicle-reports') return await companyVehicleReports(request,response,clients)
    if (resource === 'company-drivers') return await companyDrivers(request, response, clients)
    if (resource === 'company-assignments') return await companyAssignments(request, response, clients)
    if (resource === 'company-cloud') return await companyCloudArchive(request, response, clients)
    if (resource === 'company-planning') return await companyPlanning(request, response, clients)
    if (resource === 'operational-access') return await operationalAccess(request, response, clients)
    if (resource === 'device-driver-assignments') return await deviceDriverAssignments(request, response, clients)
    if (resource === 'device-operational-assignment') return await deviceOperationalAssignment(request, response, clients)
    return sendJson(response, 404, { error: 'NOT_FOUND' })
  } catch (error) { return sendError(response, error) }
}
import { randomUUID } from 'node:crypto'
