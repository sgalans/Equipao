import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { useNotifications } from '@/shared/ui/notifications/notificationStore'
import { chooseLuggageAction } from '@/test/luggageActions'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

afterEach(() => {
  useNotifications.setState({ message: null })
})

/**
 * Maleta "Mochila" con Cepillo y Pasta sueltos y un "Neceser" con Toalla.
 * Abre su detalle y entra en modo selección si se pide.
 */
async function setup({ select = true } = {}) {
  const repositories = createTestRepositories()
  const luggage = await repositories.luggages.create({ name: 'Mochila' })
  const kit = await repositories.compartments.create({
    luggageId: luggage.id,
    name: 'Neceser',
  })
  const ids: Record<string, string> = {}
  for (const name of ['Cepillo', 'Pasta', 'Toalla']) {
    ids[name] = (await repositories.items.create({ name })).id
  }
  await repositories.quantities.addMany(luggage.id, [ids.Cepillo, ids.Pasta])
  await repositories.quantities.addMany(luggage.id, [ids.Toalla], kit.id)
  renderApp(`/luggages/${luggage.id}`, repositories)
  await screen.findByRole('heading', { name: 'Mochila', level: 1 })
  const user = userEvent.setup()
  if (select) {
    await chooseLuggageAction(user, 'Mochila', 'Seleccionar artículos')
  }
  return { repositories, luggage, kit, user }
}

const region = (name: string) => screen.getByRole('region', { name })

