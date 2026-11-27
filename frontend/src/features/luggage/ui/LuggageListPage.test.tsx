import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories, freezeTime } from '@/test/repositories'

describe('LuggageListPage', () => {
  it('muestra la cabecera de la app y un mensaje si no hay maletas', async () => {
    renderApp('/')

    expect(screen.getByRole('link', { name: 'Equipao' })).toBeInTheDocument()
    // findBy* espera (reintenta) hasta que aparezca: useLiveQuery es asíncrono.
    expect(await screen.findByText(/Aún no tienes maletas/)).toBeInTheDocument()
  })

  it('lista las maletas, las más recientes primero', async () => {
    freezeTime('2026-11-18T10:00:00.000Z')
    const repositories = createTestRepositories()
    await repositories.luggages.create({ name: 'Maleta finde' })
    vi.setSystemTime(new Date('2026-11-19T10:00:00.000Z'))
    await repositories.luggages.create({ name: 'Mochila Japón' })

    renderApp('/', repositories)

    const items = await screen.findAllByRole('listitem')
    expect(
      items.map((li) =>
        within(li).getByRole('link').getAttribute('aria-label'),
      ),
    ).toEqual(['Mochila Japón, Vacía', 'Maleta finde, Vacía'])
  })

  describe('Nueva maleta', () => {
    /** Desde "Mis maletas" → "+ Nueva maleta". */
    async function openNewLuggage(repositories = createTestRepositories()) {
      const user = userEvent.setup()
      const rendered = renderApp('/', repositories)
      await user.click(screen.getByRole('link', { name: 'Nueva maleta' }))
      await screen.findByRole('heading', { name: 'Nueva maleta', level: 1 })
      return { ...rendered, repositories, user }
    }

    it('"+ Nueva maleta" lleva a la pantalla; sin nombre no se puede crear', async () => {
      await openNewLuggage()

      expect(
        screen.getByRole('button', { name: 'Crear maleta' }),
      ).toBeDisabled()
      expect(
        screen.getByRole('combobox', { name: 'Empezar con' }),
      ).toHaveDisplayValue('Vacía')
    })

    it('con nombre y descripción crea la maleta y la abre (sin volver al formulario)', async () => {
      const { user, repositories, router } = await openNewLuggage()

      await user.type(screen.getByLabelText('Nombre'), '  Mallorca  ')
      await user.type(
        screen.getByLabelText('Descripción (opcional)'),
        'Playa en julio',
      )
      await user.click(screen.getByRole('button', { name: 'Crear maleta' }))

      expect(
        await screen.findByRole('heading', { name: 'Mallorca', level: 1 }),
      ).toBeInTheDocument()
      // replace: "‹" vuelve a "Mis maletas", no al formulario ya usado.
      expect(router.state.historyAction).toBe('REPLACE')
      const [saved] = await repositories.luggages.list()
      expect(saved).toMatchObject({
        name: 'Mallorca',
        description: 'Playa en julio',
      })
    })

    it('Intro en el nombre también la crea (atajo)', async () => {
      const { user } = await openNewLuggage()

      await user.type(screen.getByLabelText('Nombre'), 'Neceser{Enter}')

      expect(
        await screen.findByRole('heading', { name: 'Neceser', level: 1 }),
      ).toBeInTheDocument()
    })

    it('"Empezar con": copia de otra maleta, con el nombre y la descripción nuevos', async () => {
      const repositories = createTestRepositories()
      const basic = await repositories.luggages.create({
        name: 'Maleta básica',
        description: 'Plantilla base',
      })
      const towel = await repositories.items.create({ name: 'Toalla' })
      await repositories.quantities.add({
        luggageId: basic.id,
        itemId: towel.id,
        num: 2,
        nAlreadyPacked: 2,
      })
      const { user } = await openNewLuggage(repositories)

      await user.type(screen.getByLabelText('Nombre'), 'Mallorca')
      await user.selectOptions(
        screen.getByRole('combobox', { name: 'Empezar con' }),
        'Copia de «Maleta básica»',
      )
      expect(
        screen.getByText(
          'Con sus artículos y compartimentos, sin nada marcado como listo.',
        ),
      ).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Crear maleta' }))

      await screen.findByRole('heading', { name: 'Mallorca', level: 1 })
      const copy = (await repositories.luggages.list()).find(
        (l) => l.name === 'Mallorca',
      )
      // La descripción es la escrita aquí (vacía), no la de la plantilla.
      expect(copy?.description).toBe('')
      const lines = await repositories.quantities.listByLuggage(copy?.id ?? '')
      expect(lines.map((l) => [l.itemId, l.num, l.nAlreadyPacked])).toEqual([
        [towel.id, 2, 0],
      ])
      // Una sola maleta nueva: ninguna "Maleta básica (copia)" suelta.
      expect(await repositories.luggages.list()).toHaveLength(2)
    })

    it('"¿Tienes una lista en texto? Impórtala" lleva a Importar, que vuelve a "‹ Nueva maleta"', async () => {
      const { user, router } = await openNewLuggage()

      await user.click(screen.getByRole('link', { name: 'Impórtala' }))

      expect(
        await screen.findByRole('textbox', { name: 'Pega aquí la lista' }),
      ).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/import')
      expect(
        screen.getByRole('link', { name: 'Nueva maleta' }),
      ).toHaveAttribute('href', '/luggages/new')
    })
  })

  it('un toque en la tarjeta abre el detalle de la maleta', async () => {
    const user = userEvent.setup()
    const repositories = createTestRepositories()
    const luggage = await repositories.luggages.create({ name: 'Neceser' })
    const { router } = renderApp('/', repositories)

    await user.click(
      await screen.findByRole('link', { name: 'Neceser, Vacía' }),
    )

    expect(router.state.location.pathname).toBe(`/luggages/${luggage.id}`)
    expect(
      await screen.findByRole('heading', { name: 'Neceser' }),
    ).toBeInTheDocument()
  })
})

describe('Progreso en las tarjetas', () => {
  it.each([
    [
      [
        [5, 5],
        [0, 1],
      ],
      'Grande, 1 de 2 listos',
    ],
    [[[1, 1]], 'Grande, ¡Maleta lista!'],
    [[], 'Grande, Vacía'],
  ] as const)(
    'con cantidades %j la tarjeta dice "%s"',
    async (counts, expectedName) => {
      const repositories = createTestRepositories()
      const luggage = await repositories.luggages.create({ name: 'Grande' })
      for (const [index, [packed, num]] of counts.entries()) {
        const item = await repositories.items.create({ name: `Art ${index}` })
        await repositories.quantities.add({
          luggageId: luggage.id,
          itemId: item.id,
          num,
          nAlreadyPacked: packed,
        })
      }

      renderApp('/', repositories)

      expect(
        await screen.findByRole('link', { name: expectedName }),
      ).toBeInTheDocument()
    },
  )

  it('se actualiza al empaquetar en otra parte de la app (useLiveQuery)', async () => {
    const repositories = createTestRepositories()
    const luggage = await repositories.luggages.create({ name: 'Grande' })
    const item = await repositories.items.create({ name: 'Toalla' })
    const quantity = await repositories.quantities.add({
      luggageId: luggage.id,
      itemId: item.id,
      num: 1,
      nAlreadyPacked: 0,
    })
    renderApp('/', repositories)
    await screen.findByRole('link', { name: 'Grande, 0 de 1 listos' })

    await repositories.quantities.togglePacked(quantity.id)

    expect(
      await screen.findByRole('link', { name: 'Grande, ¡Maleta lista!' }),
    ).toBeInTheDocument()
  })
})
