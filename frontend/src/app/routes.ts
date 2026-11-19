import type { RouteObject } from 'react-router'
import { ItemsCatalogPage } from '@/features/items/ui/ItemsCatalogPage'
import { AddItemsPage } from '@/features/luggage/ui/AddItemsPage'
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
      { path: 'luggages/:luggageId', Component: LuggageDetailPage },
      {
        path: 'luggages/:luggageId/add-items',
        Component: AddItemsPage,
        // "‹ Maleta": desde aquí se vuelve a la maleta, no al inicio.
        handle: {
          back: (params) => ({
            to: `/luggages/${params.luggageId}`,
            label: 'Maleta',
          }),
        } satisfies RouteHandle,
      },
      { path: 'items', Component: ItemsCatalogPage },
      // Comodín: cualquier otra URL. Debe ser la red de seguridad final.
      { path: '*', Component: NotFoundPage },
    ],
  },
]
