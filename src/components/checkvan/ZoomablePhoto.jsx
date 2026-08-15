import { useEffect, useMemo, useRef, useState } from 'react'
import { clampZoom } from '../../lib/zoom.js'

function ZoomablePhoto({ alt, onTransform, src, transform, unavailable }) {
  const [drag, setDrag] = useState(null)
  const local = useMemo(() => transform ?? { zoom: 1, x: 0, y: 0 }, [transform])
  const frame = useRef(null)

  useEffect(() => {
    const node = frame.current
    if (!node) return undefined
    const wheel = (event) => {
      event.preventDefault()
      onTransform({ ...local, zoom: clampZoom(local.zoom - event.deltaY * 0.002) })
    }
    node.addEventListener('wheel', wheel, { passive: false })
    return () => node.removeEventListener('wheel', wheel)
  }, [local, onTransform])

  if (unavailable) return <div className="comparison-photo comparison-photo--empty">{unavailable}</div>
  return (
    <div
      className="comparison-photo"
      ref={frame}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDrag({ x: event.clientX - local.x, y: event.clientY - local.y }) }}
      onPointerMove={(event) => drag && onTransform({ ...local, x: event.clientX - drag.x, y: event.clientY - drag.y })}
      onPointerUp={() => setDrag(null)}
    >
      <img src={src} alt={alt} draggable="false" style={{ transform: `translate(${local.x}px, ${local.y}px) scale(${local.zoom})` }} />
    </div>
  )
}

export default ZoomablePhoto
