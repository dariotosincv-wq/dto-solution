import { createHash } from 'node:crypto'
import { clientsFromEnvironment, sendError, sendJson } from './companyLicensing.js'

const columns = 'id,pdv,city,province,driver,qr_text,latitude,longitude,accuracy,created_at'
const origins = new Set(['capacitor://localhost', 'http://localhost', 'https://localhost'])
const clean = (value, max) => typeof value === 'string' && value.trim().length <= max ? value.trim() : ''
const province = value => /^[A-Z]{2}$/.test(String(value ?? '').trim().toUpperCase()) ? String(value).trim().toUpperCase() : null

const rateKey = request => {
  const source = String(request.headers['x-forwarded-for'] ?? request.headers['x-real-ip'] ?? '').split(',')[0].trim()
  const salt = process.env.QR_HUB_RATE_LIMIT_SALT
  if (!source || !salt) throw Object.assign(new Error('QR_HUB_RATE_LIMIT_UNAVAILABLE'), { status: 503 })
  return createHash('sha256').update(`${salt}:${source}`).digest('hex')
}

export function handlePublicQrHubCors(request, response) {
  if (origins.has(request.headers.origin)) response.setHeader('Access-Control-Allow-Origin', request.headers.origin)
  response.setHeader('Vary', 'Origin')
  response.setHeader('Access-Control-Allow-Headers', 'content-type')
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (request.method === 'OPTIONS') { response.status(204).end(); return true }
  return false
}

export async function handlePublicQrHubs(request, response, dependencies = {}) {
  if (handlePublicQrHubCors(request, response)) return
  try {
    if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
    const body = request.body ?? {}
    const db = dependencies.clients?.checkvan ?? clientsFromEnvironment().checkvan
    const selectedProvince = province(body.province)
    if (body.action === 'cities' || body.action === 'list') {
      if (!selectedProvince) return sendJson(response, 400, { error: 'QR_HUB_PROVINCE_INVALID' })
      let query = db.from('qr_locali').select(columns).eq('province', selectedProvince).not('city', 'is', null).order('city')
      if (body.action === 'list') {
        const city = clean(body.city, 160)
        if (!city) return sendJson(response, 400, { error: 'QR_HUB_CITY_INVALID' })
        query = query.ilike('city', city)
      }
      const { data, error } = await query
      if (error) throw new Error('QR_HUB_UNAVAILABLE')
      return sendJson(response, 200, { items: data ?? [] })
    }
    if (body.action !== 'submit') return sendJson(response, 400, { error: 'QR_HUB_ACTION_INVALID' })
    const selectedCity = clean(body.city, 160)
    const pdv = clean(body.pdv, 160)
    const qrText = clean(body.qr_text, 4096)
    if (!selectedProvince || !selectedCity || !pdv || !qrText) return sendJson(response, 400, { error: 'QR_HUB_INPUT_INVALID' })
    const { data, error } = await db.rpc('internal_submit_public_qr_hub', {
      p_rate_key: rateKey(request), p_pdv: pdv, p_city: selectedCity, p_province: selectedProvince,
      p_driver: clean(body.driver, 40), p_qr_text: qrText,
      p_latitude: Number.isFinite(body.latitude) ? body.latitude : null,
      p_longitude: Number.isFinite(body.longitude) ? body.longitude : null,
      p_accuracy: Number.isFinite(body.accuracy) ? body.accuracy : null,
    })
    if (error) return sendJson(response, error.message === 'QR_HUB_RATE_LIMITED' ? 429 : 400, { error: error.message })
    return sendJson(response, 201, { item: data?.[0] ?? null })
  } catch (error) {
    return sendError(response, error)
  }
}
