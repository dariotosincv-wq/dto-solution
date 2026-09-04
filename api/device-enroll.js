import { clientsFromEnvironment, sendError, sendJson } from './_lib/companyLicensing.js'
import { verifyDeviceSignature } from './_lib/deviceAuthentication.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  const { challengeId, purpose, signatureBase64 } = request.body ?? {}
  if (typeof challengeId !== 'string' || !['company_enrollment', 'founder_activation'].includes(purpose) || typeof signatureBase64 !== 'string') return sendJson(response, 400, { error: 'INVALID_ENROLLMENT_REQUEST' })
  try {
    const clients = clientsFromEnvironment()
    const { data: challenge, error: challengeError } = await clients.checkvan.rpc('internal_get_checkvan_challenge_key', { p_challenge_id: challengeId, p_purpose: purpose })
    if (challengeError || !challenge?.public_key_spki_base64 || !verifyDeviceSignature(challenge.public_key_spki_base64, signatureBase64, challenge.nonce)) {
      throw Object.assign(new Error('ENROLLMENT_SIGNATURE_INVALID'), { status: 401 })
    }
    const { data, error } = await clients.checkvan.rpc('internal_complete_checkvan_enrollment', { p_challenge_id: challengeId, p_purpose: purpose })
    if (error) throw Object.assign(new Error(error.message?.includes('SLOT_LIMIT_REACHED') ? 'NO_DEVICE_SLOTS' : 'ENROLLMENT_FAILED'), { status: 400 })
    return sendJson(response, 201, { ...data, protocolVersion: 1, cloudEnabled: true })
  } catch (error) { return sendError(response, error) }
}
