import { screen } from '@testing-library/react'
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

/** Mete un artículo del catálogo (por nombre) en la maleta. */
async function putInLuggage(repos: Repos, luggageId: string, name: string) {
  const item = (await repos.items.list()).find((i) => i.name === name)!
  await repos.quantities.add({
    luggageId,
    itemId: item.id,
    num: 1,
    nAlreadyPacked: 0,
  })
}

const addPage = (id: string) => `/luggages/${id}/add-items`
const field = () =>
  screen.getByRole('searchbox', { name: 'Buscar o crear artículos' })
const createButton = () =>
  screen.getByRole('button', { name: /como artículo$/ })

describe('Llegar a "Añadir artículos"', () => {
  it('"+ Añadir a la maleta" lleva aquí y "‹ Maleta" vuelve a ella', async () => {
    const { user, router, luggage } = await setup((id) => `/luggages/${id}`)

    await user.click(
      await screen.findByRole('link', { name: 'Añadir a la maleta' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Añadir a «Mochila»' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Maleta' }))
    expect(router.state.location.pathname).toBe(`/luggages/${luggage.id}`)
  })

  it('"Añadir" en ⋯ de un compartimento añade AHÍ, sin preguntar dónde', async () => {
    let kitId = ''
    const { user, luggage, repositories } = await setup(
      (id) => `/luggages/${id}`,
      async (repos, luggageId) => {
        kitId = (
          await repos.compartments.create({ luggageId, name: 'Neceser' })
        ).id
      },
    )

    // Está en sus acciones (⋯), junto a ↑ ↓ ✎ 🗑.
    await user.click(
      await screen.findByRole('button', { name: 'Más acciones de Neceser' }),
    )
    await user.click(screen.getByRole('link', { name: 'Añadir a Neceser' }))
    // El título es siempre la maleta; el destino, "Dónde" (ya en Neceser).
    expect(
      await screen.findByRole('heading', { name: 'Añadir a «Mochila»' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Dónde' })).toHaveDisplayValue(
      'Neceser',
    )
    await user.click(screen.getByRole('checkbox', { name: /^Cepillo/ }))
    await user.click(screen.getByRole('button', { name: 'Añadir 1 a Neceser' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      await screen.findByText('Añadido 1 artículo a «Neceser».'),
    ).toBeInTheDocument()
    const [added] = await repositories.quantities.listByLuggage(luggage.id)
    expect(added.compartmentId).toBe(kitId)
  })
})

describe('Elegir y añadir', () => {
  it('lo que ya está en la maleta se ve, atenuado y sin poder elegirse', async () => {
    await setup(addPage, async (repos, luggageId) => {
      await putInLuggage(repos, luggageId, 'Cepillo')
    })

    const brush = await screen.findByRole('checkbox', {
      name: 'Cepillo, Ya en la maleta',
    })
    expect(brush).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /^Pasta/ })).toBeEnabled()
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

  it('"Dónde" está en la barra, con "Suelto en la maleta" por defecto; sin ventana emergente', async () => {
    let kitId = ''
    const { user, luggage, repositories } = await setup(
      addPage,
      async (repos, luggageId) => {
        kitId = (
          await repos.compartments.create({ luggageId, name: 'Neceser' })
        ).id
      },
    )
    const where = await screen.findByRole('combobox', { name: 'Dónde' })
    expect(where).toHaveDisplayValue('Suelto en la maleta')

    await user.click(screen.getByRole('checkbox', { name: /^Cepillo/ }))
    await user.selectOptions(where, 'Neceser')
    // El botón dice adónde va.
    await user.click(screen.getByRole('button', { name: 'Añadir 1 a Neceser' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      await screen.findByText('Añadido 1 artículo a «Neceser».'),
    ).toBeInTheDocument()
    const [added] = await repositories.quantities.listByLuggage(luggage.id)
    expect(added.compartmentId).toBe(kitId)
  })

  it('sin nada marcado, el botón dice "Elige qué añadir" y está desactivado', async () => {
    await setup(addPage)

    expect(
      await screen.findByRole('button', { name: 'Elige qué añadir' }),
    ).toBeDisabled()
  })
})

describe('Casillas: ○ sin elegir, ✓ elegido, ✓ gris ya en la maleta', () => {
  it('lo que ya está en la maleta lleva su ✓ (gris) y se distingue de lo que no', async () => {
    const { user } = await setup(addPage, async (repos, luggageId) => {
      await putInLuggage(repos, luggageId, 'Cepillo')
    })

    const inLuggage = await screen.findByRole('checkbox', {
      name: 'Cepillo, Ya en la maleta',
    })
    const free = screen.getByRole('checkbox', { name: /^Toalla,/ })
    // El ✓ es un <svg> dentro del círculo: "ya incluido".
    expect(inLuggage.querySelector('svg')).not.toBeNull()
    expect(free.querySelector('svg')).toBeNull()

    await user.click(free)
    expect(free).toBeChecked()
    expect(free.querySelector('svg')).not.toBeNull()
  })
})

describe('Buscar o crear', () => {
  it('escribir filtra sin distinguir tildes', async () => {
    const { user } = await setup(addPage, async (repos) => {
      await repos.items.create({ name: 'Cámara' })
    })

    await user.type(await screen.findByRole('searchbox'), 'camara')

    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByRole('checkbox', { name: /^Cámara/ })).toBeEnabled()
  })

  it('"+ Artículo" con un nombre nuevo crea el artículo y lo AÑADE a la maleta; se queda aquí', async () => {
    const { user, repositories, luggage, router } = await setup(addPage)

    await user.type(await screen.findByRole('searchbox'), 'Bañador')
    expect(
      screen.getByText('Ningún artículo coincide con «Bañador».'),
    ).toBeInTheDocument()
    await user.click(createButton())

    expect(
      await screen.findByText('«Bañador» creado y añadido a «Mochila».'),
    ).toBeInTheDocument()
    // Ya está en la maleta: la fila lo dice y no se puede volver a elegir.
    expect(
      await screen.findByRole('checkbox', { name: 'Bañador, Ya en la maleta' }),
    ).toBeDisabled()
    expect(field()).toHaveValue('')
    expect(field()).toHaveFocus()
    expect(router.state.location.pathname).toBe(addPage(luggage.id))
    const entries = await repositories.quantities.listEntriesByLuggage(
      luggage.id,
    )
    expect(entries.map((e) => e.itemName)).toEqual(['Bañador'])
  })

  it('desde un compartimento, lo creado entra en ese compartimento', async () => {
    let kitId = ''
    const { user, luggage, repositories } = await setup(
      (id) => `/luggages/${id}/add-items?compartment=${kitId}`,
      async (repos, luggageId) => {
        kitId = (
          await repos.compartments.create({ luggageId, name: 'Neceser' })
        ).id
      },
    )

    await user.type(await screen.findByRole('searchbox'), 'Peine')
    await user.click(createButton())

    expect(
      await screen.findByText('«Peine» creado y añadido a «Neceser».'),
    ).toBeInTheDocument()
    const [added] = await repositories.quantities.listByLuggage(luggage.id)
    expect(added.compartmentId).toBe(kitId)
  })

  it('con un nombre que ya existe no se puede crear (atenuados): se elige en la lista', async () => {
    const { user } = await setup(addPage, async (repos, luggageId) => {
      await putInLuggage(repos, luggageId, 'Cepillo')
    })

    await user.type(await screen.findByRole('searchbox'), 'toalla')
    expect(screen.getByRole('button', { name: 'Artículo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Compartimento' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /^Toalla/ })).toBeEnabled()

    // Si ya está en la maleta, la fila lo dice.
    await user.clear(field())
    await user.type(field(), 'cepillo')
    expect(
      screen.getByRole('checkbox', { name: 'Cepillo, Ya en la maleta' }),
    ).toBeDisabled()
  })

  it('Intro NUNCA crea: el campo solo busca', async () => {
    const { user, repositories } = await setup(addPage)

    await user.type(await screen.findByRole('searchbox'), 'Bañador{Enter}')

    expect(await repositories.items.list()).toHaveLength(3)
  })

  it('con el catálogo vacío, explica cómo crear el primero', async () => {
    const repositories = createTestRepositories()
    const luggage = await repositories.luggages.create({ name: 'Mochila' })
    renderApp(addPage(luggage.id), repositories)

    expect(
      await screen.findByText(/Aún no tienes artículos\. Escribe arriba/),
    ).toBeInTheDocument()
  })
})

it('maleta inexistente → "no encontrada"', async () => {
  renderApp('/luggages/0190a0a0-0000-7000-8000-000000000000/add-items')

  expect(
    await screen.findByRole('heading', {
      name: 'No encontramos esta maleta',
    }),
  ).toBeInTheDocument()
})

describe('Compartimentos en "Añadir artículos"', () => {
  /** Catálogo con dos contenedores: Neceser y Mochila de mano. */
  async function withContainers(repos: Repos) {
    await repos.items.create({ name: 'Neceser', isContainer: true })
    await repos.items.create({ name: 'Mochila de mano', isContainer: true })
  }

  it('los contenedores salen en su sección, arriba, y elegirlos los añade como compartimentos', async () => {
    const { user, repositories, luggage } = await setup(addPage, withContainers)

    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual([
      'Compartimentos',
      'Artículos',
    ])
    await user.click(screen.getByRole('checkbox', { name: /^Neceser,/ }))
    await user.click(screen.getByRole('checkbox', { name: /^Toalla,/ }))
    await user.click(
      screen.getByRole('button', { name: 'Añadir 2 a la maleta' }),
    )

    // Sin compartimentos previos, no pregunta dónde: la Toalla, suelta.
    await screen.findByRole('heading', { name: 'Mochila', level: 1 })
    expect(
      (await repositories.compartments.listByLuggage(luggage.id)).map(
        (c) => c.name,
      ),
    ).toEqual(['Neceser'])
    const [towel] = await repositories.quantities.listByLuggage(luggage.id)
    expect(towel?.compartmentId).toBeNull()
  })

  it('un compartimento que ya está en la maleta sale como "Ya en la maleta"', async () => {
    await setup(addPage, async (repos, luggageId) => {
      await repos.compartments.create({ luggageId, name: 'Neceser' })
    })

    expect(
      await screen.findByRole('checkbox', { name: 'Neceser, Ya en la maleta' }),
    ).toBeDisabled()
  })

  it('solo compartimentos elegidos: no pregunta dónde aunque la maleta tenga compartimentos', async () => {
    const { user, repositories, luggage } = await setup(
      addPage,
      async (repos, luggageId) => {
        await withContainers(repos)
        await repos.compartments.create({ luggageId, name: 'Neceser' })
      },
    )

    await user.click(
      await screen.findByRole('checkbox', { name: /^Mochila de mano,/ }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Añadir 1 a la maleta' }),
    )

    await screen.findByRole('heading', { name: 'Mochila', level: 1 })
    expect(
      (await repositories.compartments.listByLuggage(luggage.id)).map(
        (c) => c.name,
      ),
    ).toEqual(['Neceser', 'Mochila de mano'])
  })

  it('"Crear «X» como compartimento" lo crea y lo añade; se queda aquí', async () => {
    const { user, repositories, luggage } = await setup(addPage)

    await user.type(await screen.findByRole('searchbox'), 'Riñonera')
    await user.click(
      screen.getByRole('button', {
        name: 'Crear «Riñonera» como compartimento',
      }),
    )

    expect(
      await screen.findByText(
        '«Riñonera» creado y añadido como compartimento.',
      ),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('checkbox', {
        name: 'Riñonera, Ya en la maleta',
      }),
    ).toBeDisabled()
    const [compartment] = await repositories.compartments.listByLuggage(
      luggage.id,
    )
    expect(compartment?.name).toBe('Riñonera')
    const item = await repositories.items.getById(compartment?.itemId ?? '')
    expect(item?.isContainer).toBe(true)
  })

  it('un compartimento elegido sale en "Dónde" como nuevo y lo marcado entra en él, todo de una vez', async () => {
    const { user, repositories, luggage } = await setup(addPage, withContainers)

    await user.click(
      await screen.findByRole('checkbox', { name: /^Mochila de mano,/ }),
    )
    await user.click(screen.getByRole('checkbox', { name: /^Toalla,/ }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Dónde' }),
      'Mochila de mano (compartimento nuevo)',
    )
    await user.click(
      screen.getByRole('button', { name: 'Añadir 2 a Mochila de mano' }),
    )

    await screen.findByRole('heading', { name: 'Mochila', level: 1 })
    const [bag] = await repositories.compartments.listByLuggage(luggage.id)
    expect(bag?.name).toBe('Mochila de mano')
    const [towel] = await repositories.quantities.listByLuggage(luggage.id)
    expect(towel?.compartmentId).toBe(bag?.id)
  })

  it('si se desmarca, su opción desaparece de "Dónde" y vuelve a "Suelto"', async () => {
    const { user } = await setup(addPage, withContainers)
    const bag = await screen.findByRole('checkbox', {
      name: /^Mochila de mano,/,
    })
    const where = () => screen.getByRole('combobox', { name: 'Dónde' })

    await user.click(bag)
    await user.selectOptions(where(), 'Mochila de mano (compartimento nuevo)')
    await user.click(bag)

    expect(where()).toHaveDisplayValue('Suelto en la maleta')
    expect(
      screen.queryByRole('option', {
        name: 'Mochila de mano (compartimento nuevo)',
      }),
    ).not.toBeInTheDocument()
  })

  it('con destino un compartimento, avisa de que los compartimentos van a la maleta (no dentro)', async () => {
    const { user } = await setup(addPage, async (repos, luggageId) => {
      await withContainers(repos)
      await repos.compartments.create({ luggageId, name: 'Neceser' })
    })

    await user.click(
      await screen.findByRole('checkbox', { name: /^Mochila de mano,/ }),
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Dónde' }),
      'Neceser',
    )

    expect(
      screen.getByText(
        'El compartimento «Mochila de mano» se añadirá suelto en la maleta, no dentro del compartimento «Neceser».',
      ),
    ).toBeInTheDocument()
  })
})
