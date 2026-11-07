import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

/**
 * Proxy hacia el backend NestJS.
 *
 * Vive en una constante y se aplica a `server` Y a `preview` porque son dos
 * servidores distintos: si sólo estuviera en `server`, el build servido con
 * `vite preview` cargaría la interfaz pero TODAS las llamadas a `/api` darían
 * 404, y la app se vería vacía aunque el backend estuviera arriba.
 */
const proxyApi = {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    secure: false,
  },
}

/** Hosts permitidos: necesario para túneles (cloudflared, localhost.run...). */
const allowedHosts = true

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts,
    proxy: proxyApi,
  },
  preview: {
    allowedHosts,
    proxy: proxyApi,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}", "test/**/*.spec.{ts,tsx}"],
  },
})
