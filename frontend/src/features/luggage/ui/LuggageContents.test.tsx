import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

/**
 * Tests del contenido de una maleta (iteración 4), de punta a punta:
 * UI → caso de uso → repositorios → IndexedDB en memoria.
 */
async function openLuggage(
  setup?: (
    r: ReturnType<typeof createTestRepositories>,
    luggageId: string,
  ) => Promise<void>,
) {
  const repositories = createTestRepositories()
  const luggage = await repositories.luggages.create({ name: 'Mochila' })
  await setup?.(repositories, luggage.id)
  renderApp(`/luggages/${luggage.id}`, repositories)
  await screen.findByRole('heading', { name: 'Mochila' })
  return { repositories, luggage, user: userEvent.setup() }
}

describe('Empaquetar (todo o nada) y progreso', () => {
  it('un toque guarda el artículo entero y otro lo saca; el progreso se actualiza', async () => {
    const { user } = await openLuggage(async (r, luggageId) => {
      for (const [name, num] of [
        ['Calcetines', 5],
        ['Pasaporte', 1],
      ] as const) {
        const item = await r.items.create({ name })
        await r.quantities.add({
          luggageId,
          itemId: item.id,
          num,
          nAlreadyPacked: 0,
        })
      }
    })
    const socks = await screen.findByRole('checkbox', { name: 'Calcetines' })
    expect(socks).not.toBeChecked()
    expect(screen.getByText('0 de 2 listos')).toBeInTheDocument()

    await user.click(socks)

    // Las 5 unidades de golpe, y cuenta como 1 artículo listo.
    expect(await screen.findByText('1 de 2 listos')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Calcetines' })).toBeChecked()

    await user.click(screen.getByRole('checkbox', { name: 'Pasaporte' }))
    expect(await screen.findByText('¡Maleta lista!')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Calcetines' }))
    expect(await screen.findByText('1 de 2 listos')).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Calcetines' }),
    ).not.toBeChecked()
  })

  it('cambiar las unidades de algo listo lo desmarca (sin número en el círculo); volver a ellas, lo marca', async () => {
    const { user } = await openLuggage(async (r, luggageId) => {
      const socks = await r.items.create({ name: 'Calcetines' })
      await r.quantities.add({
        luggageId,
        itemId: socks.id,
        num: 5,
        nAlreadyPacked: 5,
      })
    })
    const socks = () => screen.getByRole('checkbox', { name: 'Calcetines' })
    await user.click(
      await screen.findByRole('button', { name: /^Calcetines,/ }),
    )

    await user.click(
      screen.getByRole('button', { name: 'Una unidad más de Calcetines' }),
    )
    await waitFor(() => expect(socks()).not.toBeChecked())
    // Nada de "a medias" ni del número que tenía.
    expect(socks()).toHaveTextContent('')

    await user.click(
      screen.getByRole('button', { name: 'Una unidad menos de Calcetines' }),
    )
    await waitFor(() => expect(socks()).toBeChecked())
  })
})

describe('Cantidad y quitar (fila desplegada)', () => {
  async function openWithSocks(num = 1) {
    const ctx = await openLuggage(async (r, luggageId) => {
      const socks = await r.items.create({ name: 'Calcetines' })
      await r.quantities.add({
        luggageId,
        itemId: socks.id,
        num,
        nAlreadyPacked: 0,
      })
    })
    const details = await screen.findByRole('button', { name: /^Calcetines,/ })
    return { ...ctx, details }
  }

  it('tocar el nombre despliega − N + y la papelera; otro toque lo pliega', async () => {
    const { user, details } = await openWithSocks()
    expect(details).toHaveAttribute('aria-expanded', 'false')

    await user.click(details)

    expect(details).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('button', { name: 'Una unidad más de Calcetines' }),
    ).toBeInTheDocument()

    await user.click(details)
    expect(
      screen.queryByRole('button', { name: 'Una unidad más de Calcetines' }),
    ).not.toBeInTheDocument()
  })

  it('+ y − cambian la cantidad; − se desactiva en 1', async () => {
    const { user, details } = await openWithSocks(1)
    await user.click(details)
    const minus = screen.getByRole('button', {
      name: 'Una unidad menos de Calcetines',
    })
    expect(minus).toBeDisabled()

    await user.click(
      screen.getByRole('button', { name: 'Una unidad más de Calcetines' }),
    )

    // A la vista, solo el número; "unidades" está oculto a la vista pero en
    // la región aria-live: VoiceOver anuncia "2 unidades".
    expect(await screen.findByText('×2')).toBeInTheDocument()
    const count = screen.getByText(
      (_, element) =>
        element?.getAttribute('aria-live') === 'polite' &&
        element.textContent === '2 unidades',
    )
    expect(count.firstChild?.textContent).toBe('2')
    expect(minus).toBeEnabled()
  })

  it('solo una fila desplegada a la vez (acordeón)', async () => {
    const { user } = await openLuggage(async (r, luggageId) => {
      for (const name of ['Calcetines', 'Toalla']) {
        const item = await r.items.create({ name })
        await r.quantities.add({
          luggageId,
          itemId: item.id,
          num: 1,
          nAlreadyPacked: 0,
        })
      }
    })

    await user.click(
      await screen.findByRole('button', { name: /^Calcetines,/ }),
    )
    await user.click(screen.getByRole('button', { name: /^Toalla,/ }))

    expect(
      screen.getByRole('button', { name: /^Calcetines,/ }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /^Toalla,/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('la papelera pide confirmación y quita el artículo; el catálogo lo conserva', async () => {
    const { repositories, user, details } = await openWithSocks()
    await user.click(details)

    await user.click(
      screen.getByRole('button', { name: 'Quitar Calcetines de la maleta' }),
    )
    // Confirmación (decisión del usuario): el icono solo no lo dice todo.
    const dialog = screen.getByRole('dialog', {
      name: '¿Quitar «Calcetines» de la maleta?',
    })
    expect(dialog).toHaveTextContent('Seguirá en tu catálogo.')
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }))

    expect(
      await screen.findByText(/Esta maleta está vacía/),
    ).toBeInTheDocument()
    expect((await repositories.items.list()).map((i) => i.name)).toEqual([
      'Calcetines',
    ])
  })
})
