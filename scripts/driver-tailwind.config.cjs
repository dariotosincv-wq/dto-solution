const colors = Object.fromEntries(['border','input','ring','background','foreground'].map(key => [key, `hsl(var(--${key}))`]))
for (const key of ['primary','secondary','destructive','muted','accent','popover','card','warning','success','info']) {
  colors[key] = { DEFAULT: `hsl(var(--${key}))`, foreground: `hsl(var(--${key}-foreground))` }
}
module.exports = {
  content: ['./vendor/driver-utility/src/**/*.{ts,tsx}', './src/features/driver/**/*.{ts,tsx}'],
  important: '.driver-tools',
  corePlugins: { preflight: false },
  theme: { extend: { colors, borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' } } },
  plugins: [require('tailwindcss-animate')],
}
