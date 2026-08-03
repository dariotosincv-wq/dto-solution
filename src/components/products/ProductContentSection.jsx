function ProductContentSection({ id, eyebrow, title, placeholder }) {
  return (
    <section className="content-panel product-content" aria-labelledby={id}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      <p className="placeholder-copy">{placeholder}</p>
    </section>
  )
}

export default ProductContentSection
