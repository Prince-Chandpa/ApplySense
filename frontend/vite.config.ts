import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { createApiMiddleware } from './server/apiHandler.ts'

function apiPlugin(): Plugin {
  return {
    name: 'applysense-api-middleware',
    configureServer(server) {
      server.middlewares.use(createApiMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createApiMiddleware());
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  devtools: {
    // Remove this `apply` property to enable devtools for build as well
    apply: 'serve',
  },
  plugins: [react(), apiPlugin()],
})
