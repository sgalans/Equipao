import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories, freezeTime } from '@/test/repositories'

describe('LuggageListPage', () => {
  it('muestra la cabecera de la app y un mensaje si no hay maletas', async () => {
    renderApp('/')

    expect(screen.getByRole('link', { name: 'LugGAge' })).toBeInTheDocument()
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

  describe('crear en línea', () => {
    it('Enter crea la maleta, limpia el campo y mantiene el foco', async () => {
      const user = userEvent.setup()
      const { repositories } = renderApp('/')
      const input = screen.getByLabelText('Nombre de la nueva maleta')

      // {Enter} simula pulsar la tecla: envía el formulario como un usuario.
      await user.type(input, '  Mochila Japón {Enter}')

      expect(
        await screen.findByRole('link', { name: 'Mochila Japón, Vacía' }),
      ).toBeInTheDocument()
      expect(input).toHaveValue('')
      expect(input).toHaveFocus()
      const [saved] = await repositories.luggages.list()
      expect(saved.name).toBe('Mochila Japón')
    })

    it('el botón "+" también crea la maleta', async () => {
      const user = userEvent.setup()
      renderApp('/')

      await user.type(
        screen.getByLabelText('Nombre de la nueva maleta'),
        'Neceser',
      )
      await user.click(screen.getByRole('button', { name: 'Crear maleta' }))

      expect(
        await screen.findByRole('link', { name: 'Neceser, Vacía' }),
      ).toBeInTheDocument()
    })

    it('se pueden crear varias seguidas sin tocar nada más', async () => {
      const user = userEvent.setup()
      const { repositories } = renderApp('/')
      const input = screen.getByLabelText('Nombre de la nueva maleta')

      await user.type(input, 'Una{Enter}')
      await screen.findByRole('link', { name: 'Una, Vacía' })
      await user.type(input, 'Dos{Enter}')
      await screen.findByRole('link', { name: 'Dos, Vacía' })

      expect(await repositories.luggages.list()).toHaveLength(2)
    })

    it('Enter con el campo vacío no crea nada ni muestra errores', async () => {
      const user = userEvent.setup()
      const { repositories } = renderApp('/')

      await user.type(
        screen.getByLabelText('Nombre de la nueva maleta'),
        '   {Enter}',
      )

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(await repositories.luggages.list()).toEqual([])
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
