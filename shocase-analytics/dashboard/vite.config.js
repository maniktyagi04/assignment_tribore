import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward /demos/* and /events to the Express backend
      '/demos':  { target: 'http://localhost:3001', changeOrigin: true },
      '/events': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
