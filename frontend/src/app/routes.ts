import type { RouteObject } from 'react-router'
import { LuggageDetailPage } from '@/features/luggage/ui/LuggageDetailPage'
import { LuggageListPage } from '@/features/luggage/ui/LuggageListPage'
import { AppLayout } from './AppLayout'
import type { RouteHandle } from './navigation'
import { NotFoundPage } from './NotFoundPage'
import { RouteErrorPage } from './RouteErrorPage'

/**
 * Tabla de rutas de la app. Está separada de App.tsx para reutilizarla en los
 * tests con un router en memoria (createMemoryRouter).
 *
 * Usamos `Component` (no `element: <X />`) para que sea un fichero .ts sin JSX.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppLayout,
    // Error boundary: cualquier error al pintar una pantalla (o el propio
    // layout) muestra RouteErrorPage en lugar de la página técnica.
    ErrorBoundary: RouteErrorPage,
    children: [
      // index: la ruta hija que se pinta en "/" exactamente.
      { index: true, Component: LuggageListPage },
      {
        // Ruta estática: React Router la prefiere a 'luggages/:luggageId'
        // (más específica), así "new" nunca se toma por un id.
        path: 'luggages/new',
        lazy: async () => ({
          Component: (await import('@/features/luggage/ui/NewLuggagePage'))
            .NewLuggagePage,
        }),
      },
      { path: 'luggages/:luggageId', Component: LuggageDetailPage },
      {
        path: 'luggages/:luggageId/add-items',
        // Pantalla secundaria: se carga la primera vez que se abre (code
        // splitting), no al arrancar la app.
        lazy: async () => ({
          Component: (await import('@/features/luggage/ui/AddItemsPage'))
            .AddItemsPage,
        }),
        // "‹ Maleta": desde aquí se vuelve a la maleta, no al inicio.
        handle: {
          back: (params) => ({
            to: `/luggages/${params.luggageId}`,
            label: 'Maleta',
          }),
        } satisfies RouteHandle,
      },
      {
        path: 'import',
        lazy: async () => ({
          Component: (await import('@/features/luggage/ui/ImportLuggagePage'))
            .ImportLuggagePage,
        }),
        // Se llega desde "Nueva maleta" ("¿Tienes una lista en texto?").
        handle: {
          back: () => ({ to: '/luggages/new', label: 'Nueva maleta' }),
        } satisfies RouteHandle,
      },
      {
        path: 'items',
        lazy: async () => ({
          Component: (await import('@/features/items/ui/ItemsCatalogPage'))
            .ItemsCatalogPage,
        }),
      },
      // Comodín: cualquier otra URL. Debe ser la red de seguridad final.
      { path: '*', Component: NotFoundPage },
    ],
  },
]
