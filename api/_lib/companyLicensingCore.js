export const COMPANY_ROLES = new Set(['COMPANY_ADMIN', 'COMPANY_OPERATOR', 'UNION_GUEST'])

export function membershipAllowed(membership) {
  return Boolean(membership && membership.status === 'active' && COMPANY_ROLES.has(membership.role))
}

export function capabilitiesFor(role, entitlementValid) {
  if (role === 'UNION_GUEST') return { useTools: true, manageDevices: false, viewInspections: false, deleteInspections: false }
  return {
    useTools: Boolean(entitlementValid),
    manageDevices: Boolean(entitlementValid && role === 'COMPANY_ADMIN'),
    viewInspections: Boolean(entitlementValid),
    deleteInspections: Boolean(entitlementValid && role === 'COMPANY_ADMIN'),
  }
}

export function effectiveEntitlement(licenseState, grants = [], now = new Date()) {
  const timestamp = now.getTime()
  const grant = grants.find((item) => item.grant_type === 'FOUNDER'
    && item.status === 'active'
    && (!item.starts_at || new Date(item.starts_at).getTime() <= timestamp)
    && (!item.ends_at || new Date(item.ends_at).getTime() > timestamp))
  if (grant) return { valid: true, source: grant.grant_type.toLowerCase(), cloudEnabled: true, grant }
  const licenseSource = licenseState.license?.access_grant?.toLowerCase()
  return {
    valid: Boolean(licenseState.valid),
    source: licenseState.valid ? (licenseSource ?? (licenseState.license?.kind === 'trial' ? 'trial' : 'paid')) : null,
    cloudEnabled: Boolean(licenseState.valid && licenseState.license?.product_mode !== 'personal' && licenseState.license?.cloud_enabled !== false),
    grant: null,
  }
}

export function deriveLicenseState(organization, licenses, now = new Date()) {
  if (!organization) return { state: 'no_organization', license: null, valid: false }
  if (organization.status === 'suspended') return { state: 'organization_suspended', license: null, valid: false }
  if (organization.status === 'closed') return { state: 'organization_closed', license: null, valid: false }
  if (organization.status !== 'active') return { state: 'organization_inactive', license: null, valid: false }

  const timestamp = now.getTime()
  const active = licenses.find((license) => license.status === 'active'
    && new Date(license.starts_at).getTime() <= timestamp
    && (!license.ends_at || new Date(license.ends_at).getTime() > timestamp))
  if (active) return { state: active.kind === 'trial' ? 'active_trial' : 'active_license', license: active, valid: true }
  if (!licenses.length) return { state: 'no_license', license: null, valid: false }
  const selected = licenses[0]
  if (licenses.some((license) => license.status === 'suspended')) return { state: 'license_suspended', license: licenses.find((license) => license.status === 'suspended'), valid: false }
  if (licenses.some((license) => license.status === 'revoked')) return { state: 'revoked', license: licenses.find((license) => license.status === 'revoked'), valid: false }
  if (licenses.some((license) => license.status === 'expired' || (license.ends_at && new Date(license.ends_at).getTime() <= timestamp))) return { state: 'expired', license: licenses.find((license) => license.status === 'expired' || (license.ends_at && new Date(license.ends_at).getTime() <= timestamp)), valid: false }
  if (licenses.some((license) => new Date(license.starts_at).getTime() > timestamp)) return { state: 'not_started', license: licenses.find((license) => new Date(license.starts_at).getTime() > timestamp), valid: false }
  return { state: 'no_license', license: selected, valid: false }
}

export function enrollmentPayload(token) {
  return `checkvan-enroll:v1:${token}`
}

export const normalizePlate = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')

export function validateInspectionInput(value) {
  if (!value || !['pickup', 'return'].includes(value.inspectionType)) return 'INVALID_INSPECTION_TYPE'
  if (!normalizePlate(value.vehiclePlate)) return 'INVALID_VEHICLE_PLATE'
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value.inspectedAt ?? '')) return 'INVALID_INSPECTION_TIME'
  if (!/^[a-f0-9]{64}$/.test(value.documentHash ?? '')) return 'INVALID_DOCUMENT_HASH'
  if (!Number.isInteger(value.documentSizeBytes) || value.documentSizeBytes < 1 || value.documentSizeBytes > 40 * 1024 * 1024) return 'INVALID_DOCUMENT_SIZE'
  if (!/^[0-9a-f-]{36}$/i.test(value.deviceGeneratedId ?? '')) return 'INVALID_DEVICE_GENERATED_ID'
  if (value.vehicleId != null && !/^[0-9a-f-]{36}$/i.test(value.vehicleId)) return 'INVALID_VEHICLE_ID'
  const hasDriver = value.driverId != null || value.driverFirstName != null || value.driverLastName != null || value.assignmentDate != null
  if (hasDriver && (!/^[0-9a-f-]{36}$/i.test(value.driverId ?? '') || typeof value.driverFirstName !== 'string' || !value.driverFirstName.trim() || value.driverFirstName.length > 100 || typeof value.driverLastName !== 'string' || !value.driverLastName.trim() || value.driverLastName.length > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(value.assignmentDate ?? '') || !value.vehicleId)) return 'INVALID_DRIVER_ASSIGNMENT'
  return null
}

export function publicDevice(assignment, device, index) {
  return {
    id: device.id,
    label: `Dispositivo ${index + 1}`,
    status: assignment.status,
    assignedAt: assignment.assigned_at,
    lastValidatedAt: device.last_validated_at,
    releasedAt: assignment.released_at,
  }
}
