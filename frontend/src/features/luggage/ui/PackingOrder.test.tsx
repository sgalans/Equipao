import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { chooseLuggageAction } from '@/test/luggageActions'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'
import { usePackingOrder } from './packingOrderStore'

type Repos = ReturnType<typeof createTestRepositories>
type User = ReturnType<typeof userEvent.setup>

/*
 * Listo es un dato del artículo; nada cambia de sitio nunca.
 * - Ojo "Ocultar listos": deja de pintar los artículos listos en la lista
 *   (por artículos: los compartimentos se quedan con su cabecera).
 * - Ventana "Listos" (tocando la barra de progreso): TODOS los listos, se
 *   vean o no, encima de la página.
 */

/** Abre una maleta "Grande" tras preparar datos con `arrange`. */
async function openLuggage(
  arrange: (repos: Repos, luggageId: string) => Promise<void>,
) {
  const repositories = createTestRepositories()
  const luggage = await repositories.luggages.create({ name: 'Grande' })
  await arrange(repositories, luggage.id)
  const rendered = renderApp(`/luggages/${luggage.id}`, repositories)
  await screen.findByRole('heading', { name: 'Grande', level: 1 })
  return { ...rendered, repositories, luggage, user: userEvent.setup() }
}

async function addItem(
  repos: Repos,
  luggageId: string,
  name: string,
  options: { compartmentId?: string; packed?: boolean } = {},
) {
  const item = await repos.items.create({ name })
  return repos.quantities.add({
    luggageId,
    itemId: item.id,
    compartmentId: options.compartmentId ?? null,
    num: 1,
    nAlreadyPacked: options.packed ? 1 : 0,
  })
}

/** Casillas de la página (fuera de la ventana "Listos"), en orden. */
function pageOrder() {
  const sheet = screen.queryByRole('dialog')
  return screen
    .getAllByRole('checkbox')
    .filter((checkbox) => !sheet?.contains(checkbox))
    .map((checkbox) => checkbox.getAttribute('aria-label'))
}

const eye = () => screen.getByRole('button', { name: 'Ocultar listos' })

/** Abre la ventana "Listos" tocando la barra de progreso. */
async function openReadyList(user: User) {
  await user.click(screen.getByRole('button', { name: /Ver los listos$/ }))
  return screen.getByRole('dialog', { name: 'Listos' })
}

/** Marca o desmarca un artículo (de la página) y espera a que se guarde. */
async function togglePacked(user: User, name: string) {
  const checkbox = screen.getByRole('checkbox', { name })
  const wasChecked = checkbox.getAttribute('aria-checked') === 'true'
  await user.click(checkbox)
  await waitFor(() =>
    expect(screen.getByRole('checkbox', { name })).toHaveAttribute(
      'aria-checked',
      String(!wasChecked),
    ),
  )
}

