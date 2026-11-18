import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '@/app/routes'
import {
  RepositoriesContext,
  type Repositories,
} from '@/shared/di/repositories'
import { createTestRepositories } from './repositories'

/**
 * Renderiza la app completa (rutas reales) en una URL concreta, con
 * repositorios sobre una base de datos aislada para este test.
 *
 * createMemoryRouter guarda la URL en memoria en lugar de en el navegador:
 * cada test empieza en la ruta que le digamos, sin estado compartido.
 *
 * Devuelve los repositorios para que el test pueda preparar datos (arrange)
 * y comprobar resultados (assert) directamente en la base de datos.
 */
export function renderApp(
  path = '/',
  repositories: Repositories = createTestRepositories(),
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const result = render(
    <RepositoriesContext value={repositories}>
      <RouterProvider router={router} />
    </RepositoriesContext>,
  )
  return { ...result, router, repositories }
}
