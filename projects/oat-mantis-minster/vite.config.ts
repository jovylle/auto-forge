import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base: './' keeps asset URLs relative so the build works under /p/<slug>/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
