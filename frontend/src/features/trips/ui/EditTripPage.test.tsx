import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

/** Repositorios con un viaje ya creado (arrange común a casi todos los tests). */
async function setupWithTrip() {
  const repositories = createTestRepositories()
  const trip = await repositories.trips.create({
    name: 'Japón',
    startDate: '2027-04-01',
    endDate: '2027-04-15',
  })
  return { repositories, trip }
}

describe('EditTripPage', () => {
  it('se llega desde la lista con "Editar" y muestra los datos del viaje', async () => {
    const user = userEvent.setup()
    const { repositories, trip } = await setupWithTrip()
    const { router } = renderApp('/', repositories)

    await user.click(await screen.findByRole('link', { name: 'Editar Japón' }))

    expect(router.state.location.pathname).toBe(`/trips/${trip.id}/edit`)
    expect(await screen.findByLabelText('Nombre')).toHaveValue('Japón')
    expect(screen.getByLabelText('Inicio')).toHaveValue('2027-04-01')
    expect(screen.getByLabelText('Fin')).toHaveValue('2027-04-15')
  })

  it('guarda los cambios y vuelve a la lista', async () => {
    const user = userEvent.setup()
    const { repositories, trip } = await setupWithTrip()
    const { router } = renderApp(`/trips/${trip.id}/edit`, repositories)

    const name = await screen.findByLabelText('Nombre')
    await user.clear(name)
    await user.type(name, 'Japón y Corea')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Japón y Corea')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    // Se ha ACTUALIZADO el mismo viaje (mismo id), no creado otro.
    const saved = await repositories.trips.list()
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ id: trip.id, name: 'Japón y Corea' })
  })

  it('valida igual que al crear y no guarda si hay errores', async () => {
    const user = userEvent.setup()
    const { repositories, trip } = await setupWithTrip()
    renderApp(`/trips/${trip.id}/edit`, repositories)

    const end = await screen.findByLabelText('Fin')
    await user.clear(end)
    await user.type(end, '2027-03-01')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(end).toHaveAccessibleDescription(
      'La fecha de fin no puede ser anterior a la de inicio',
    )
    expect(await repositories.trips.getById(trip.id)).toEqual(trip)
  })

  it('"Cancelar" vuelve a la lista sin guardar', async () => {
    const user = userEvent.setup()
    const { repositories, trip } = await setupWithTrip()
    const { router } = renderApp(`/trips/${trip.id}/edit`, repositories)

    await user.type(await screen.findByLabelText('Nombre'), ' (borrador)')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(router.state.location.pathname).toBe('/')
    expect(await repositories.trips.getById(trip.id)).toEqual(trip)
  })

  it('muestra "no encontrado" si el viaje no existe (no se queda cargando)', async () => {
    renderApp('/trips/0190a0a0-0000-7000-8000-000000000000/edit')

    expect(
      await screen.findByRole('heading', { name: 'No encontramos este viaje' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Volver a mis viajes' }),
    ).toHaveAttribute('href', '/')
  })
})

describe('Ruta comodín (404)', () => {
  it('muestra la página de "no encontrada" para URLs desconocidas', async () => {
    renderApp('/esto/no/existe')

    expect(
      await screen.findByRole('heading', { name: 'Página no encontrada' }),
    ).toBeInTheDocument()
  })
})
