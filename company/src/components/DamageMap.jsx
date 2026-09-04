import { useEffect, useRef, useState } from "react";
import { containedImageBox, pointerToNormalized } from "../lib/damageImageGeometry.js";

const views = ["FRONT", "LEFT", "REAR", "RIGHT"];
const labels = {
  FRONT: "Frontale",
  LEFT: "Lato sinistro",
  REAR: "Posteriore",
  RIGHT: "Lato destro",
};
// eslint-disable-next-line react-refresh/only-export-components
export const silhouetteAsset = (category, view) =>
  `/company/vehicle-silhouettes/${category.toLowerCase().replaceAll("_", "-")}-${view.toLowerCase()}.png`;
export default function DamageMap({
  category,
  damages,
  view,
  onView,
  onAdd,
  onMove,
  onSelect,
  selected,
  moving = false,
  disabled = false,
}) {
  const canvasRef = useRef(null), imageRef = useRef(null), gestureRef = useRef({ pointers: new Map(), blocked: false, suppressMarkerClickUntil: 0 }), [imageBox, setImageBox] = useState(null), [dragging, setDragging] = useState(false);
  const updateImageBox = () => { const canvas = canvasRef.current, image = imageRef.current; if (canvas && image) setImageBox(containedImageBox(canvas.clientWidth, canvas.clientHeight, image.naturalWidth, image.naturalHeight)); };
  useEffect(() => { const canvas = canvasRef.current; if (!canvas) return undefined; updateImageBox(); const observer = new ResizeObserver(updateImageBox); observer.observe(canvas); return () => observer.disconnect(); }, [category, view]);
  const visible = damages.filter(
    (d) =>
      d.vehicle_view === view && ["PENDING", "CONFIRMED"].includes(d.status),
  );
  const beginGesture = (event) => {
    const gesture = gestureRef.current;
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: false, pointerType: event.pointerType });
    if (gesture.pointers.size > 1) gesture.blocked = true;
  };
  const moveGesture = (event) => {
    const pointer = gestureRef.current.pointers.get(event.pointerId);
    if (!pointer) return;
    const threshold = pointer.pointerType === "mouse" ? 8 : 5;
    if (!pointer.moved && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > threshold) {
      pointer.moved = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDragging(true);
    }
  };
  const releaseGestureCapture = (element, pointerId) => {
    if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
  };
  const cancelGesture = (event) => {
    const gesture = gestureRef.current;
    releaseGestureCapture(event.currentTarget, event.pointerId);
    gesture.pointers.delete(event.pointerId);
    if (!gesture.pointers.size) { gesture.blocked = false; setDragging(false); }
  };
  const finishGesture = (event) => {
    const gesture = gestureRef.current, pointer = gesture.pointers.get(event.pointerId);
    const intentionalTap = pointer && !pointer.moved && !gesture.blocked && gesture.pointers.size === 1;
    if (pointer?.moved) gesture.suppressMarkerClickUntil = performance.now() + 500;
    releaseGestureCapture(event.currentTarget, event.pointerId);
    gesture.pointers.delete(event.pointerId);
    if (!gesture.pointers.size) { gesture.blocked = false; setDragging(false); }
    if (!intentionalTap || disabled || event.target.closest("[data-marker]")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!imageBox) return;
    const point = pointerToNormalized({ x: event.clientX - rect.left - event.currentTarget.clientLeft, y: event.clientY - rect.top - event.currentTarget.clientTop }, imageBox);
    if (!point) return;
    if (moving && selected && onMove) onMove(point.x, point.y);
    else onAdd?.(point.x, point.y);
  };
  return (
    <section className="damage-map">
      <div className="damage-tabs">
        {views.map((item) => (
          <button
            type="button"
            className={view === item ? "active" : ""}
            onClick={() => onView(item)}
            key={item}
          >
            {labels[item]}
          </button>
        ))}
      </div>
      <div
        ref={canvasRef}
        className={`damage-canvas ${dragging ? "is-dragging" : ""}`}
        aria-disabled={disabled}
        onPointerDown={beginGesture}
        onPointerMove={moveGesture}
        onPointerUp={finishGesture}
        onPointerCancel={cancelGesture}
      >
        <img
          ref={imageRef}
          onLoad={updateImageBox}
          src={silhouetteAsset(category, view)}
          alt={`${category} ${labels[view]}`}
        />
        {visible.map((d) => (
          <button
            data-marker
            type="button"
            disabled={d.saving}
            aria-label={`${d.damage_type} ${d.status}`}
            onClick={(e) => {
              e.stopPropagation();
              if (performance.now() < gestureRef.current.suppressMarkerClickUntil) return;
              onSelect?.(d);
            }}
            className={`damage-marker damage-marker--${d.status.toLowerCase()} ${d.saving ? "saving" : ""} ${selected?.damage_id === d.damage_id ? "selected" : ""}`}
            style={{
              left: imageBox ? imageBox.left + d.normalized_x * imageBox.width : 0,
              top: imageBox ? imageBox.top + d.normalized_y * imageBox.height : 0,
              visibility: imageBox ? "visible" : "hidden",
            }}
            key={d.damage_id}
          >
            <span className={`damage-symbol damage-symbol--${d.damage_type.toLowerCase()}`} aria-hidden="true">
              {d.damage_type === "SCRATCH" ? "×" : ""}
            </span>
            {d.saving && <span className="sr-only">Salvataggio</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
