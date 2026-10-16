import { normalizeConvocationDriverName } from '../../company/src/lib/convocationDefinitiveCore.js'
import { uuid } from './companyVehicles.js'

const sources = new Set(['convocation', 'assignment_departure'])
const invalid = (message) => { throw Object.assign(new Error(message), { status: 400 }) }

export function driverNameVariantInput(body = {}) {
  const driver_id = uuid(body.driver_id) ? body.driver_id : null
  const source = typeof body.source === 'string' ? body.source : ''
  const normalized_name = typeof body.normalized_name === 'string' ? body.normalized_name : ''
  if (!driver_id || !sources.has(source) || !normalized_name || normalized_name.length > 300 || normalizeConvocationDriverName(normalized_name) !== normalized_name) invalid('INVALID_DRIVER_NAME_VARIANT')
  return { driver_id, source, normalized_name }
}

export function driverNameVariantRevocationInput(body = {}) {
  const variant_id = uuid(body.variant_id) ? body.variant_id : null
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (!variant_id || !reason || reason.length > 1000) invalid('INVALID_DRIVER_NAME_VARIANT_REVOCATION')
  return { variant_id, reason }
}

export async function confirmDriverNameVariant(client, organizationId, userId, body) {
  const input = driverNameVariantInput(body)
  const { data, error } = await client.rpc('internal_admin_confirm_driver_name_variant', { p_auth_subject: userId, p_organization_id: organizationId, p_input: input })
  if (error) throw Object.assign(new Error(error.message), { status: error.code === '23505' ? 409 : 400 })
  return data
}

export async function revokeDriverNameVariant(client, organizationId, userId, body) {
  const input = driverNameVariantRevocationInput(body)
  const { data, error } = await client.rpc('internal_admin_revoke_driver_name_variant', { p_auth_subject: userId, p_organization_id: organizationId, p_variant_id: input.variant_id, p_reason: input.reason })
  if (error) throw Object.assign(new Error(error.message), { status: 400 })
  return data
}
