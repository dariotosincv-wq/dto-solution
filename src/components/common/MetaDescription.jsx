import { useEffect } from 'react'
import { useI18n } from '../../i18n/useI18n.js'

function MetaDescription({ canonical, content, openGraphUrl, title }) {
  const { language, origin, t } = useI18n()

  useEffect(() => {
    const meta = document.querySelector('meta[name="description"]')
    const canonicalLink = document.querySelector('link[rel="canonical"]')
    const openGraphUrlMeta = document.querySelector('meta[property="og:url"]')
    const openGraphTitleMeta = document.querySelector('meta[property="og:title"]')
    const openGraphDescriptionMeta = document.querySelector('meta[property="og:description"]')

    if (!meta) return undefined

    const previousContent = meta.getAttribute('content')
    const previousCanonical = canonicalLink?.getAttribute('href')
    const previousOpenGraphUrl = openGraphUrlMeta?.getAttribute('content')
    const previousOpenGraphTitle = openGraphTitleMeta?.getAttribute('content')
    const previousOpenGraphDescription = openGraphDescriptionMeta?.getAttribute('content')
    const previousTitle = document.title

    const localizedContent = t(content)
    const localizedTitle = title ? t(title) : null
    const localizeUrl = (url) => {
      if (!url) return url
      const parsed = new URL(url)
      return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`
    }

    meta.setAttribute('content', localizedContent)
    openGraphDescriptionMeta?.setAttribute('content', localizedContent)
    if (canonical) canonicalLink?.setAttribute('href', localizeUrl(canonical))
    if (openGraphUrl) openGraphUrlMeta?.setAttribute('content', localizeUrl(openGraphUrl))
    if (localizedTitle) {
      document.title = localizedTitle
      openGraphTitleMeta?.setAttribute('content', localizedTitle)
    }

    return () => {
      meta.setAttribute('content', previousContent ?? '')
      if (previousCanonical) canonicalLink?.setAttribute('href', previousCanonical)
      if (previousOpenGraphUrl) openGraphUrlMeta?.setAttribute('content', previousOpenGraphUrl)
      if (previousOpenGraphTitle) openGraphTitleMeta?.setAttribute('content', previousOpenGraphTitle)
      if (previousOpenGraphDescription) openGraphDescriptionMeta?.setAttribute('content', previousOpenGraphDescription)
      document.title = previousTitle
    }
  }, [canonical, content, language, openGraphUrl, origin, t, title])

  return null
}

export default MetaDescription
