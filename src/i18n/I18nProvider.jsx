import { useEffect, useMemo } from 'react'
import { englishTranslations } from './translations.js'
import { I18nContext } from './i18nContext.js'

const domains = {
  it: 'www.dtosolution.it',
  en: 'www.dtosolution.com',
}

function detectLanguage() {
  const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '')
  return hostname === 'dtosolution.com' ? 'en' : 'it'
}

function translateValue(value) {
  const leading = value.match(/^\s*/)?.[0] ?? ''
  const trailing = value.match(/\s*$/)?.[0] ?? ''
  const normalized = value.trim()
  const translated = englishTranslations[normalized]
  return translated ? `${leading}${translated}${trailing}` : value
}

function translateAttributeValue(value) {
  if (englishTranslations[value]) return englishTranslations[value]
  return value.replace(': materiale non ancora disponibile', ': material not yet available')
}

function translateElement(root) {
  if (!root) return

  if (root.nodeType === Node.TEXT_NODE) {
    if (root.parentElement?.closest('[data-i18n-ignore]')) return
    const translated = translateValue(root.nodeValue ?? '')
    if (translated !== root.nodeValue) root.nodeValue = translated
    return
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return

  if (root.nodeType === Node.ELEMENT_NODE) {
    if (root.tagName === 'A' && !root.closest('[data-i18n-ignore]')) {
      const href = root.getAttribute('href')
      if (href?.startsWith('https://dtosolution.it') || href?.startsWith('https://www.dtosolution.it')) {
        const parsed = new URL(href)
        root.setAttribute('href', `https://www.dtosolution.com${parsed.pathname}${parsed.search}${parsed.hash}`)
      }
    }

    for (const attribute of ['alt', 'aria-label', 'placeholder', 'title']) {
      const value = root.getAttribute(attribute)
      if (!value) continue
      const translated = translateAttributeValue(value)
      if (translated !== value) root.setAttribute(attribute, translated)
    }
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let textNode = walker.nextNode()

  while (textNode) {
    if (textNode.parentElement?.closest('[data-i18n-ignore]')) {
      textNode = walker.nextNode()
      continue
    }
    const translated = translateValue(textNode.nodeValue ?? '')
    if (translated !== textNode.nodeValue) textNode.nodeValue = translated
    textNode = walker.nextNode()
  }

  if (root.querySelectorAll) {
    root.querySelectorAll('a[href]').forEach((anchor) => {
      if (anchor.closest('[data-i18n-ignore]')) return
      const href = anchor.getAttribute('href')
      if (href?.startsWith('https://dtosolution.it') || href?.startsWith('https://www.dtosolution.it')) {
        const parsed = new URL(href)
        anchor.setAttribute('href', `https://www.dtosolution.com${parsed.pathname}${parsed.search}${parsed.hash}`)
      }
    })

    root.querySelectorAll('[alt], [aria-label], [placeholder], [title]').forEach((element) => {
      for (const attribute of ['alt', 'aria-label', 'placeholder', 'title']) {
        const value = element.getAttribute(attribute)
        if (!value) continue
        const translated = translateAttributeValue(value)
        if (translated !== value) element.setAttribute(attribute, translated)
      }
    })
  }
}

export function I18nProvider({ children }) {
  const language = detectLanguage()

  useEffect(() => {
    document.documentElement.lang = language
    if (language !== 'en') return undefined

    translateElement(document.body)

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach(translateElement)
        if (mutation.type === 'characterData') translateElement(mutation.target)
      })
    })

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [language])

  const value = useMemo(() => ({
    language,
    isEnglish: language === 'en',
    t: (italian, english) => (language === 'en' ? (english ?? englishTranslations[italian] ?? italian) : italian),
    domain: domains[language],
    origin: `https://${domains[language]}`,
    localizedUrl: (targetLanguage, pathname = window.location.pathname) => (
      `https://${domains[targetLanguage]}${pathname}${window.location.search}${window.location.hash}`
    ),
  }), [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
