import { screen } from '@testing-library/react'
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

  it('un artículo a medias (5/6) se muestra como "mixed" con el número guardado', async () => {
    await openLuggage(async (r, luggageId) => {
      const socks = await r.items.create({ name: 'Calcetines' })
      await r.quantities.add({
        luggageId,
        itemId: socks.id,
        num: 6,
        nAlreadyPacked: 5,
      })
    })

    const socks = await screen.findByRole('checkbox', { name: 'Calcetines' })
    expect(socks).toHaveAttribute('aria-checked', 'mixed')
    expect(socks).toHaveTextContent('5')
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

    expect(await screen.findByText('2 unidades')).toBeInTheDocument()
    expect(screen.getByText('×2')).toBeInTheDocument()
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

  it('la papelera quita el artículo sin confirmación; el catálogo lo conserva', async () => {
    const { repositories, user, details } = await openWithSocks()
    await user.click(details)

    await user.click(
      screen.getByRole('button', { name: 'Quitar Calcetines de la maleta' }),
    )

    expect(
      await screen.findByText(/Esta maleta está vacía/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect((await repositories.items.list()).map((i) => i.name)).toEqual([
      'Calcetines',
    ])
  })
})