describe('Ojo "Ocultar listos"', () => {
  it('por defecto todo se ve en su orden y marcar no mueve nada', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await addItem(repos, luggageId, 'Camisetas', { packed: true })
      await addItem(repos, luggageId, 'Bañador')
      await addItem(repos, luggageId, 'Crema')
    })
    expect(eye()).toHaveAttribute('aria-pressed', 'false')

    await togglePacked(user, 'Bañador')

    expect(pageOrder()).toEqual(['Camisetas', 'Bañador', 'Crema'])
  })

  it('sin nada listo no hay ojo', async () => {
    await openLuggage(async (repos, luggageId) => {
      await addItem(repos, luggageId, 'Bañador')
    })

    expect(
      screen.queryByRole('button', { name: 'Ocultar listos' }),
    ).not.toBeInTheDocument()
  })

  it('oculta los listos SIN mover el resto; al volver a tocarlo, reaparecen en su sitio', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await addItem(repos, luggageId, 'Camisetas', { packed: true })
      await addItem(repos, luggageId, 'Bañador')
      await addItem(repos, luggageId, 'Gafas', { packed: true })
      await addItem(repos, luggageId, 'Crema')
    })

    await user.click(eye())
    expect(eye()).toHaveAttribute('aria-pressed', 'true')
    expect(pageOrder()).toEqual(['Bañador', 'Crema'])

    await user.click(eye())
    expect(eye()).toHaveAttribute('aria-pressed', 'false')
    expect(pageOrder()).toEqual(['Camisetas', 'Bañador', 'Gafas', 'Crema'])
  })

  it('con el ojo tachado, lo que se marca se queda a la vista y el ojo queda a medias (tachado y gris)', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await addItem(repos, luggageId, 'Camisetas', { packed: true })
      await addItem(repos, luggageId, 'Bañador')
      await addItem(repos, luggageId, 'Crema')
    })
    await user.click(eye())

    await togglePacked(user, 'Bañador')

    // Marcado pero a la vista: nada desaparece bajo el dedo. Algo sigue
    // oculto (Camisetas) y algo no: a medias ("mixed").
    expect(pageOrder()).toEqual(['Bañador', 'Crema'])
    expect(eye()).toHaveAttribute('aria-pressed', 'mixed')

    // A medias, un toque oculta TODO lo listo (pasa a azul).
    await user.click(eye())
    expect(pageOrder()).toEqual(['Crema'])
    expect(eye()).toHaveAttribute('aria-pressed', 'true')
  })

  it('va por artículos: dentro de un compartimento se ocultan sus listos y la cabecera se queda', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      const kit = await repos.compartments.create({
        luggageId,
        name: 'Neceser',
      })
      await addItem(repos, luggageId, 'Cepillo', {
        compartmentId: kit.id,
        packed: true,
      })
      await addItem(repos, luggageId, 'Pasta', { compartmentId: kit.id })
    })

    await user.click(eye())

    expect(pageOrder()).toEqual(['Neceser listo', 'Pasta'])
  })

  it('un compartimento con todo listo y oculto conserva su cabecera y lo explica', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      const kit = await repos.compartments.create({
        luggageId,
        name: 'Neceser',
      })
      await addItem(repos, luggageId, 'Cepillo', {
        compartmentId: kit.id,
        packed: true,
      })
    })

    await user.click(eye())

    expect(pageOrder()).toEqual(['Neceser listo'])
    expect(screen.getByText('Todo listo (oculto).')).toBeInTheDocument()
  })

  it('el "listo" propio de un compartimento no oculta nada', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      const kit = await repos.compartments.create({
        luggageId,
        name: 'Neceser',
      })
      await addItem(repos, luggageId, 'Cepillo', { compartmentId: kit.id })
    })
    await user.click(screen.getByRole('checkbox', { name: 'Neceser listo' }))
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'Neceser listo' }),
      ).toBeChecked(),
    )

    // Ningún ARTÍCULO listo: no hay nada que ocultar.
    expect(
      screen.queryByRole('button', { name: 'Ocultar listos' }),
    ).not.toBeInTheDocument()
  })
})

describe('Compartimentos completos (listos y con todo listo)', () => {
  /** Neceser con su "listo" y sus artículos según se indique. */
  async function withKit(
    repos: Repos,
    luggageId: string,
    { ready, allPacked }: { ready: boolean; allPacked: boolean },
  ) {
    const kit = await repos.compartments.create({ luggageId, name: 'Neceser' })
    await addItem(repos, luggageId, 'Cepillo', {
      compartmentId: kit.id,
      packed: true,
    })
    await addItem(repos, luggageId, 'Pasta', {
      compartmentId: kit.id,
      packed: allPacked,
    })
    if (ready) await repos.compartments.toggleReady(kit.id)
    await addItem(repos, luggageId, 'Bañador')
  }

  it('se ocultan ENTEROS al tocar el ojo', async () => {
    const { user } = await openLuggage((repos, luggageId) =>
      withKit(repos, luggageId, { ready: true, allPacked: true }),
    )

    await user.click(eye())

    expect(pageOrder()).toEqual(['Bañador'])
    expect(
      screen.queryByRole('region', { name: 'Neceser' }),
    ).not.toBeInTheDocument()
  })

  it('listo pero con algo sin guardar: se queda y solo oculta sus listos', async () => {
    const { user } = await openLuggage((repos, luggageId) =>
      withKit(repos, luggageId, { ready: true, allPacked: false }),
    )

    await user.click(eye())

    expect(pageOrder()).toEqual(['Bañador', 'Neceser listo', 'Pasta'])
  })

  it('completado con el ojo tachado, se queda a la vista y el ojo queda a medias', async () => {
    const { user } = await openLuggage((repos, luggageId) =>
      withKit(repos, luggageId, { ready: false, allPacked: true }),
    )
    await user.click(eye())

    await user.click(screen.getByRole('checkbox', { name: 'Neceser listo' }))
    await waitFor(() => expect(eye()).toHaveAttribute('aria-pressed', 'mixed'))
    // Nada desaparece bajo el dedo: el compartimento sigue ahí.
    expect(pageOrder()).toContain('Neceser listo')

    await user.click(eye())
    expect(pageOrder()).toEqual(['Bañador'])
  })
})

