import { clientsFromEnvironment, sendError, sendJson } from './_lib/companyLicensing.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  const { purpose, token, keyId, deviceKeyId, keyVersion, publicKeySpkiBase64 } = request.body ?? {}
  if (!['company_enrollment', 'founder_activation'].includes(purpose)) return sendJson(response, 400, { error: 'INVALID_ENROLLMENT_PURPOSE' })
  try {
    const clients = clientsFromEnvironment()
    const { data, error } = await clients.checkvan.rpc('internal_create_checkvan_challenge', {
      p_purpose: purpose, p_key_id: keyId, p_device_key_id: deviceKeyId, p_key_version: keyVersion,
      p_public_key_spki_base64: publicKeySpkiBase64, p_token: token,
    })
    if (error) throw Object.assign(new Error('ENROLLMENT_CHALLENGE_FAILED'), { status: 400 })
    return sendJson(response, 201, { ...data, purpose, signatureAlgorithm: 'ECDSA_P256_SHA256' })
  } catch (error) { return sendError(response, error) }
}
