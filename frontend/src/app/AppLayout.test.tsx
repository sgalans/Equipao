import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

describe('AppLayout: navegación', () => {
  it('en el inicio muestra el nombre de la app y no el botón de volver', async () => {
    renderApp('/')

    expect(screen.getByRole('link', { name: 'LugGAge' })).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Mis maletas' }),
    ).not.toBeInTheDocument()
  })

  // Entramos DIRECTAMENTE a la maleta (el router en memoria solo tiene esa
  // entrada): así comprobamos también que funciona sin historial previo,
  // como al abrir un enlace directo o la PWA en esa pantalla.
  it('desde una maleta, "‹ Mis maletas" vuelve al inicio (también sin historial)', async () => {
    const user = userEvent.setup()
    const repositories = createTestRepositories()
    const luggage = await repositories.luggages.create({ name: 'Mochila' })
    const { router } = renderApp(`/luggages/${luggage.id}`, repositories)
    await screen.findByRole('heading', { name: 'Mochila' })

    await user.click(screen.getByRole('link', { name: 'Mis maletas' }))

    expect(router.state.location.pathname).toBe('/')
    expect(
      await screen.findByRole('heading', { name: 'Mis maletas' }),
    ).toBeInTheDocument()
  })
})
