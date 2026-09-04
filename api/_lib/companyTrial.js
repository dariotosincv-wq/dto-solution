const DEFAULT_CAPACITY = 10
const DEFAULT_TRIAL_DAYS = 30

export function trialEligibilityFor(user) {
  if (!user?.id || user.is_anonymous) return { eligible: false, reason: 'AUTHENTICATED_USER_REQUIRED' }
  if (!user.email || !(user.email_confirmed_at ?? user.confirmed_at)) return { eligible: false, reason: 'VERIFIED_EMAIL_REQUIRED' }
  if (user.app_metadata?.checkvan_trial_eligible !== true) return { eligible: false, reason: 'TRIAL_INVITATION_REQUIRED' }
  return { eligible: true, reason: null }
}

export async function provisionCompanyTrial(user, body, clients) {
  const eligibility = trialEligibilityFor(user)
  if (!eligibility.eligible) throw Object.assign(new Error('TRIAL_NOT_ELIGIBLE'), { status: 403 })
  if (body?.authSubject != null || body?.auth_subject != null || body?.organizationId != null || body?.organization_id != null) {
    throw Object.assign(new Error('FORBIDDEN_PROVISIONING_FIELD'), { status: 400 })
  }

  const organizationName = typeof body?.organizationName === 'string' ? body.organizationName.trim() : ''
  if (organizationName.length < 2 || organizationName.length > 200) {
    throw Object.assign(new Error('INVALID_ORGANIZATION_NAME'), { status: 400 })
  }

  const { data, error } = await clients.checkvan.rpc('self_provision_checkvan_trial', {
    p_auth_subject: user.id,
    p_organization_name: organizationName,
    p_capacity: DEFAULT_CAPACITY,
    p_trial_days: DEFAULT_TRIAL_DAYS,
  })
  if (error || !data) {
    const conflict = /MEMBERSHIP_ALREADY_EXISTS|IDEMPOTENCY_KEY_CONFLICT|INCONSISTENT_TRIAL_PROVISIONING/.test(error?.message ?? '')
    throw Object.assign(new Error(conflict ? 'TRIAL_NOT_AVAILABLE' : 'TRIAL_PROVISIONING_FAILED'), { status: conflict ? 409 : 500 })
  }

  const enrollmentToken = data.status === 'created' && data.tokens_recoverable === true && typeof data.tokens?.[0] === 'string'
    ? data.tokens[0]
    : null
  return {
    status: data.status,
    organizationId: data.organization_id,
    licenseId: data.license_id,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    capacity: data.capacity,
    enrollmentToken,
    tokenRecoverable: Boolean(enrollmentToken),
  }
}
