import type { RouteObject } from 'react-router'
import { TripsPage } from '@/features/trips/ui/TripsPage'
import { AppLayout } from './AppLayout'

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
      { index: true, Component: TripsPage },
      // Iteración 3: { path: 'trips/:tripId', Component: TripDetailPage }
    ],
  },
]
