import { authenticateRequest } from './companyLicensing.js'

export async function authenticateAdmin(request, clients) {
  const user = await authenticateRequest(request, clients)
  const allowed = new Set((process.env.DTO_ADMIN_SUBJECTS ?? '').split(',').map((value) => value.trim()).filter(Boolean))
  if (!allowed.has(user.id)) throw Object.assign(new Error('ADMIN_FORBIDDEN'), { status: 403 })
  return user
}
