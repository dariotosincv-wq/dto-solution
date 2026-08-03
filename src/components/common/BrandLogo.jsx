function BrandLogo({ className = '', iconOnly = false, label, variant = 'default' }) {
  const titleId = label ? `brand-logo-${iconOnly ? 'icon' : 'horizontal'}-title` : undefined
  const textColor = variant === 'light' ? '#FFFFFF' : '#111827'

  if (iconOnly) {
    return (
      <svg
        className={`brand-logo brand-logo--icon ${className}`.trim()}
        viewBox="0 0 64 64"
        role={label ? 'img' : undefined}
        aria-labelledby={titleId}
        aria-hidden={label ? undefined : true}
      >
        {label && <title id={titleId}>{label}</title>}
        <rect width="64" height="64" rx="16" fill="#2563EB" />
        <text
          x="32"
          y="40"
          fill="#FFFFFF"
          fontFamily="Manrope Variable, Manrope, sans-serif"
          fontSize="21"
          fontWeight="800"
          letterSpacing="-0.8"
          textAnchor="middle"
        >
          DTO
        </text>
      </svg>
    )
  }

  return (
    <svg
      className={`brand-logo brand-logo--horizontal ${className}`.trim()}
      viewBox="0 0 150 48"
      role={label ? 'img' : undefined}
      aria-labelledby={titleId}
      aria-hidden={label ? undefined : true}
    >
      {label && <title id={titleId}>{label}</title>}
      <rect width="48" height="48" rx="12" fill="#2563EB" />
      <text
        x="24"
        y="30"
        fill="#FFFFFF"
        fontFamily="Manrope Variable, Manrope, sans-serif"
        fontSize="15.5"
        fontWeight="800"
        letterSpacing="-0.6"
        textAnchor="middle"
      >
        DTO
      </text>
      <text
        x="55"
        y="31"
        fill={textColor}
        fontFamily="Manrope Variable, Manrope, sans-serif"
        fontSize="22"
        fontWeight="700"
        letterSpacing="-0.65"
      >
        Solution
      </text>
    </svg>
  )
}

export default BrandLogo
