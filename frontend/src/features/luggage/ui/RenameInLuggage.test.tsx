import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

type Repos = ReturnType<typeof createTestRepositories>

/*
 * Renombrar desde la maleta (decisión del usuario): el nombre es del
 * ARTÍCULO, así que cambia en todas las maletas y en el catálogo; si choca
 * con otro, se propone unirlos.
 */

async function openLuggage(
  arrange: (repos: Repos, luggageId: string) => Promise<void>,
) {
  const repositories = createTestRepositories()
  const luggage = await repositories.luggages.create({ name: 'Grande' })
  await arrange(repositories, luggage.id)
  renderApp(`/luggages/${luggage.id}`, repositories)
  await screen.findByRole('heading', { name: 'Grande', level: 1 })
  return { repositories, luggage, user: userEvent.setup() }
}

async function put(repos: Repos, luggageId: string, name: string) {
  const item =
    (await repos.items.findByName(name)) ?? (await repos.items.create({ name }))
  await repos.quantities.add({
    luggageId,
    itemId: item.id,
    num: 1,
    nAlreadyPacked: 0,
  })
  return item
}

describe('Renombrar un artículo desde la maleta', () => {
  it('✎ → escribir → cambia en el catálogo (y en todas las maletas)', async () => {
    const { user, repositories } = await openLuggage(async (repos, id) => {
      await put(repos, id, 'Peolota')
    })
    await user.click(screen.getByRole('button', { name: /^Peolota,/ }))

    await user.click(screen.getByRole('button', { name: 'Renombrar Peolota' }))
    await user.clear(
      screen.getByRole('textbox', { name: 'Nombre del artículo' }),
    )
    await user.keyboard('Pelota{Enter}')

    expect(
      await screen.findByRole('checkbox', { name: 'Pelota' }),
    ).toBeInTheDocument()
    expect((await repositories.items.list()).map((i) => i.name)).toEqual([
      'Pelota',
    ])
  })

  it('si está en otras maletas, avisa de que cambia en todas', async () => {
    const { user } = await openLuggage(async (repos, id) => {
      const item = await put(repos, id, 'Toalla')
      const other = await repos.luggages.create({ name: 'Otra' })
      await repos.quantities.add({
        luggageId: other.id,
        itemId: item.id,
        num: 1,
        nAlreadyPacked: 0,
      })
    })
    await user.click(screen.getByRole('button', { name: /^Toalla,/ }))

    await user.click(screen.getByRole('button', { name: 'Renombrar Toalla' }))

    expect(
      await screen.findByText('Cambia en todas tus maletas.'),
    ).toBeInTheDocument()
  })

  it('con el nombre de otro artículo, propone unirlos y "Unir" deja uno', async () => {
    const { user, repositories } = await openLuggage(async (repos, id) => {
      await put(repos, id, 'Peolota')
      await repos.items.create({ name: 'Pelota' })
    })
    await user.click(screen.getByRole('button', { name: /^Peolota,/ }))
    await user.click(screen.getByRole('button', { name: 'Renombrar Peolota' }))
    await user.clear(
      screen.getByRole('textbox', { name: 'Nombre del artículo' }),
    )
    await user.keyboard('pelota{Enter}')

    const dialog = await screen.findByRole('dialog', {
      name: 'Ya existe «Pelota»',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Unir' }))

    await waitFor(async () =>
      expect((await repositories.items.list()).map((i) => i.name)).toEqual([
        'Pelota',
      ]),
    )
    expect(
      await screen.findByRole('checkbox', { name: 'Pelota' }),
    ).toBeInTheDocument()
  })
})

describe('Renombrar un compartimento', () => {
  it('desde ⋯ con ✎; si ya hay otro igual, propone unirlos', async () => {
    const { user, repositories, luggage } = await openLuggage(
      async (repos, id) => {
        await repos.compartments.create({ luggageId: id, name: 'Necesr' })
        await repos.compartments.create({ luggageId: id, name: 'Neceser' })
      },
    )
    await user.click(
      screen.getByRole('button', { name: 'Más acciones de Necesr' }),
    )
    await user.click(screen.getByRole('button', { name: 'Renombrar Necesr' }))
    await user.clear(
      screen.getByRole('textbox', { name: 'Nombre del compartimento' }),
    )
    await user.keyboard('Neceser{Enter}')

    const dialog = await screen.findByRole('dialog', {
      name: 'Ya existe «Neceser»',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Unir' }))

    await waitFor(async () =>
      expect(
        (await repositories.compartments.listByLuggage(luggage.id)).map(
          (c) => c.name,
        ),
      ).toEqual(['Neceser']),
    )
  })
})
