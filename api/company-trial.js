import { trialEligibilityFor, provisionCompanyTrial } from './_lib/companyTrial.js'
import { authenticateRequest, clientsFromEnvironment, sendError, sendJson } from './_lib/companyLicensing.js'

export function createCompanyTrialHandler({ createClients = clientsFromEnvironment, authenticate = authenticateRequest } = {}) {
  return async function handler(request, response) {
    if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
    try {
      const clients = createClients()
      const user = await authenticate(request, clients)
      const eligibility = trialEligibilityFor(user)
      if (!eligibility.eligible) return sendJson(response, 403, { error: 'TRIAL_NOT_ELIGIBLE', reason: eligibility.reason })
      return sendJson(response, 201, await provisionCompanyTrial(user, request.body, clients))
    } catch (error) {
      return sendError(response, error)
    }
  }
}

export default createCompanyTrialHandler()
