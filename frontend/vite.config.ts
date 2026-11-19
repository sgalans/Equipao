import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
// Importamos defineConfig desde 'vitest/config' (no desde 'vite') para que
// TypeScript conozca la sección `test`. Vitest reutiliza esta misma config de
// Vite: mismos plugins, alias y transformaciones en la app y en los tests.
import { defineConfig } from 'vitest/config'
import { APP_NAME } from './src/app/appInfo.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA: manifest (instalable) + service worker (funciona sin conexión).
    VitePWA({
      // Una versión nueva NO se instala sola: espera a que el usuario la
      // acepte (decisión de producto: nunca recargar mientras empaqueta). El
      // aviso "Nueva versión disponible" se añade en el paso de
      // actualizaciones con useRegisterSW.
      registerType: 'prompt',
      // Iconos generados a partir de public/icon.svg (pwa-assets.config.ts):
      // los añade al manifest y los <link> de iOS al index.html.
      pwaAssets: {
        config: true,
        overrideManifestIcons: true,
        // El theme-color lo pone index.html (claro y oscuro): que el plugin
        // no añada otro sin modo oscuro. Una sola fuente para ese dato.
        injectThemeColor: false,
      },
      manifest: {
        // El mismo nombre completo y bajo el icono (cabe: iOS muestra ~12
        // caracteres). Sale de APP_NAME: un único sitio para el nombre.
        name: APP_NAME,
        short_name: APP_NAME,
        description: 'Prepara tus maletas y marca lo que ya está guardado.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        // standalone: se abre a pantalla completa, sin la barra de Safari.
        display: 'standalone',
        background_color: '#ffffff',
        // Igual que el fondo de la app (ver theme-color en index.html, que
        // además distingue modo claro y oscuro).
        theme_color: '#ffffff',
      },
      workbox: {
        // Todo lo que se publica se guarda en el dispositivo (precaché):
        // así la app arranca y funciona sin conexión.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // SPA sin conexión: cualquier ruta (/luggages/123…) sirve index.html
        // desde la caché y React Router hace el resto.
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    // El aviso por defecto salta a los 500 kB. Medido (iteración 10): el
    // chunk "vendor" (~507 kB, ~157 kB gzip) son librerías que la PRIMERA
    // pantalla necesita (React, React Router, Zod, Dexie) y que la PWA
    // descarga una sola vez. Partirlo más solo silenciaría el aviso sin
    // reducir lo descargado. Si se quiere adelgazar de verdad: valorar
    // `zod/mini` (backlog).
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Las librerías (React, React Router, Zod, Dexie…: ~90% del peso) en
        // su propio fichero. Al publicar una versión nueva normalmente solo
        // cambia NUESTRO código, y el service worker solo vuelve a descargar
        // los ficheros cuyo hash ha cambiado: actualizaciones mucho más
        // ligeras.
        codeSplitting: {
          groups: [{ name: 'vendor', test: /node_modules/ }],
        },
      },
    },
  },
  resolve: {
    // Alias '@/' → src/. TypeScript lo conoce por `paths` (tsconfig.app.json);
    // Vite (y Vitest, que hereda esta config) lo necesitan aquí para resolverlo
    // de verdad al compilar. Ruta absoluta calculada desde este fichero.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // El módulo virtual de vite-plugin-pwa solo existe al construir la app:
    // en los tests se sustituye por una versión falsa (sin service worker).
    alias: {
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/mocks/pwaRegister.ts', import.meta.url),
      ),
    },
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