describe('Ventana "Listos" (tocando la barra de progreso)', () => {
  it('lista TODOS los listos, sueltos y de cada compartimento, aunque estén ocultos', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      const kit = await repos.compartments.create({
        luggageId,
        name: 'Neceser',
      })
      await addItem(repos, luggageId, 'Camisetas', { packed: true })
      await addItem(repos, luggageId, 'Bañador')
      await addItem(repos, luggageId, 'Cepillo', {
        compartmentId: kit.id,
        packed: true,
      })
    })
    await user.click(eye())

    const sheet = await openReadyList(user)

    expect(sheet).toHaveAccessibleName('Listos')
    expect(
      within(within(sheet).getByRole('region', { name: 'Sueltos' }))
        .getAllByRole('checkbox')
        .map((c) => c.getAttribute('aria-label')),
    ).toEqual(['Camisetas'])
    expect(
      within(within(sheet).getByRole('region', { name: 'Neceser' }))
        .getAllByRole('checkbox')
        .map((c) => c.getAttribute('aria-label')),
    ).toEqual(['Cepillo'])
  })

  it('desde la ventana se desmarca; el artículo se queda en ella hasta cerrar', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await addItem(repos, luggageId, 'Camisetas', { packed: true })
      await addItem(repos, luggageId, 'Bañador')
    })
    await user.click(eye())
    const sheet = await openReadyList(user)

    await user.click(within(sheet).getByRole('checkbox', { name: 'Camisetas' }))

    await waitFor(() =>
      expect(
        within(sheet).getByRole('checkbox', { name: 'Camisetas' }),
      ).not.toBeChecked(),
    )
    // Ya no está listo: vuelve a verse en la página, en su sitio.
    expect(pageOrder()).toEqual(['Camisetas', 'Bañador'])

    await user.click(within(sheet).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('un compartimento listo lleva un ✓ tras su nombre (y sale aunque no tenga artículos listos)', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      const kit = await repos.compartments.create({
        luggageId,
        name: 'Neceser',
      })
      await repos.compartments.toggleReady(kit.id)
      const bag = await repos.compartments.create({
        luggageId,
        name: 'Mochila',
      })
      await addItem(repos, luggageId, 'Libro', {
        compartmentId: bag.id,
        packed: true,
      })
    })

    const sheet = await openReadyList(user)

    // VoiceOver: "Neceser, listo". La Mochila (sin su "listo") no lo lleva.
    expect(
      within(sheet).getByRole('heading', { name: 'Neceser, listo' }),
    ).toBeInTheDocument()
    expect(
      within(sheet).getByRole('heading', { name: 'Mochila' }),
    ).toBeInTheDocument()
  })

  it('sin nada listo, lo dice', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await addItem(repos, luggageId, 'Bañador')
    })

    const sheet = await openReadyList(user)

    expect(
      within(sheet).getByText('Aún no hay nada listo.'),
    ).toBeInTheDocument()
  })
})

describe('Se recuerda', () => {
  it('al salir de la maleta y volver', async () => {
    const { user, router, luggage } = await openLuggage(
      async (repos, luggageId) => {
        await addItem(repos, luggageId, 'Camisetas', { packed: true })
        await addItem(repos, luggageId, 'Bañador')
      },
    )
    await user.click(eye())

    await router.navigate('/')
    await screen.findByRole('link', { name: /^Grande,/ })
    await router.navigate(`/luggages/${luggage.id}`)
    await screen.findByRole('heading', { name: 'Grande', level: 1 })

    expect(pageOrder()).toEqual(['Bañador'])
    expect(eye()).toHaveAttribute('aria-pressed', 'true')
  })

  it('al recargar: se guarda en localStorage', async () => {
    const { user, luggage } = await openLuggage(async (repos, luggageId) => {
      await addItem(repos, luggageId, 'Camisetas', { packed: true })
    })

    await user.click(eye())

    const saved = JSON.parse(
      localStorage.getItem('luggage-app:hidden-packed-v2') ?? '{}',
    )
    expect(saved.state.hidden[luggage.id]).toHaveLength(1)
  })

  it('al borrar la maleta, se olvida lo oculto', async () => {
    const { user, luggage } = await openLuggage(async (repos, luggageId) => {
      await addItem(repos, luggageId, 'Camisetas', { packed: true })
    })
    await user.click(eye())

    await chooseLuggageAction(user, 'Grande', 'Borrar maleta')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Borrar',
      }),
    )

    await waitFor(() =>
      expect(usePackingOrder.getState().hidden[luggage.id]).toBeUndefined(),
    )
  })
})

describe('Ventana "Listos": se cierra como la hoja del ⋯', () => {
  it('tocando fuera se cierra; tocando dentro, no', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await addItem(repos, luggageId, 'Camisetas', { packed: true })
    })

    const sheet = await openReadyList(user)
    // Dentro (el título): sigue abierta.
    await user.click(within(sheet).getByRole('heading', { name: 'Listos' }))
    expect(sheet).toBeVisible()

    // En el fondo: un toque ahí llega como clic sobre el propio <dialog>.
    await user.click(sheet)
    expect(
      screen.queryByRole('dialog', { name: 'Listos' }),
    ).not.toBeInTheDocument()
  })
})
