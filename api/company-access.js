import { authenticateRequest, clientsFromEnvironment, resolveCompanyContext, sendError, sendJson } from './_lib/companyLicensing.js'
import { trialEligibilityFor } from './_lib/companyTrial.js'

export default async function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  try {
    const clients = clientsFromEnvironment()
    const user = await authenticateRequest(request, clients)
    let context
    try {
      context = await resolveCompanyContext(user.id, clients)
    } catch (error) {
      if (error.message === 'MEMBERSHIP_REQUIRED') {
        return sendJson(response, 200, {
          role: null, state: 'no_membership', organization: null, license: null,
          devices: null, capabilities: {}, entitlement: null,
          trialEligibility: trialEligibilityFor(user),
        })
      }
      if (error.message === 'MEMBERSHIP_DENIED') {
        return sendJson(response, 200, {
          role: null, state: 'membership_unavailable', organization: null, license: null,
          devices: null, capabilities: {}, entitlement: null,
          trialEligibility: { eligible: false, reason: 'MEMBERSHIP_UNAVAILABLE' },
        })
      }
      throw error
    }
    return sendJson(response, 200, {
      role: context.membership.role, state: context.state, organization: context.organization,
      license: context.license ? { id: context.license.id, kind: context.license.kind, accessGrant: context.license.access_grant, status: context.license.status, capacity: context.license.capacity, startsAt: context.license.starts_at, endsAt: context.license.ends_at } : null,
      devices: context.devices, capabilities: context.capabilities, entitlement: context.entitlement,
      trialEligibility: { eligible: false, reason: 'MEMBERSHIP_ALREADY_EXISTS' },
    })
  } catch (error) { return sendError(response, error) }
}
