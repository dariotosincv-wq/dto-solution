const publicPaths = [
  '/',
  '/applicazioni',
  '/applicazioni/nacscan',
  '/applicazioni/nacscan/privacy',
  '/applicazioni/shopping-voice',
  '/applicazioni/shopping-voice/privacy',
  '/applicazioni/driver-utility',
  '/applicazioni/driver-utility/privacy',
  '/applicazioni/checkvan-pro',
  '/applicazioni/checkvan-pro/privacy',
  '/verifica-checkvan',
  '/software/observa-poker',
  '/chi-siamo',
  '/contatti',
  '/privacy',
  '/privacy/sito-web',
]

function getHostname(request) {
  const forwardedHost = request.headers['x-forwarded-host']
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost ?? request.headers.host ?? ''
  return host.split(',')[0].trim().split(':')[0].toLowerCase().replace(/^www\./, '')
}

function getOrigin(request) {
  return getHostname(request) === 'dtosolution.com'
    ? 'https://www.dtosolution.com'
    : 'https://www.dtosolution.it'
}

function createSitemap(origin) {
  const urls = publicPaths
    .map((path) => `  <url>\n    <loc>${origin}${path}</loc>\n  </url>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export default function handler(request, response) {
  const origin = getOrigin(request)

  response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600')

  if (request.query.type === 'robots') {
    response.setHeader('Content-Type', 'text/plain; charset=utf-8')
    return response.status(200).send(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`)
  }

  response.setHeader('Content-Type', 'application/xml; charset=utf-8')
  return response.status(200).send(createSitemap(origin))
}
