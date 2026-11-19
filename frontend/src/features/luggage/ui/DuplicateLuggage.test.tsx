import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

describe('Duplicar maleta desde el listado', () => {
  it('cada maleta tiene su botón; la copia aparece la primera y empieza sin guardar', async () => {
    const user = userEvent.setup()
    const repositories = createTestRepositories()
    const source = await repositories.luggages.create({ name: 'Mochila' })
    const item = await repositories.items.create({ name: 'Pasaporte' })
    await repositories.quantities.add({
      luggageId: source.id,
      itemId: item.id,
      num: 1,
      nAlreadyPacked: 1,
    })
    const { router } = renderApp('/', repositories)
    await screen.findByRole('link', { name: 'Mochila, ¡Maleta lista!' })

    await user.click(screen.getByRole('button', { name: 'Duplicar Mochila' }))

    // La copia sale la primera (más reciente) y con su lista sin guardar.
    const copyLink = await screen.findByRole('link', {
      name: 'Mochila (copia), 0 de 1 listos',
    })
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]).getByRole('link')).toBe(copyLink)
    // Se queda en el listado (decisión de producto).
    expect(router.state.location.pathname).toBe('/')
    // Y la original no cambia.
    expect(
      screen.getByRole('link', { name: 'Mochila, ¡Maleta lista!' }),
    ).toBeInTheDocument()
  })

  it('el botón de cada fila duplica SU maleta', async () => {
    const user = userEvent.setup()
    const repositories = createTestRepositories()
    await repositories.luggages.create({ name: 'Neceser' })
    await repositories.luggages.create({ name: 'Maleta finde' })
    renderApp('/', repositories)

    await user.click(
      await screen.findByRole('button', { name: 'Duplicar Neceser' }),
    )

    expect(
      await screen.findByRole('link', { name: 'Neceser (copia), Vacía' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /^Maleta finde \(copia\)/ }),
    ).not.toBeInTheDocument()
  })
})
