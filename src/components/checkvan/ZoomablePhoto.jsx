import { useEffect, useMemo, useRef, useState } from 'react'
import { clampZoom, zoomAtPointer } from '../../lib/zoom.js'

function ZoomablePhoto({ alt, onTransform, src, transform, unavailable }) {
  const [drag, setDrag] = useState(null)
  const local = useMemo(() => transform ?? { zoom: 1, x: 0, y: 0 }, [transform])
  const frame = useRef(null)
  const pointers = useRef(new Map())
  const pinch = useRef(null)

  const relativePoint = (event) => {
    const bounds = frame.current?.getBoundingClientRect()
    return bounds ? { x: event.clientX - bounds.left - bounds.width / 2, y: event.clientY - bounds.top - bounds.height / 2 } : { x: 0, y: 0 }
  }
  const zoomAtEvent = (nextZoom, event) => {
    const point = relativePoint(event)
    onTransform(zoomAtPointer({ ...local, pointX: point.x, pointY: point.y, nextZoom: clampZoom(nextZoom) }))
  }

  useEffect(() => {
    const node = frame.current
    if (!node) return undefined
    const wheel = (event) => {
      event.preventDefault()
      zoomAtEvent(local.zoom - event.deltaY * 0.002, event)
    }
    node.addEventListener('wheel', wheel, { passive: false })
    return () => node.removeEventListener('wheel', wheel)
  }, [local, onTransform])

  if (unavailable) return <div className="comparison-photo comparison-photo--empty">{unavailable}</div>
  return (
    <div
      className="comparison-photo"
      ref={frame}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: local.zoom } } else setDrag({ x: event.clientX - local.x, y: event.clientY - local.y }) }}
      onPointerMove={(event) => { const previous = pointers.current.get(event.pointerId); if (!previous) return; pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointers.current.size === 2 && pinch.current) { const [a, b] = [...pointers.current.values()]; zoomAtEvent(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance), event) } else if (drag && local.zoom > 1) onTransform({ ...local, x: event.clientX - drag.x, y: event.clientY - drag.y }) }}
      onPointerUp={(event) => { pointers.current.delete(event.pointerId); if (pointers.current.size < 2) pinch.current = null; setDrag(null) }}
      onPointerCancel={(event) => { pointers.current.delete(event.pointerId); pinch.current = null; setDrag(null) }}
      onDoubleClick={(event) => zoomAtEvent(local.zoom > 1 ? 1 : 2, event)}
    >
      <img src={src} alt={alt} draggable="false" style={{ transform: `translate(${local.x}px, ${local.y}px) scale(${local.zoom})` }} />
    </div>
  )
}

export default ZoomablePhoto
