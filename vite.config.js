import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'https://test-platform.adcropper.com',
        changeOrigin: true,
        secure: false,
      },
      '/fonts': {
        target: 'https://test-platform.adcropper.com',
        changeOrigin: true,
        secure: false,
      },
      '/upload': {
        target: 'https://test-tool-upload.adcropper.com',
        changeOrigin: true,
      },
      '/runway': {
        target: 'https://api.dev.runwayml.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/runway/, ''),
      },
      '/local-video': {
        target: 'https://localhost:8443',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/local-video/, ''),
      }
    }
  },
})
