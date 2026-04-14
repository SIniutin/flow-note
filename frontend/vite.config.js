import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // REST / gRPC-gateway (auth)
      '/v1': {
        target: 'http://127.0.0.1:80',
        changeOrigin: true,
      },
      // REST / gRPC-gateway (comment, notify)
      '/api': {
        target: 'http://127.0.0.1:80',
        changeOrigin: true,
      },
      // Collab WebSocket — проксируем в api-gateway → collab-service (hocuspocus)
      '/collab': {
        target: 'http://127.0.0.1:80',
        changeOrigin: true,
        ws: true,
      },
      // MWS Tables mock API (collab-service mock-tables: npm run mock:tables)
      // В проде заменить target на реальный MWS_API_BASE
      '/fusion': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
})
