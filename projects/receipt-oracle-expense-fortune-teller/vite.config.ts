import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// base './' keeps asset paths relative for /p/<slug>/ subpath hosting
export default defineConfig({
  base: './',
  plugins: [tailwindcss(), react()],
})
