import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080', // Your local API server
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
}) 