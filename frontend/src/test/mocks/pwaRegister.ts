/**
 * Sustituto de 'virtual:pwa-register/react' en los tests (alias en
 * vite.config.ts). El módulo real lo genera vite-plugin-pwa al construir la
 * app y necesita un service worker: en jsdom no existe. Aquí: sin
 * actualizaciones pendientes.
 */
export function useRegisterSW() {
  const noop = () => {}
  return {
    needRefresh: [false, noop] as const,
    offlineReady: [false, noop] as const,
    updateServiceWorker: async () => {},
  }
}
