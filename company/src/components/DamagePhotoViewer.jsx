import { useEffect, useRef, useState } from "react"
import { PHOTO_VIEWER_MIN_ZOOM, clampPhotoZoom, nextPhotoZoom, zoomAtPoint } from "../lib/photoViewerState.js"

const INITIAL_VIEW = { zoom: PHOTO_VIEWER_MIN_ZOOM, x: 0, y: 0 }
export default function DamagePhotoViewer({ photo, onClose, onRetry }) {
  const [view, setView] = useState(INITIAL_VIEW)
  const pointers = useRef(new Map())
  const pinch = useRef(null)
  const stageRef = useRef(null)
  useEffect(() => {
    document.body.classList.add("photo-viewer-open")
    return () => document.body.classList.remove("photo-viewer-open")
  }, [])
  const point = (event) => {
    const box = stageRef.current?.getBoundingClientRect()
    return box ? { x: event.clientX - box.left - box.width / 2, y: event.clientY - box.top - box.height / 2 } : { x: 0, y: 0 }
  }
  const setZoom = (next, event) => setView((current) => {
    const zoom = clampPhotoZoom(next)
    if (!event) return { ...current, zoom }
    const anchor = point(event)
    return zoomAtPoint({ zoom: current.zoom, x: current.x, y: current.y, pointX: anchor.x, pointY: anchor.y, nextZoom: zoom })
  })
  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom }
    }
  }
  const onPointerMove = (event) => {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      setZoom(pinch.current.zoom * (distance / pinch.current.distance), event)
    } else if (view.zoom > PHOTO_VIEWER_MIN_ZOOM) {
      setView((current) => ({ ...current, x: current.x + event.clientX - previous.x, y: current.y + event.clientY - previous.y }))
    }
  }
  const onPointerEnd = (event) => { pointers.current.delete(event.pointerId); if (pointers.current.size < 2) pinch.current = null }
  const onWheel = (event) => { event.preventDefault(); setZoom(view.zoom * (event.deltaY < 0 ? 1.2 : 1 / 1.2), event) }
  return <div className="damage-photo-modal damage-photo-viewer" role="dialog" aria-modal="true" aria-label="Foto del danno" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section onMouseDown={(event) => event.stopPropagation()}>
      <header className="damage-photo-viewer__toolbar"><div className="damage-photo-viewer__controls"><button type="button" aria-label="Riduci zoom" disabled={view.zoom <= PHOTO_VIEWER_MIN_ZOOM} onClick={() => setZoom(nextPhotoZoom(view.zoom, -1))}>−</button><output aria-label="Livello zoom">{Math.round(view.zoom * 100)}%</output><button type="button" aria-label="Aumenta zoom" disabled={view.zoom >= 8} onClick={() => setZoom(nextPhotoZoom(view.zoom, 1))}>+</button><button type="button" className="button-secondary" onClick={() => setView(INITIAL_VIEW)}>Ripristina</button></div><button type="button" className="damage-photo-close" aria-label="Chiudi foto" onClick={onClose}>×</button></header>
      {["loading", "image-loading"].includes(photo.status) && <p className="damage-photo-loading">Caricamento foto…</p>}
      {photo.url && <div ref={stageRef} className="damage-photo-viewer__stage" onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onDoubleClick={(event) => setZoom(view.zoom > 1 ? 1 : 2, event)}><img className={photo.status === "success" ? "is-ready" : ""} src={photo.url} alt="Foto del danno" draggable="false" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }} onLoad={() => photo.onLoad()} onError={() => photo.onError()} /></div>}
      {photo.status === "error" && <div className="damage-photo-error"><p>Impossibile caricare la foto. Riprova.</p><button type="button" onClick={onRetry}>Riprova</button></div>}
    </section>
  </div>
}
