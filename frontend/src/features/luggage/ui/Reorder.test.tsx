import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { chooseLuggageAction } from '@/test/luggageActions'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

type Repos = ReturnType<typeof createTestRepositories>

/*
 * "Subir"/"Bajar" en el panel de la fila: la alternativa a arrastrar con el
 * asa (WCAG 2.2 SC 2.5.7). El gesto de arrastrar se prueba en el iPhone (y
 * algún día con Playwright): jsdom no simula bien un arrastre táctil.
 */

async function openLuggage(
  arrange: (repos: Repos, luggageId: string) => Promise<void>,
) {
  const repositories = createTestRepositories()
  const luggage = await repositories.luggages.create({ name: 'Grande' })
  await arrange(repositories, luggage.id)
  renderApp(`/luggages/${luggage.id}`, repositories)
  await screen.findByRole('heading', { name: 'Grande', level: 1 })
  return { repositories, luggage, user: userEvent.setup() }
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

const order = () =>
  screen
    .getAllByRole('checkbox')
    .map((checkbox) => checkbox.getAttribute('aria-label'))

/** Abre el panel de un artículo (tocando su nombre). */
async function openPanel(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(
    screen.getByRole('button', { name: new RegExp(`^${name},`) }),
  )
}

describe('Subir / Bajar', () => {
  it('sube y baja un artículo entre sus vecinos; el panel sigue abierto', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      for (const name of ['A', 'B', 'C']) await addItem(repos, luggageId, name)
    })
    await openPanel(user, 'C')

    await user.click(screen.getByRole('button', { name: 'Subir C' }))
    await waitFor(() => expect(order()).toEqual(['A', 'C', 'B']))

    await user.click(screen.getByRole('button', { name: 'Subir C' }))
    await waitFor(() => expect(order()).toEqual(['C', 'A', 'B']))
    // Arriba del todo: ya no puede subir más.
    expect(screen.getByRole('button', { name: 'Subir C' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Bajar C' }))
    await waitFor(() => expect(order()).toEqual(['A', 'C', 'B']))
  })

  it('abajo del todo, "Bajar" está desactivado', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      for (const name of ['A', 'B']) await addItem(repos, luggageId, name)
    })
    await openPanel(user, 'B')

    expect(screen.getByRole('button', { name: 'Bajar B' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Subir B' })).toBeEnabled()
  })

  it('se mueve DENTRO de su compartimento (los sueltos no cuentan)', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      const kit = await repos.compartments.create({
        luggageId,
        name: 'Neceser',
      })
      await addItem(repos, luggageId, 'Suelto')
      await addItem(repos, luggageId, 'Cepillo', { compartmentId: kit.id })
      await addItem(repos, luggageId, 'Pasta', { compartmentId: kit.id })
    })
    await openPanel(user, 'Cepillo')

    // Primero de su compartimento: no sube por encima del suelto.
    expect(screen.getByRole('button', { name: 'Subir Cepillo' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Bajar Cepillo' }))

    await waitFor(() =>
      expect(order()).toEqual(['Suelto', 'Neceser listo', 'Pasta', 'Cepillo']),
    )
  })

  it('con los listos ocultos, salta lo oculto (se mueve respecto a lo que se ve)', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await addItem(repos, luggageId, 'A')
      await addItem(repos, luggageId, 'Oculto', { packed: true })
      await addItem(repos, luggageId, 'C')
    })
    await user.click(screen.getByRole('button', { name: 'Ocultar listos' }))
    await openPanel(user, 'C')

    await user.click(screen.getByRole('button', { name: 'Subir C' }))

    await waitFor(() => expect(order()).toEqual(['C', 'A']))
  })
})

describe('Asa para arrastrar', () => {
  it('cada fila tiene su asa ≡ "Ordenar …"; en modo selección no', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      for (const name of ['A', 'B']) await addItem(repos, luggageId, name)
    })

    expect(
      screen.getByRole('button', { name: 'Ordenar A' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ordenar B' }),
    ).toBeInTheDocument()

    await chooseLuggageAction(user, 'Grande', 'Seleccionar artículos')
    expect(
      screen.queryByRole('button', { name: /^Ordenar/ }),
    ).not.toBeInTheDocument()
  })
})

describe('Ordenar compartimentos', () => {
  /** Nombres de los compartimentos, en el orden de la pantalla. */
  const compartmentOrder = () =>
    screen
      .getAllByRole('checkbox', { name: / listo$/ })
      .map((c) => c.getAttribute('aria-label')?.replace(/ listo$/, ''))

  it('"Subir"/"Bajar" en ⋯ mueven el compartimento; en los bordes, desactivados', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      for (const name of ['Neceser', 'Mochila', 'Bolsa']) {
        await repos.compartments.create({ luggageId, name })
      }
    })
    await user.click(
      screen.getByRole('button', { name: 'Más acciones de Bolsa' }),
    )
    expect(screen.getByRole('button', { name: 'Bajar Bolsa' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Subir Bolsa' }))
    await waitFor(() =>
      expect(compartmentOrder()).toEqual(['Neceser', 'Bolsa', 'Mochila']),
    )

    await user.click(screen.getByRole('button', { name: 'Subir Bolsa' }))
    await waitFor(() =>
      expect(compartmentOrder()).toEqual(['Bolsa', 'Neceser', 'Mochila']),
    )
    expect(screen.getByRole('button', { name: 'Subir Bolsa' })).toBeDisabled()
  })

  it('cada compartimento tiene su asa ≡; en modo selección no', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await repos.compartments.create({ luggageId, name: 'Neceser' })
      await addItem(repos, luggageId, 'A')
    })

    expect(
      screen.getByRole('button', { name: 'Ordenar Neceser' }),
    ).toBeInTheDocument()

    await chooseLuggageAction(user, 'Grande', 'Seleccionar artículos')
    expect(
      screen.queryByRole('button', { name: 'Ordenar Neceser' }),
    ).not.toBeInTheDocument()
  })
})
