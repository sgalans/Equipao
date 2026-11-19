import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { useNotifications } from '@/shared/ui/notifications/notificationStore'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

type Repos = ReturnType<typeof createTestRepositories>

afterEach(() => {
  // El aviso global es un store de módulo: que no se filtre entre tests.
  useNotifications.setState({ message: null })
})

/** Catálogo con 3 artículos y lo que prepare `arrange`; abre /items. */
async function openCatalog(arrange?: (repos: Repos) => Promise<void>) {
  const repositories = createTestRepositories()
  for (const name of ['Cepillo', 'Pasta', 'Toalla']) {
    await repositories.items.create({ name })
  }
  await arrange?.(repositories)
  renderApp('/items', repositories)
  await screen.findByRole('heading', { name: 'Artículos' })
  return { repositories, user: userEvent.setup() }
}

const select = (name: string) => screen.getByRole('checkbox', { name })

describe('Seleccionar en el catálogo y añadir a una maleta', () => {
  it('"Seleccionar" convierte las filas en casillas y la barra cuenta los marcados', async () => {
    const { user } = await openCatalog(async (repos) => {
      await repos.luggages.create({ name: 'Mochila' })
    })

    await user.click(screen.getByRole('button', { name: 'Seleccionar' }))

    expect(
      screen.getByRole('button', { name: 'Selecciona artículos' }),
    ).toBeDisabled()
    await user.click(select('Cepillo, Sin usar'))
    await user.click(select('Pasta, Sin usar'))
    expect(select('Cepillo, Sin usar')).toBeChecked()
    expect(
      screen.getByRole('button', { name: 'Añadir 2 a una maleta…' }),
    ).toBeEnabled()
  })

  it('la selección se mantiene al buscar', async () => {
    const { user } = await openCatalog(async (repos) => {
      await repos.luggages.create({ name: 'Mochila' })
    })
    const field = screen.getByRole('searchbox', {
      name: 'Buscar o crear artículos',
    })
    await user.click(screen.getByRole('button', { name: 'Seleccionar' }))

    await user.type(field, 'cep')
    await user.click(select('Cepillo, Sin usar'))
    await user.clear(field)
    await user.type(field, 'pas')
    await user.click(select('Pasta, Sin usar'))

    expect(
      screen.getByRole('button', { name: 'Añadir 2 a una maleta…' }),
    ).toBeInTheDocument()
  })

  it('añade a la maleta y compartimento elegidos, ignora los que ya estaban y lo resume', async () => {
    let luggageId = ''
    const { user, repositories } = await openCatalog(async (repos) => {
      await repos.luggages.create({ name: 'Otra' })
      const luggage = await repos.luggages.create({ name: 'Mochila' })
      luggageId = luggage.id
      await repos.compartments.create({ luggageId, name: 'Neceser' })
      // "Cepillo" ya está en la Mochila: se ignorará.
      const [brush] = await repos.items.list()
      await repos.quantities.add({
        luggageId,
        itemId: brush.id,
        num: 2,
        nAlreadyPacked: 0,
      })
    })
    await user.click(screen.getByRole('button', { name: 'Seleccionar' }))
    await user.click(select('Cepillo, En 1 maleta'))
    await user.click(select('Pasta, Sin usar'))
    await user.click(
      screen.getByRole('button', { name: 'Añadir 2 a una maleta…' }),
    )

    const dialog = screen.getByRole('dialog', { name: 'Añadir 2 artículos' })
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Maleta' }),
      'Mochila',
    )
    await user.selectOptions(
      await within(dialog).findByRole('combobox', { name: 'Dónde' }),
      'Neceser',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Añadir' }))

    expect(
      await screen.findByText('Añadido 1 artículo a «Mochila». 1 ya estaba.'),
    ).toBeInTheDocument()
    // Sale del modo selección.
    expect(
      screen.getByRole('button', { name: 'Seleccionar' }),
    ).toBeInTheDocument()
    // La pasta ha entrado en el neceser; el cepillo sigue como estaba.
    const [kit] = await repositories.compartments.listByLuggage(luggageId)
    const entries =
      await repositories.quantities.listEntriesByLuggage(luggageId)
    expect(entries.map((e) => [e.itemName, e.num, e.compartmentId])).toEqual([
      ['Cepillo', 2, null],
      ['Pasta', 1, kit.id],
    ])
  })

  it('sin maletas, lo explica y no deja añadir', async () => {
    const { user } = await openCatalog()
    await user.click(screen.getByRole('button', { name: 'Seleccionar' }))
    await user.click(select('Toalla, Sin usar'))
    await user.click(
      screen.getByRole('button', { name: 'Añadir 1 a una maleta…' }),
    )

    const dialog = screen.getByRole('dialog')
    expect(
      await within(dialog).findByText(/Aún no tienes maletas/),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Añadir' }),
    ).toBeDisabled()
  })

  it('"Cancelar" sale del modo selección y la olvida', async () => {
    const { user } = await openCatalog()
    await user.click(screen.getByRole('button', { name: 'Seleccionar' }))
    await user.click(select('Toalla, Sin usar'))

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: 'Seleccionar' }))

    expect(select('Toalla, Sin usar')).not.toBeChecked()
  })
})
