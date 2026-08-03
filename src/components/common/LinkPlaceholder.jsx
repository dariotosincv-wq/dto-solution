function LinkPlaceholder({ children }) {
  return (
    <span className="button button--disabled" aria-disabled="true">
      {children}
    </span>
  )
}

export default LinkPlaceholder
