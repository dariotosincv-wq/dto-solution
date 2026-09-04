const totpFactors = (data) => Array.isArray(data?.totp) ? data.totp : []

const failure = (error, fallback) => {
  if (error) throw new Error(error.message || fallback)
}

export async function readMfaState(client) {
  const factorsResult = await client.auth.mfa.listFactors()
  failure(factorsResult.error, 'MFA_FACTORS_UNAVAILABLE')
  const aalResult = await client.auth.mfa.getAuthenticatorAssuranceLevel()
  failure(aalResult.error, 'MFA_AAL_UNAVAILABLE')
  const factors = totpFactors(factorsResult.data)
  return {
    verified: factors.filter((factor) => factor.status === 'verified'),
    unverified: factors.filter((factor) => factor.status !== 'verified'),
    currentLevel: aalResult.data?.currentLevel ?? null,
    nextLevel: aalResult.data?.nextLevel ?? null,
  }
}

export async function beginTotpEnrollment(client) {
  const state = await readMfaState(client)
  if (state.verified.length) return { kind: 'verified', state }

  for (const factor of state.unverified) {
    const result = await client.auth.mfa.unenroll({ factorId: factor.id })
    failure(result.error, 'MFA_UNVERIFIED_CLEANUP_FAILED')
  }

  const result = await client.auth.mfa.enroll({ factorType: 'totp' })
  failure(result.error, 'MFA_ENROLL_FAILED')
  if (!result.data?.id || !result.data?.totp?.qr_code || !result.data?.totp?.secret) throw new Error('MFA_ENROLL_INVALID_RESPONSE')
  return {
    kind: 'enrollment',
    factorId: result.data.id,
    qrCode: result.data.totp.qr_code,
    secret: result.data.totp.secret,
  }
}

export async function verifyTotpCode(client, { factorId, code }) {
  if (!factorId || !/^\d{6}$/.test(code)) throw new Error('MFA_CODE_INVALID')
  const challengeResult = await client.auth.mfa.challenge({ factorId })
  failure(challengeResult.error, 'MFA_CHALLENGE_FAILED')
  const verifyResult = await client.auth.mfa.verify({ factorId, challengeId: challengeResult.data.id, code })
  failure(verifyResult.error, 'MFA_VERIFY_FAILED')

  let aalResult = await client.auth.mfa.getAuthenticatorAssuranceLevel()
  failure(aalResult.error, 'MFA_AAL_UNAVAILABLE')
  if (aalResult.data?.currentLevel !== 'aal2') {
    const refreshResult = await client.auth.refreshSession()
    failure(refreshResult.error, 'MFA_SESSION_REFRESH_FAILED')
    aalResult = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    failure(aalResult.error, 'MFA_AAL_UNAVAILABLE')
  }
  if (aalResult.data?.currentLevel !== 'aal2') throw new Error('MFA_AAL2_NOT_REACHED')
  return { currentLevel: 'aal2', nextLevel: aalResult.data.nextLevel ?? 'aal2' }
}
