import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

describe('RouteErrorPage (error boundary)', () => {
  it('si falla la lectura de una pantalla, muestra un error amigable en vez de la página técnica', async () => {
    // Silenciamos los console.error esperados (React y nuestra página).
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const repositories = createTestRepositories()
    // Simula IndexedDB no disponible: la lectura del inicio falla.
    const failing = {
      ...repositories,
      luggages: {
        ...repositories.luggages,
        listSummaries: () =>
          Promise.reject(new Error('IndexedDB no disponible')),
      },
    }

    renderApp('/', failing)

    expect(
      await screen.findByRole('heading', { name: 'Algo ha ido mal' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Ir a mis maletas' }),
    ).toHaveAttribute('href', '/')
    vi.restoreAllMocks()
  })
})
