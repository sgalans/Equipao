import type { RouteObject } from 'react-router'
import { EditTripPage } from '@/features/trips/ui/EditTripPage'
import { NewTripPage } from '@/features/trips/ui/NewTripPage'
import { TripsPage } from '@/features/trips/ui/TripsPage'
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
      { index: true, Component: TripsPage },
      // Las rutas estáticas ('new') ganan a las dinámicas (':tripId'):
      // React Router ordena por especificidad, no por posición.
      { path: 'trips/new', Component: NewTripPage },
      { path: 'trips/:tripId/edit', Component: EditTripPage },
      // Iteración 3: { path: 'trips/:tripId', Component: TripDetailPage }
      // Comodín: cualquier otra URL. Debe ser la red de seguridad final.
      { path: '*', Component: NotFoundPage },
    ],
  },
]
