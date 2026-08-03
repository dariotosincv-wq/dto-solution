function PageIntro({ eyebrow, title, children }) {
  return (
    <header className="page-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children && <div className="page-intro__copy">{children}</div>}
    </header>
  )
}

export default PageIntro
