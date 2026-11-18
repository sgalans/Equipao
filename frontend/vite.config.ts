import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
// Importamos defineConfig desde 'vitest/config' (no desde 'vite') para que
// TypeScript conozca la sección `test`. Vitest reutiliza esta misma config de
// Vite: mismos plugins, alias y transformaciones en la app y en los tests.
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Alias '@/' → src/. TypeScript lo conoce por `paths` (tsconfig.app.json);
    // Vite (y Vitest, que hereda esta config) lo necesitan aquí para resolverlo
    // de verdad al compilar. Ruta absoluta calculada desde este fichero.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Dos "proyectos" de test con distinto entorno. Arrancar jsdom (navegador
    // simulado) es lo más caro de cada fichero de test, así que solo lo pagan
    // los tests que de verdad renderizan componentes.
    // Sin `globals`: importamos describe/it/expect explícitamente en cada test.
    projects: [
      {
        // `extends: true` hereda la config de arriba (plugins, alias…).
        extends: true,
        test: {
          name: 'unit',
          // Lógica pura: dominio, repositorios, utilidades. Node puro, rápido.
          include: ['src/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['./src/test/setup.unit.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          // Componentes React: necesitan DOM.
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.unit.ts', './src/test/setup.dom.ts'],
        },
      },
    ],
  },
})
