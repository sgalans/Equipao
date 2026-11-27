import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { chooseLuggageAction } from '@/test/luggageActions'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

describe('Duplicar maleta desde el listado', () => {
  it('⋯ → Duplicar: la copia aparece la primera y empieza sin guardar', async () => {
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

    await chooseLuggageAction(user, 'Mochila', 'Duplicar')

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

  it('el ⋯ de cada fila duplica SU maleta', async () => {
    const user = userEvent.setup()
    const repositories = createTestRepositories()
    await repositories.luggages.create({ name: 'Neceser' })
    await repositories.luggages.create({ name: 'Maleta finde' })
    renderApp('/', repositories)

    await chooseLuggageAction(user, 'Neceser', 'Duplicar')

    expect(
      await screen.findByRole('link', { name: 'Neceser (copia), Vacía' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /^Maleta finde \(copia\)/ }),
    ).not.toBeInTheDocument()
  })

  it('desde dentro de la maleta, Duplicar abre la copia y lo dice', async () => {
    const user = userEvent.setup()
    const repositories = createTestRepositories()
    const source = await repositories.luggages.create({ name: 'Mochila' })
    const { router } = renderApp(`/luggages/${source.id}`, repositories)
    await screen.findByRole('heading', { name: 'Mochila', level: 1 })

    await chooseLuggageAction(user, 'Mochila', 'Duplicar')

    expect(
      await screen.findByRole('heading', { name: 'Mochila (copia)', level: 1 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Copia creada: «Mochila (copia)».'),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).not.toBe(`/luggages/${source.id}`)
  })
})
