function SectionHeading({ eyebrow, title, children }) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children && <div className="section-heading__copy">{children}</div>}
    </div>
  )
}

export default SectionHeading
