import { inspectionListQuery, publicInspection } from './_lib/companyInspections.js'
import { authenticateRequest, clientsFromEnvironment, resolveCompanyContext, sendError, sendJson } from './_lib/companyLicensing.js'

export default async function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  try {
    const clients = clientsFromEnvironment(); const user = await authenticateRequest(request, clients); const context = await resolveCompanyContext(user.id, clients)
    if (!context.capabilities.viewInspections || !context.organization) return sendJson(response, 403, { error: 'INSPECTIONS_FORBIDDEN' })
    const filters = inspectionListQuery(request.query)
    let query = clients.checkvan.from('checkvan_inspections')
      .select('id,inspection_type,vehicle_plate,vehicle_description,inspection_cycle_id,inspected_at,device_timezone,upload_status,document_hash,document_size_bytes,device_id,finalized_at,retention_expires_at', { count: 'exact' })
      .eq('organization_id', context.organization.id).eq('upload_status', 'available').order('inspected_at', { ascending: false }).range(filters.from, filters.to)
    if (filters.dateFrom) query = query.gte('inspected_at', filters.dateFrom)
    if (filters.dateTo) query = query.lte('inspected_at', filters.dateTo)
    if (filters.plate) query = query.eq('vehicle_plate_normalized', filters.plate)
    if (filters.inspectionType) query = query.eq('inspection_type', filters.inspectionType)
    const { data, count, error } = await query
    if (error) throw new Error('INSPECTIONS_UNAVAILABLE')
    return sendJson(response, 200, { items: (data ?? []).map(publicInspection), total: count ?? 0, page: filters.from / filters.limit, limit: filters.limit })
  } catch (error) { return sendError(response, error) }
}
