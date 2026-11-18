import { createBrowserRouter, RouterProvider } from 'react-router'
import { db } from '@/shared/db/db'
import { RepositoriesContext } from '@/shared/di/repositories'
import { createDexieRepositories } from './compositionRoot'
import { routes } from './routes'

// Se crean UNA vez, a nivel de módulo, y no dentro del componente: si
// estuvieran dentro se recrearían en cada render.
const repositories = createDexieRepositories(db)
const router = createBrowserRouter(routes)

/** Raíz de la app: provee las dependencias y monta el router. */
export function App() {
  return (
    // React 19: el propio Context hace de Provider (antes: Context.Provider).
    <RepositoriesContext value={repositories}>
      <RouterProvider router={router} />
    </RepositoriesContext>
  )
}
