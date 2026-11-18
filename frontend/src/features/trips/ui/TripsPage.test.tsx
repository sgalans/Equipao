import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

describe('TripsPage', () => {
  it('muestra la cabecera de la app y un mensaje si no hay viajes', async () => {
    renderApp('/')

    expect(screen.getByRole('link', { name: 'LugGAge' })).toBeInTheDocument()
    // findBy* espera (reintenta) hasta que aparezca: useLiveQuery es asíncrono.
    expect(await screen.findByText('Aún no tienes viajes.')).toBeInTheDocument()
  })

  it('lista los viajes ordenados por fecha, con nombre y fechas', async () => {
    const repositories = createTestRepositories()
    await repositories.trips.create({
      name: 'Japón',
      startDate: '2027-04-01',
      endDate: '2027-04-15',
    })
    await repositories.trips.create({
      name: 'Pirineo',
      startDate: '2027-01-10',
      endDate: '2027-01-12',
    })

    renderApp('/', repositories)

    const items = await screen.findAllByRole('listitem')
    expect(
      items.map((li) => within(li).getByText(/Japón|Pirineo/).textContent),
    ).toEqual(['Pirineo', 'Japón'])
    expect(within(items[1]).getByText(/abr 2027/)).toBeInTheDocument()
  })

  it('se actualiza sola cuando cambian los datos (useLiveQuery)', async () => {
    const { repositories } = renderApp('/')
    await screen.findByText('Aún no tienes viajes.')

    // Cambiamos la base de datos "por detrás", sin tocar la UI.
    await repositories.trips.create({
      name: 'Islandia',
      startDate: '2027-07-01',
      endDate: '2027-07-10',
    })

    expect(await screen.findByText('Islandia')).toBeInTheDocument()
  })
})
