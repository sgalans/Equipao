import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { useNotifications } from '@/shared/ui/notifications/notificationStore'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

type Repos = ReturnType<typeof createTestRepositories>

afterEach(() => {
  useNotifications.setState({ message: null })
})

/** Maleta "Mochila" + catálogo (Cepillo, Pasta, Toalla) + lo de `arrange`. */
async function setup(
  path: (luggageId: string) => string,
  arrange?: (repos: Repos, luggageId: string) => Promise<void>,
) {
  const repositories = createTestRepositories()
  const luggage = await repositories.luggages.create({ name: 'Mochila' })
  for (const name of ['Cepillo', 'Pasta', 'Toalla']) {
    await repositories.items.create({ name })
  }
  await arrange?.(repositories, luggage.id)
  const rendered = renderApp(path(luggage.id), repositories)
  return { ...rendered, repositories, luggage, user: userEvent.setup() }
}

const addPage = (id: string) => `/luggages/${id}/add-items`

describe('"Añadir más artículos del catálogo" desde la maleta', () => {
  it('se llega desde la maleta y "‹ Maleta" vuelve a ella (no al inicio)', async () => {
    const { user, router, luggage } = await setup((id) => `/luggages/${id}`)

    await user.click(
      await screen.findByRole('link', {
        name: 'Añadir más artículos del catálogo',
      }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Añadir a «Mochila»' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Maleta' }))
    expect(router.state.location.pathname).toBe(`/luggages/${luggage.id}`)
  })

  it('no ofrece los artículos que ya están en la maleta', async () => {
    await setup(addPage, async (repos, luggageId) => {
      const [brush] = await repos.items.list()
      await repos.quantities.add({
        luggageId,
        itemId: brush.id,
        num: 1,
        nAlreadyPacked: 0,
      })
    })

    await screen.findByRole('heading', { name: 'Añadir a «Mochila»' })
    expect(
      screen.queryByRole('checkbox', { name: /^Cepillo/ }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('sin compartimentos, añade directamente (sin preguntar dónde) y vuelve a la maleta', async () => {
    const { user, router, luggage, repositories } = await setup(addPage)

    await user.click(await screen.findByRole('checkbox', { name: /^Pasta/ }))
    await user.click(screen.getByRole('checkbox', { name: /^Toalla/ }))
    await user.click(
      screen.getByRole('button', { name: 'Añadir 2 a la maleta' }),
    )

    expect(
      await screen.findByText('Añadidos 2 artículos a «Mochila».'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/luggages/${luggage.id}`)
    // replace: "atrás" no vuelve a la pantalla de añadir.
    expect(router.state.historyAction).toBe('REPLACE')
    const entries = await repositories.quantities.listEntriesByLuggage(
      luggage.id,
    )
    expect(entries.map((e) => e.itemName)).toEqual(['Pasta', 'Toalla'])
  })

  it('con compartimentos, solo pregunta DÓNDE (la maleta ya está decidida)', async () => {
    let kitId = ''
    const { user, luggage, repositories } = await setup(
      addPage,
      async (repos, luggageId) => {
        kitId = (
          await repos.compartments.create({ luggageId, name: 'Neceser' })
        ).id
      },
    )

    await user.click(await screen.findByRole('checkbox', { name: /^Cepillo/ }))
    await user.click(
      screen.getByRole('button', { name: 'Añadir 1 a la maleta' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Añadir 1 artículo' })
    expect(
      within(dialog).queryByRole('combobox', { name: 'Maleta' }),
    ).not.toBeInTheDocument()
    await user.selectOptions(
      await within(dialog).findByRole('combobox', { name: 'Dónde' }),
      'Neceser',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Añadir' }))

    expect(
      await screen.findByText('Añadido 1 artículo a «Mochila».'),
    ).toBeInTheDocument()
    const [added] = await repositories.quantities.listByLuggage(luggage.id)
    expect(added.compartmentId).toBe(kitId)
  })

  it('si todo el catálogo ya está en la maleta, lo dice', async () => {
    await setup(addPage, async (repos, luggageId) => {
      await repos.quantities.addMany(
        luggageId,
        (await repos.items.list()).map((item) => item.id),
      )
    })

    expect(
      await screen.findByText(
        'Todos los artículos de tu catálogo ya están en esta maleta.',
      ),
    ).toBeInTheDocument()
  })

  it('maleta inexistente → "no encontrada"', async () => {
    renderApp('/luggages/0190a0a0-0000-7000-8000-000000000000/add-items')

    expect(
      await screen.findByRole('heading', {
        name: 'No encontramos esta maleta',
      }),
    ).toBeInTheDocument()
  })
})
