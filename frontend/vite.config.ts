/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev the browser talks to Vite only; /api is proxied to the backend, so the refresh-token
// cookie (path /api/auth) is same-origin and needs no CORS. The target is the backend's PORT
// (3000 by default); set API_PROXY_TARGET when the backend listens elsewhere.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}', 'src/vite-env.d.ts'],
      reporter: ['text', 'text-summary', 'json-summary', 'html'],
    },
  },
});
