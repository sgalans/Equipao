import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

type Repos = ReturnType<typeof createTestRepositories>

/** Abre /items tras preparar el catálogo con `arrange`. */
async function openCatalog(arrange?: (repos: Repos) => Promise<void>) {
  const repositories = createTestRepositories()
  await arrange?.(repositories)
  const rendered = renderApp('/items', repositories)
  await screen.findByRole('heading', { name: 'Artículos' })
  return { ...rendered, repositories, user: userEvent.setup() }
}

/** Mete un artículo (creándolo si hace falta) en una maleta nueva. */
async function useInLuggage(repos: Repos, itemId: string, luggageName: string) {
  const luggage = await repos.luggages.create({ name: luggageName })
  await repos.quantities.add({
    luggageId: luggage.id,
    itemId,
    num: 1,
    nAlreadyPacked: 0,
  })
  return luggage
}

describe('Acceso al catálogo', () => {
  it('"Artículos" en la cabecera del inicio lleva al catálogo, y se vuelve con "‹ Mis maletas"', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/')

    await user.click(screen.getByRole('link', { name: 'Artículos' }))

    expect(router.state.location.pathname).toBe('/items')
    expect(
      await screen.findByRole('heading', { name: 'Artículos' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Mis maletas' }))
    expect(router.state.location.pathname).toBe('/')
  })

  it('sin artículos explica de dónde salen', async () => {
    await openCatalog()

    expect(
      screen.getByText(
        'Aún no tienes artículos. Se crean al añadirlos a una maleta.',
      ),
    ).toBeInTheDocument()
  })
})

describe('Listado y búsqueda', () => {
  it('lista en orden alfabético con el uso de cada artículo', async () => {
    await openCatalog(async (repos) => {
      const socks = await repos.items.create({ name: 'Calcetines' })
      await repos.items.create({ name: 'Abrigo' })
      await useInLuggage(repos, socks.id, 'Grande')
      await useInLuggage(repos, socks.id, 'Mochila')
    })

    const rows = screen.getAllByRole('listitem')
    expect(
      rows.map((row) =>
        within(row).getByRole('button').getAttribute('aria-label'),
      ),
    ).toEqual(['Abrigo, Sin usar', 'Calcetines, En 2 maletas'])
  })

  it('el buscador filtra sin distinguir tildes y avisa si no hay resultados', async () => {
    const { user } = await openCatalog(async (repos) => {
      await repos.items.create({ name: 'Cámara' })
      await repos.items.create({ name: 'Toalla' })
    })
    const search = screen.getByRole('searchbox', { name: 'Buscar artículos' })

    await user.type(search, 'camara')

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /^Cámara,/ })).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'zzz')
    expect(
      screen.getByText('Ningún artículo coincide con «zzz».'),
    ).toBeInTheDocument()
  })
})

describe('Renombrar', () => {
  it('tocar la fila → "Renombrar" → escribir → OK cambia el nombre', async () => {
    const { user } = await openCatalog(async (repos) => {
      await repos.items.create({ name: 'Calcetnes' })
    })

    await user.click(screen.getByRole('button', { name: /^Calcetnes,/ }))
    await user.click(screen.getByRole('button', { name: 'Renombrar' }))
    expect(
      screen.getByRole('textbox', { name: 'Nombre del artículo' }),
    ).toHaveValue('Calcetnes')
    await user.keyboard('Calcetines{Enter}')

    expect(
      await screen.findByRole('button', { name: /^Calcetines,/ }),
    ).toBeInTheDocument()
  })

  it('no permite el nombre de otro artículo: avisa y no cambia nada', async () => {
    const { user, repositories } = await openCatalog(async (repos) => {
      await repos.items.create({ name: 'Calcetines' })
      await repos.items.create({ name: 'Calcetnes' })
    })

    await user.click(screen.getByRole('button', { name: /^Calcetnes,/ }))
    await user.click(screen.getByRole('button', { name: 'Renombrar' }))
    await user.keyboard('calcetines{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya existe un artículo llamado «Calcetines».',
    )
    expect((await repositories.items.list()).map((i) => i.name)).toEqual([
      'Calcetines',
      'Calcetnes',
    ])
  })
})

describe('Borrar', () => {
  it('un artículo sin usar: avisa de que no está en ninguna maleta y lo borra', async () => {
    const { user, repositories } = await openCatalog(async (repos) => {
      await repos.items.create({ name: 'Toalla' })
    })

    await user.click(screen.getByRole('button', { name: /^Toalla,/ }))
    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    const dialog = screen.getByRole('dialog', { name: '¿Borrar «Toalla»?' })
    expect(dialog).toHaveTextContent('No está en ninguna maleta.')
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }))

    expect(
      await screen.findByText(/Aún no tienes artículos/),
    ).toBeInTheDocument()
    expect(await repositories.items.list()).toEqual([])
  })

  it('un artículo usado: dice de qué maletas se quitará y lo quita de ellas', async () => {
    let luggageIds: string[] = []
    const { user, repositories } = await openCatalog(async (repos) => {
      const socks = await repos.items.create({ name: 'Calcetines' })
      luggageIds = [
        (await useInLuggage(repos, socks.id, 'Mochila')).id,
        (await useInLuggage(repos, socks.id, 'Grande')).id,
      ]
    })

    await user.click(screen.getByRole('button', { name: /^Calcetines,/ }))
    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    const dialog = screen.getByRole('dialog', { name: '¿Borrar «Calcetines»?' })
    // Intl.ListFormat: "Grande y Mochila" (orden alfabético).
    expect(dialog).toHaveTextContent(
      'Se quitará de las maletas Grande y Mochila.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }))

    expect(
      await screen.findByText(/Aún no tienes artículos/),
    ).toBeInTheDocument()
    for (const luggageId of luggageIds) {
      expect(await repositories.quantities.listByLuggage(luggageId)).toEqual([])
    }
  })
})
