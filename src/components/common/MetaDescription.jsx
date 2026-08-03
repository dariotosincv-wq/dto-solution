import { useEffect } from 'react'

function MetaDescription({ canonical, content, openGraphUrl }) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="description"]')
    const canonicalLink = document.querySelector('link[rel="canonical"]')
    const openGraphUrlMeta = document.querySelector('meta[property="og:url"]')

    if (!meta) return undefined

    const previousContent = meta.getAttribute('content')
    const previousCanonical = canonicalLink?.getAttribute('href')
    const previousOpenGraphUrl = openGraphUrlMeta?.getAttribute('content')

    meta.setAttribute('content', content)
    if (canonical) canonicalLink?.setAttribute('href', canonical)
    if (openGraphUrl) openGraphUrlMeta?.setAttribute('content', openGraphUrl)

    return () => {
      meta.setAttribute('content', previousContent ?? '')
      if (previousCanonical) canonicalLink?.setAttribute('href', previousCanonical)
      if (previousOpenGraphUrl) openGraphUrlMeta?.setAttribute('content', previousOpenGraphUrl)
    }
  }, [canonical, content, openGraphUrl])

  return null
}

export default MetaDescription
