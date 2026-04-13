import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // REST / gRPC-gateway (auth, etc.)
      '/v1': {
        target: 'http://localhost:80',
        changeOrigin: true,
      },
      // Collab WebSocket
      '/collab': {
        target: 'http://localhost:80',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
