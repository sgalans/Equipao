import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

/** Abre el detalle de una maleta "Mochila" con la descripción dada. */
async function openLuggage(description = '') {
  const repositories = createTestRepositories()
  const luggage = await repositories.luggages.create({
    name: 'Mochila',
    description,
  })
  const rendered = renderApp(`/luggages/${luggage.id}`, repositories)
  await screen.findByRole('heading', { name: 'Mochila' })
  return { ...rendered, repositories, luggage, user: userEvent.setup() }
}

const textarea = () =>
  screen.getByRole('textbox', { name: 'Descripción de la maleta' })

describe('Descripción de la maleta (detalle)', () => {
  it('sin descripción: "Añadir descripción" → escribir varias líneas → salir del campo guarda', async () => {
    const { user, repositories, luggage } = await openLuggage()

    await user.click(screen.getByRole('button', { name: 'Añadir descripción' }))
    expect(textarea()).toHaveFocus()
    expect(textarea()).toHaveAttribute('maxlength', '1000')
    // Intro hace salto de línea (no guarda): es un campo de varias líneas.
    await user.keyboard('Japón{Enter}Hace frío')
    await user.tab() // salir del campo = guardar

    expect(await screen.findByText(/Japón/)).toHaveTextContent(
      'Japón Hace frío',
    )
    expect(await repositories.luggages.getById(luggage.id)).toMatchObject({
      description: 'Japón\nHace frío',
    })
  })

  it('Escape cancela sin guardar', async () => {
    const { user, repositories, luggage } = await openLuggage()

    await user.click(screen.getByRole('button', { name: 'Añadir descripción' }))
    await user.keyboard('Borrador{Escape}')

    expect(
      screen.getByRole('button', { name: 'Añadir descripción' }),
    ).toBeInTheDocument()
    expect(await repositories.luggages.getById(luggage.id)).toMatchObject({
      description: '',
    })
  })

  it('con descripción: el lápiz permite editarla, y vaciarla la borra', async () => {
    const { user, repositories, luggage } = await openLuggage('Plantilla')
    expect(screen.getByText('Plantilla')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Editar descripción' }))
    expect(textarea()).toHaveValue('Plantilla')
    await user.clear(textarea())
    await user.tab()

    expect(
      await screen.findByRole('button', { name: 'Añadir descripción' }),
    ).toBeInTheDocument()
    expect(await repositories.luggages.getById(luggage.id)).toMatchObject({
      description: '',
    })
  })
})

describe('Descripción en la tarjeta del listado', () => {
  it('muestra solo la primera línea, también en el nombre accesible', async () => {
    const repositories = createTestRepositories()
    await repositories.luggages.create({
      name: 'Mochila',
      description: 'Japón, 2 semanas\nLlevar adaptador',
    })
    renderApp('/', repositories)

    const card = await screen.findByRole('link', {
      name: 'Mochila, Japón, 2 semanas, Vacía',
    })
    expect(card).toHaveTextContent('Japón, 2 semanas')
    expect(card).not.toHaveTextContent('Llevar adaptador')
  })

  describe('larga: plegada por defecto, con "Ver más" que se recuerda', () => {
    const long = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco'].join('\n')

    it('se ve plegada y "Ver más" la abre; "Ver menos" la vuelve a plegar', async () => {
      const { user } = await openLuggage(long)
      const toggle = () =>
        screen.getByRole('button', { name: /^Ver (más|menos)$/ })

      // Plegada: no quita sitio a la lista hasta que se abre.
      expect(toggle()).toHaveTextContent('Ver más')
      expect(toggle()).toHaveAttribute('aria-expanded', 'false')

      await user.click(toggle())
      expect(toggle()).toHaveTextContent('Ver menos')
      expect(toggle()).toHaveAttribute('aria-expanded', 'true')

      await user.click(toggle())
      expect(toggle()).toHaveTextContent('Ver más')
    })

    it('abrirla se recuerda al salir y volver a la maleta', async () => {
      const { user, router, luggage } = await openLuggage(long)

      await user.click(screen.getByRole('button', { name: 'Ver más' }))
      await router.navigate('/')
      await router.navigate(`/luggages/${luggage.id}`)

      expect(
        await screen.findByRole('button', { name: 'Ver menos' }),
      ).toBeInTheDocument()
    })

    it('una descripción corta no lleva "Ver más"', async () => {
      await openLuggage('Playa en julio')

      expect(
        screen.queryByRole('button', { name: /^Ver (más|menos)$/ }),
      ).not.toBeInTheDocument()
    })
  })
})
