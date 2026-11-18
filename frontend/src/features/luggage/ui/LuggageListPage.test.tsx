import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories, freezeTime } from '@/test/repositories'

describe('LuggageListPage', () => {
  it('muestra la cabecera de la app y un mensaje si no hay maletas', async () => {
    renderApp('/')

    expect(screen.getByRole('link', { name: 'LugGAge' })).toBeInTheDocument()
    // findBy* espera (reintenta) hasta que aparezca: useLiveQuery es asíncrono.
    expect(
      await screen.findByText('Aún no tienes maletas.'),
    ).toBeInTheDocument()
  })

  it('lista las maletas, las más recientes primero', async () => {
    freezeTime('2026-11-18T10:00:00.000Z')
    const repositories = createTestRepositories()
    await repositories.luggages.create({ name: 'Maleta finde' })
    vi.setSystemTime(new Date('2026-11-19T10:00:00.000Z'))
    await repositories.luggages.create({ name: 'Mochila Japón' })

    renderApp('/', repositories)

    const items = await screen.findAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([
      'Mochila Japón',
      'Maleta finde',
    ])
  })

  it('se actualiza sola cuando cambian los datos (useLiveQuery)', async () => {
    const { repositories } = renderApp('/')
    await screen.findByText('Aún no tienes maletas.')

    // Cambiamos la base de datos "por detrás", sin tocar la UI.
    await repositories.luggages.create({ name: 'Neceser' })

    expect(await screen.findByText('Neceser')).toBeInTheDocument()
  })
})
