import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

/** Viaje con N maletas, y la app abierta en su pantalla de edición. */
async function openEditWithLuggages(luggageCount: number) {
  const repositories = createTestRepositories()
  const trip = await repositories.trips.create({
    name: 'Japón',
    startDate: '2027-04-01',
    endDate: '2027-04-15',
  })
  for (let i = 1; i <= luggageCount; i++) {
    await repositories.luggages.create({ tripId: trip.id, name: `Maleta ${i}` })
  }
  return { trip, repositories }
}

describe('Borrar viaje', () => {
  it('el botón es solo un icono, pero tiene nombre accesible', async () => {
    const { trip, repositories } = await openEditWithLuggages(0)
    renderApp(`/trips/${trip.id}/edit`, repositories)

    // getByRole con `name` solo lo encuentra si el aria-label funciona.
    const button = await screen.findByRole('button', { name: 'Borrar viaje' })
    expect(button).toHaveTextContent('') // sin texto visible: solo el SVG
    expect(button).toHaveAttribute('title', 'Borrar viaje')
  })

  it('pide confirmación indicando cuántas maletas se borrarán', async () => {
    const user = userEvent.setup()
    const { trip, repositories } = await openEditWithLuggages(2)
    renderApp(`/trips/${trip.id}/edit`, repositories)

    // El diálogo existe en el DOM, pero cerrado no es accesible.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(
      await screen.findByRole('button', { name: 'Borrar viaje' }),
    )

    const dialog = screen.getByRole('dialog', { name: '¿Borrar «Japón»?' })
    expect(dialog).toHaveTextContent(
      'Se borrarán el viaje, sus 2 maletas y la lista de lo que lleva cada una.',
    )
    expect(dialog).toHaveTextContent('Esta acción no se puede deshacer.')
  })

  it.each([
    [1, 'Se borrarán el viaje, su maleta y la lista de lo que lleva.'],
    [0, 'Se borrará el viaje.'],
  ])('con %i maleta(s) adapta el mensaje', async (count, expected) => {
    const user = userEvent.setup()
    const { trip, repositories } = await openEditWithLuggages(count)
    renderApp(`/trips/${trip.id}/edit`, repositories)

    await user.click(
      await screen.findByRole('button', { name: 'Borrar viaje' }),
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(expected)
    // Siempre deja claro que el catálogo (Item) no forma parte del borrado.
    expect(dialog).toHaveTextContent('Los ítems de tu catálogo no se borran.')
    if (count === 0) expect(dialog).not.toHaveTextContent('maleta')
  })

  it('"Cancelar" cierra el diálogo sin borrar nada', async () => {
    const user = userEvent.setup()
    const { trip, repositories } = await openEditWithLuggages(1)
    renderApp(`/trips/${trip.id}/edit`, repositories)

    await user.click(
      await screen.findByRole('button', { name: 'Borrar viaje' }),
    )
    // within(dialog): en el navegador, showModal() vuelve inerte el resto de la
    // página; el "Cancelar" del formulario no es alcanzable. Testing Library
    // no modela `inert`, así que acotamos la búsqueda al diálogo.
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancelar',
      }),
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await repositories.trips.getById(trip.id)).toEqual(trip)
  })

  it('al confirmar borra el viaje y sus maletas, y vuelve a la lista', async () => {
    const user = userEvent.setup()
    const { trip, repositories } = await openEditWithLuggages(2)
    const { router } = renderApp(`/trips/${trip.id}/edit`, repositories)

    await user.click(
      await screen.findByRole('button', { name: 'Borrar viaje' }),
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Borrar',
      }),
    )

    expect(await screen.findByText('Aún no tienes viajes.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    // replace: la pantalla de editar no queda en el historial.
    expect(router.state.historyAction).toBe('REPLACE')
    expect(await repositories.trips.getById(trip.id)).toBeUndefined()
    expect(await repositories.luggages.listByTrip(trip.id)).toEqual([])
  })

  it('si el borrado falla, avisa y no sale de la pantalla', async () => {
    // Silenciamos el console.error esperado para no ensuciar la salida.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    const { trip, repositories } = await openEditWithLuggages(0)
    // Gracias a la inyección de dependencias, simular un fallo es tan fácil
    // como pasar un repositorio cuyo remove falla. Sin vi.mock de módulos.
    const failing = {
      ...repositories,
      trips: {
        ...repositories.trips,
        remove: () => Promise.reject(new Error('IndexedDB no disponible')),
      },
    }
    const { router } = renderApp(`/trips/${trip.id}/edit`, failing)

    await user.click(
      await screen.findByRole('button', { name: 'Borrar viaje' }),
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Borrar',
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se ha podido completar la acción',
    )
    expect(router.state.location.pathname).toBe(`/trips/${trip.id}/edit`)
    expect(await repositories.trips.getById(trip.id)).toEqual(trip)
    vi.restoreAllMocks()
  })
})
