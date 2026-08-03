function MediaPlaceholder({ label, compact = false }) {
  return (
    <div
      className={`media-placeholder${compact ? ' media-placeholder--compact' : ''}`}
      role="img"
      aria-label={`${label}: materiale non ancora disponibile`}
    >
      <span>{label}</span>
      <small>Materiale ufficiale da fornire</small>
    </div>
  )
}

export default MediaPlaceholder
