import { useEffect } from 'react'

function MetaDescription({ content }) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="description"]')

    if (!meta) return undefined

    const previousContent = meta.getAttribute('content')
    meta.setAttribute('content', content)

    return () => {
      meta.setAttribute('content', previousContent ?? '')
    }
  }, [content])

  return null
}

export default MetaDescription
