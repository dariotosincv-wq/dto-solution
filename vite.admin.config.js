import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ root:'admin', base:'/super-admin/', publicDir:false, envDir:'..', plugins:[react()], build:{outDir:'../dist/super-admin',emptyOutDir:true} })
