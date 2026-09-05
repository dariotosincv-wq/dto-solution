import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { driverUtilityPlugin } from './scripts/driver-utility-vite.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [driverUtilityPlugin(), react()],
})
