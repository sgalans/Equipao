import type { RouteObject } from 'react-router'
import { LuggageListPage } from '@/features/luggage/ui/LuggageListPage'
import { AppLayout } from './AppLayout'
import { NotFoundPage } from './NotFoundPage'

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
    children: [
      // index: la ruta hija que se pinta en "/" exactamente.
      { index: true, Component: LuggageListPage },
      // Paso 2: { path: 'luggages/:luggageId', Component: LuggageDetailPage }
      // Comodín: cualquier otra URL. Debe ser la red de seguridad final.
      { path: '*', Component: NotFoundPage },
    ],
  },
]
