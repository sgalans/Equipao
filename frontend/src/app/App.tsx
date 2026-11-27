import { createBrowserRouter, RouterProvider } from 'react-router'
import { useExpandedDescriptions } from '@/features/luggage/ui/expandedDescriptionsStore'
import { db } from '@/shared/db/db'
import { RepositoriesContext } from '@/shared/di/repositories'
import { reportError } from '@/shared/ui/notifications/notificationStore'
import { createDexieRepositories } from './compositionRoot'
import { seedDefaults } from './defaults/seedDefaults'
import { requestPersistentStorage } from './pwa/persistentStorage'
import { routes } from './routes'

// Se crean UNA vez, a nivel de módulo, y no dentro del componente: si
// estuvieran dentro se recrearían en cada render.
const repositories = createDexieRepositories(db)
const router = createBrowserRouter(routes)

// Catálogo y "Maleta básica" por defecto: solo la primera vez en este
// dispositivo (ver seedDefaults). No bloquea el arranque: las pantallas leen
// con useLiveQuery y los muestran en cuanto se crean.
seedDefaults(db, repositories)
  .then((basicLuggageId) => {
    // Sus instrucciones, ABIERTAS la primera vez (decisión del usuario): las
    // demás descripciones largas salen plegadas. Como si el usuario hubiera
    // tocado "Ver más": si luego la pliega, se queda plegada. Se marca por
    // id (nunca por nombre: dejaría de funcionar al renombrarla).
    if (basicLuggageId) {
      useExpandedDescriptions.getState().expand(basicLuggageId)
    }
  })
  .catch((error: unknown) =>
    reportError(error, 'No se han podido preparar los artículos de ejemplo.'),
  )

// Pedir que el navegador no borre nuestros datos (no hay backend: si los
// borrara, se perderían). Nunca falla: si no se concede, todo sigue igual.
void requestPersistentStorage()

/** Raíz de la app: provee las dependencias y monta el router. */
export function App() {
  return (
    // React 19: el propio Context hace de Provider (antes: Context.Provider).
    <RepositoriesContext value={repositories}>
      <RouterProvider router={router} />
    </RepositoriesContext>
  )
}
