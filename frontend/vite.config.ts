import react from '@vitejs/plugin-react'
// Importamos defineConfig desde 'vitest/config' (no desde 'vite') para que
// TypeScript conozca la sección `test`. Vitest reutiliza esta misma config de
// Vite: mismos plugins, alias y transformaciones en la app y en los tests.
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom simula un navegador (DOM, window…) dentro de Node.
    environment: 'jsdom',
    // Se ejecuta antes de cada fichero de test (matchers, IndexedDB falsa…).
    setupFiles: ['./src/test/setup.ts'],
    // Sin `globals`: importamos describe/it/expect explícitamente en cada test.
    // Es más explícito y no contamina los tipos globales.
  },
})