describe('Seleccionar dentro de una maleta', () => {
  it('en modo selección solo se eligen artículos: fuera añadir, "listo", +, ⋯ y borrar maleta', async () => {
    await setup()

    // Las filas son casillas de selección (no empaquetan).
    expect(screen.getByRole('checkbox', { name: 'Cepillo' })).not.toBeChecked()
    expect(
      screen.queryByRole('link', { name: 'Añadir a la maleta' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('checkbox', { name: 'Neceser listo' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Añadir a Neceser' }),
    ).not.toBeInTheDocument()
    // Ni el ⋯ de la maleta: en su sitio, "Cancelar".
    expect(
      screen.queryByRole('button', { name: 'Acciones de Mochila' }),
    ).not.toBeInTheDocument()
    // Sin nada marcado, las acciones están desactivadas.
    expect(screen.getByRole('button', { name: 'Mover…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Quitar' })).toBeDisabled()
  })

  it('marcar en modo selección NO empaqueta', async () => {
    const { repositories, luggage, user } = await setup()

    await user.click(screen.getByRole('checkbox', { name: 'Cepillo' }))

    expect(screen.getByRole('checkbox', { name: 'Cepillo' })).toBeChecked()
    const lines = await repositories.quantities.listByLuggage(luggage.id)
    expect(lines.every((q) => q.nAlreadyPacked === 0)).toBe(true)
  })

  it('mueve los seleccionados a un compartimento existente', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('checkbox', { name: 'Cepillo' }))
    await user.click(screen.getByRole('checkbox', { name: 'Pasta' }))

    await user.click(screen.getByRole('button', { name: 'Mover 2…' }))
    const dialog = screen.getByRole('dialog', { name: 'Mover 2 artículos' })
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Dónde' }),
      'Neceser',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Mover' }))

    expect(
      await screen.findByText('Movidos 2 artículos a «Neceser».'),
    ).toBeInTheDocument()
    // Sale del modo selección y ahora están dentro del neceser.
    expect(
      screen.getByRole('button', { name: 'Acciones de Mochila' }),
    ).toBeVisible()
    // findBy: el aviso sale al terminar de guardar, y la lista se repinta un
    // instante después (useLiveQuery). Hay que esperar a la LISTA.
    expect(
      await within(region('Neceser')).findByRole('checkbox', {
        name: 'Cepillo',
      }),
    ).toBeInTheDocument()
  })

  it('mueve a un compartimento NUEVO: lo crea y los mete, todo de una vez', async () => {
    const { user, repositories, luggage } = await setup()
    await user.click(screen.getByRole('checkbox', { name: 'Cepillo' }))
    await user.click(screen.getByRole('checkbox', { name: 'Pasta' }))
    await user.click(screen.getByRole('button', { name: 'Mover 2…' }))
    const dialog = screen.getByRole('dialog')

    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Dónde' }),
      '+ Nuevo compartimento…',
    )
    const mover = within(dialog).getByRole('button', { name: 'Mover' })
    // Sin nombre no se puede.
    expect(mover).toBeDisabled()
    await user.type(
      within(dialog).getByRole('textbox', {
        name: 'Nombre del compartimento nuevo',
      }),
      'Aseo',
    )
    await user.click(mover)

    expect(
      await screen.findByText('Movidos 2 artículos a «Aseo».'),
    ).toBeInTheDocument()
    const aseo = await screen.findByRole('region', { name: 'Aseo' })
    expect(
      await within(aseo).findByRole('checkbox', { name: 'Pasta' }),
    ).toBeInTheDocument()
    expect(
      (await repositories.compartments.listByLuggage(luggage.id)).map(
        (c) => c.name,
      ),
    ).toEqual(['Neceser', 'Aseo'])
  })

  it('saca artículos de un compartimento (a sueltos)', async () => {
    const { user, repositories, luggage } = await setup()
    await user.click(screen.getByRole('checkbox', { name: 'Toalla' }))

    await user.click(screen.getByRole('button', { name: 'Mover 1…' }))
    // "Suelto en la maleta" es la opción por defecto.
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Mover' }),
    )

    expect(
      await screen.findByText('Movido 1 artículo a sueltos.'),
    ).toBeInTheDocument()
    const lines = await repositories.quantities.listByLuggage(luggage.id)
    expect(lines.every((q) => q.compartmentId === null)).toBe(true)
  })

  it('quitar varios pide confirmación y los quita (siguen en el catálogo)', async () => {
    const { user, repositories, luggage } = await setup()
    await user.click(screen.getByRole('checkbox', { name: 'Cepillo' }))
    await user.click(screen.getByRole('checkbox', { name: 'Toalla' }))

    await user.click(screen.getByRole('button', { name: 'Quitar 2' }))
    const dialog = screen.getByRole('dialog', {
      name: '¿Quitar 2 artículos de la maleta?',
    })
    expect(dialog).toHaveTextContent('Siguen en tu catálogo.')
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }))

    expect(
      await screen.findByText('Quitados 2 artículos de la maleta.'),
    ).toBeInTheDocument()
    const lines = await repositories.quantities.listEntriesByLuggage(luggage.id)
    expect(lines.map((e) => e.itemName)).toEqual(['Pasta'])
    // 3 artículos + el contenedor del compartimento del setup.
    expect(await repositories.items.list()).toHaveLength(4)
  })

  it('"Cancelar" sale del modo selección sin hacer nada', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('checkbox', { name: 'Cepillo' }))

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(
      screen.getByRole('link', { name: 'Añadir a la maleta' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Acciones de Mochila' }),
    ).toBeVisible()
  })

  it('con la maleta vacía, el ⋯ no ofrece "Seleccionar artículos"', async () => {
    const user = userEvent.setup()
    const repositories = createTestRepositories()
    const empty = await repositories.luggages.create({ name: 'Vacía' })
    renderApp(`/luggages/${empty.id}`, repositories)
    await screen.findByRole('heading', { name: 'Vacía', level: 1 })

    await user.click(screen.getByRole('button', { name: 'Acciones de Vacía' }))

    const sheet = screen.getByRole('dialog', { name: 'Vacía' })
    expect(
      within(sheet).queryByRole('button', { name: 'Seleccionar artículos' }),
    ).not.toBeInTheDocument()
  })
})
