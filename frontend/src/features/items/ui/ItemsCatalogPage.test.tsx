import { screen, waitFor, within } from '@testing-library/react'
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
  await screen.findByRole('heading', { name: 'Catálogo', level: 1 })
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
  it('"Catálogo" en la cabecera del inicio lleva al catálogo, y se vuelve con "‹ Mis maletas"', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/')

    await user.click(screen.getByRole('link', { name: 'Catálogo' }))

    // Primero la pantalla y DESPUÉS la URL: el catálogo se carga bajo
    // demanda (code splitting) y React Router no cambia de pantalla ni de URL
    // hasta tenerlo descargado (así nunca hay una pantalla en blanco).
    expect(
      await screen.findByRole('heading', { name: 'Catálogo', level: 1 }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/items')

    await user.click(screen.getByRole('link', { name: 'Mis maletas' }))
    expect(router.state.location.pathname).toBe('/')
  })

  it('sin artículos explica de dónde salen', async () => {
    await openCatalog()

    expect(
      screen.getByText(/Aún no tienes artículos\. Escribe arriba/),
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

  it('con el nombre de otro artículo, propone UNIRLOS; cancelar no cambia nada', async () => {
    const { user, repositories } = await openCatalog(async (repos) => {
      await repos.items.create({ name: 'Calcetines' })
      await repos.items.create({ name: 'Calcetnes' })
    })

    await user.click(screen.getByRole('button', { name: /^Calcetnes,/ }))
    await user.click(screen.getByRole('button', { name: 'Renombrar' }))
    await user.keyboard('calcetines{Enter}')

    const dialog = await screen.findByRole('dialog', {
      name: 'Ya existe «Calcetines»',
    })
    expect(dialog).toHaveTextContent('¿Unir «Calcetnes» con «Calcetines»?')
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    expect((await repositories.items.list()).map((i) => i.name)).toEqual([
      'Calcetines',
      'Calcetnes',
    ])
  })

  it('"Unir" deja solo el destino, también en las maletas', async () => {
    let luggageId = ''
    const { user, repositories } = await openCatalog(async (repos) => {
      await repos.items.create({ name: 'Calcetines' })
      const typo = await repos.items.create({ name: 'Calcetnes' })
      luggageId = (await useInLuggage(repos, typo.id, 'Grande')).id
    })

    await user.click(screen.getByRole('button', { name: /^Calcetnes,/ }))
    await user.click(screen.getByRole('button', { name: 'Renombrar' }))
    await user.keyboard('calcetines{Enter}')
    const dialog = await screen.findByRole('dialog', {
      name: 'Ya existe «Calcetines»',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Unir' }))

    expect(
      await screen.findByRole('button', { name: 'Calcetines, En 1 maleta' }),
    ).toBeInTheDocument()
    expect((await repositories.items.list()).map((i) => i.name)).toEqual([
      'Calcetines',
    ])
    const [line] = await repositories.quantities.listEntriesByLuggage(luggageId)
    expect(line.itemName).toBe('Calcetines')
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

describe('Campo único "Buscar o crear"', () => {
  const field = () =>
    screen.getByRole('searchbox', { name: 'Buscar o crear artículos' })
  const createButton = () =>
    screen.getByRole('button', { name: /como artículo$/ })

  it('escribir filtra sin distinguir tildes, y avisa si no hay resultados', async () => {
    const { user } = await openCatalog(async (repos) => {
      await repos.items.create({ name: 'Cámara' })
      await repos.items.create({ name: 'Toalla' })
    })

    await user.type(field(), 'camara')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /^Cámara,/ })).toBeInTheDocument()

    await user.clear(field())
    await user.type(field(), 'zzz')
    expect(
      screen.getByText('Ningún artículo coincide con «zzz».'),
    ).toBeInTheDocument()
    // Con un nombre nuevo, las dos formas de crearlo, una al lado de otra.
    expect(
      screen.getByRole('button', { name: 'Crear «zzz» como artículo' }),
    ).toHaveTextContent('Artículo')
    expect(
      screen.getByRole('button', { name: 'Crear «zzz» como compartimento' }),
    ).toHaveTextContent('Compartimento')
  })

  it('"+ Artículo" crea el artículo, vacía el campo y mantiene el foco', async () => {
    const { user, repositories } = await openCatalog()

    await user.type(field(), 'Toalla')
    await user.click(createButton())

    expect(
      await screen.findByRole('button', { name: 'Toalla, Sin usar' }),
    ).toBeInTheDocument()
    expect(field()).toHaveValue('')
    expect(field()).toHaveFocus()
    expect((await repositories.items.list()).map((i) => i.name)).toEqual([
      'Toalla',
    ])
  })

  it('Intro NUNCA crea: el campo solo busca', async () => {
    const { user, repositories } = await openCatalog()

    await user.type(field(), 'Toalla{Enter}')

    expect(await repositories.items.list()).toEqual([])
    expect(field()).toHaveValue('Toalla')
  })

  it('si el nombre ya existe, no se puede crear (atenuados): la lista ya lo muestra', async () => {
    const { user } = await openCatalog(async (repos) => {
      await repos.items.create({ name: 'Cámara' })
    })

    await user.type(field(), 'camara')

    expect(screen.getByRole('button', { name: 'Artículo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Compartimento' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^Cámara,/ })).toBeInTheDocument()
  })

  it('con el campo vacío los botones de crear se ven, pero desactivados (la lista no salta al escribir)', async () => {
    await openCatalog()

    expect(screen.getByRole('button', { name: 'Artículo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Compartimento' })).toBeDisabled()
  })

  it('la ayuda de qué es un compartimento sale solo si aún no tienes ninguno', async () => {
    const { user } = await openCatalog()

    await user.type(field(), 'Mochila')
    expect(
      screen.getByText(
        'Compartimento: contenedor para meter artículos, como un neceser, una mochila o un maletín.',
      ),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: 'Crear «Mochila» como compartimento',
      }),
    )
    await user.type(field(), 'Riñonera')
    expect(
      screen.queryByText(
        'Compartimento: contenedor para meter artículos, como un neceser, una mochila o un maletín.',
      ),
    ).toBeNull()
  })
})

describe('Compartimentos en el catálogo', () => {
  it('los contenedores salen en su sección, arriba', async () => {
    await openCatalog(async (repos) => {
      await repos.items.create({ name: 'Bañador' })
      await repos.items.create({ name: 'Neceser', isContainer: true })
    })

    const [containers, regular] = screen.getAllByRole('list')
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['Compartimentos', 'Artículos'])
    // Por la fila (botón): el título de su hoja de acciones, aunque cerrada,
    // también lleva el nombre.
    expect(
      within(containers!).getByRole('button', { name: /^Neceser,/ }),
    ).toBeInTheDocument()
    expect(
      within(regular!).getByRole('button', { name: /^Bañador,/ }),
    ).toBeInTheDocument()
  })

  it('sin contenedores, una sola lista sin cabeceras', async () => {
    await openCatalog(async (repos) => {
      await repos.items.create({ name: 'Bañador' })
    })

    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
  })

  it('"Crear «X» como compartimento" crea un contenedor', async () => {
    const { user, repositories } = await openCatalog()

    await user.type(screen.getByRole('searchbox'), 'Mochila')
    await user.click(
      screen.getByRole('button', {
        name: 'Crear «Mochila» como compartimento',
      }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Compartimentos' }),
    ).toBeInTheDocument()
    expect((await repositories.items.findByName('Mochila'))?.isContainer).toBe(
      true,
    )
  })

  it('sin usar, "Convertir en compartimento" lo marca (y se puede deshacer)', async () => {
    const { user, repositories } = await openCatalog(async (repos) => {
      await repos.items.create({ name: 'Mochila' })
    })

    const row = () => screen.getByRole('button', { name: 'Mochila, Sin usar' })
    const sheet = () => screen.getByRole('dialog', { name: 'Mochila' })

    // Fila → hoja de acciones → "Convertir en compartimento".
    await user.click(row())
    await user.click(
      within(sheet()).getByRole('button', {
        name: 'Convertir en compartimento',
      }),
    )
    // Pasa a la sección de compartimentos.
    expect(
      await screen.findByRole('heading', { name: 'Compartimentos' }),
    ).toBeInTheDocument()
    expect((await repositories.items.findByName('Mochila'))?.isContainer).toBe(
      true,
    )

    // Al volver a abrir la hoja, la opción contraria.
    await user.click(row())
    await user.click(
      within(sheet()).getByRole('button', { name: 'Convertir en artículo' }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Compartimentos' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('si está en alguna maleta, explica qué hacer y no lo cambia (opción A)', async () => {
    const { user, repositories } = await openCatalog(async (repos) => {
      const bag = await repos.items.create({ name: 'Mochila' })
      await useInLuggage(repos, bag.id, 'Grande')
    })

    await user.click(
      await screen.findByRole('button', { name: 'Mochila, En 1 maleta' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Convertir en compartimento' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Para convertirlo, quítalo antes de la maleta Grande.',
    )
    expect((await repositories.items.findByName('Mochila'))?.isContainer).toBe(
      false,
    )
  })
})
