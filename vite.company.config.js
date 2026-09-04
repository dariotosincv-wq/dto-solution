import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'company',
  publicDir: '../public',
  envDir: '..',
  plugins: [react()],
  build: { outDir: '../dist-company', emptyOutDir: true },
})
