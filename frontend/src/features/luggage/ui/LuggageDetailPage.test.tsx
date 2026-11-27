import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

/** Maleta (con N artículos) y la app abierta en su detalle. */
async function openLuggage(name = 'Mochila Japón', itemCount = 0) {
  const repositories = createTestRepositories()
  const luggage = await repositories.luggages.create({ name })
  for (let i = 1; i <= itemCount; i++) {
    const item = await repositories.items.create({ name: `Artículo ${i}` })
    await repositories.quantities.add({
      luggageId: luggage.id,
      itemId: item.id,
      num: 1,
      nAlreadyPacked: 0,
    })
  }
  const rendered = renderApp(`/luggages/${luggage.id}`, repositories)
  // Esperamos a que cargue (el título aparece cuando useLiveQuery resuelve).
  await screen.findByRole('heading', { name })
  return { ...rendered, luggage }
}

describe('LuggageDetailPage', () => {
  it('muestra "no encontrada" si la maleta no existe', async () => {
    renderApp('/luggages/0190a0a0-0000-7000-8000-000000000000')

    expect(
      await screen.findByRole('heading', {
        name: 'No encontramos esta maleta',
      }),
    ).toBeInTheDocument()
  })

  describe('renombrar en el sitio', () => {
    it('lápiz → escribir → Enter guarda el nuevo nombre', async () => {
      const user = userEvent.setup()
      const { repositories, luggage } = await openLuggage()

      await user.click(screen.getByRole('button', { name: 'Renombrar maleta' }))
      const input = screen.getByRole('textbox', { name: 'Renombrar maleta' })
      // El campo aparece enfocado y con el texto seleccionado: escribir
      // reemplaza el nombre entero, como al renombrar un archivo.
      expect(input).toHaveFocus()
      await user.keyboard('Mochila Corea{Enter}')

      expect(
        await screen.findByRole('heading', { name: 'Mochila Corea' }),
      ).toBeInTheDocument()
      expect(await repositories.luggages.getById(luggage.id)).toMatchObject({
        name: 'Mochila Corea',
      })
    })

    it('tocar el propio título también permite editar', async () => {
      const user = userEvent.setup()
      await openLuggage()

      await user.click(screen.getByRole('heading', { name: 'Mochila Japón' }))

      expect(
        screen.getByRole('textbox', { name: 'Renombrar maleta' }),
      ).toHaveValue('Mochila Japón')
    })

    it('salir del campo (blur) también guarda', async () => {
      const user = userEvent.setup()
      const { repositories, luggage } = await openLuggage()

      await user.click(screen.getByRole('button', { name: 'Renombrar maleta' }))
      await user.keyboard('Neceser')
      await user.tab() // mover el foco fuera = blur

      expect(
        await screen.findByRole('heading', { name: 'Neceser' }),
      ).toBeInTheDocument()
      expect(await repositories.luggages.getById(luggage.id)).toMatchObject({
        name: 'Neceser',
      })
    })

    it('Escape cancela sin guardar', async () => {
      const user = userEvent.setup()
      const { repositories, luggage } = await openLuggage()

      await user.click(screen.getByRole('button', { name: 'Renombrar maleta' }))
      await user.keyboard('Otro nombre{Escape}')

      expect(
        screen.getByRole('heading', { name: 'Mochila Japón' }),
      ).toBeInTheDocument()
      expect(await repositories.luggages.getById(luggage.id)).toEqual(luggage)
    })

    it('un nombre vacío no se guarda: vuelve al anterior', async () => {
      const user = userEvent.setup()
      const { repositories, luggage } = await openLuggage()

      await user.click(screen.getByRole('button', { name: 'Renombrar maleta' }))
      await user.keyboard('{Backspace}{Enter}')

      expect(
        screen.getByRole('heading', { name: 'Mochila Japón' }),
      ).toBeInTheDocument()
      expect(await repositories.luggages.getById(luggage.id)).toEqual(luggage)
    })
  })

  describe('borrar', () => {
    it('"Borrar maleta" es un botón con texto, al final de la maleta', async () => {
      await openLuggage()

      const button = screen.getByRole('button', { name: 'Borrar maleta' })
      expect(button).toHaveTextContent('Borrar maleta')
      // Va DESPUÉS de todo el contenido (y de "Añadir artículos"): lejos
      // de lo que se toca a menudo.
      const add = screen.getByRole('link', { name: 'Añadir artículos' })
      expect(
        add.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })

    it.each([
      [
        2,
        'Se borrarán la maleta y su lista (2 artículos). Los artículos de tu catálogo no se borran.',
      ],
      [
        1,
        'Se borrarán la maleta y su lista (1 artículo). Los artículos de tu catálogo no se borran.',
      ],
      [0, 'Se borrará la maleta.'],
    ])(
      'con %i artículo(s) explica qué se borra y qué no',
      async (count, expected) => {
        const user = userEvent.setup()
        await openLuggage('Mochila Japón', count)

        await user.click(screen.getByRole('button', { name: 'Borrar maleta' }))

        const dialog = await screen.findByRole('dialog', {
          name: '¿Borrar «Mochila Japón»?',
        })
        // findBy: el número de artículos llega con useLiveQuery (asíncrono).
        expect(await within(dialog).findByText(expected)).toBeInTheDocument()
        expect(dialog).toHaveTextContent('Esta acción no se puede deshacer.')
      },
    )

    it('"Cancelar" cierra el diálogo sin borrar', async () => {
      const user = userEvent.setup()
      const { repositories, luggage } = await openLuggage()

      await user.click(screen.getByRole('button', { name: 'Borrar maleta' }))
      // within(dialog): en el navegador, showModal() vuelve inerte el resto
      // de la página; Testing Library no modela `inert`.
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Cancelar',
        }),
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(await repositories.luggages.getById(luggage.id)).toEqual(luggage)
    })

    it('al confirmar borra la maleta y su lista, y vuelve al inicio', async () => {
      const user = userEvent.setup()
      const { repositories, luggage, router } = await openLuggage(
        'Mochila Japón',
        2,
      )

      await user.click(screen.getByRole('button', { name: 'Borrar maleta' }))
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Borrar',
        }),
      )

      expect(
        await screen.findByText(/Aún no tienes maletas/),
      ).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/')
      // replace: la pantalla de la maleta borrada no queda en el historial.
      expect(router.state.historyAction).toBe('REPLACE')
      expect(await repositories.quantities.listByLuggage(luggage.id)).toEqual(
        [],
      )
      // El catálogo sigue intacto.
      expect(await repositories.items.list()).toHaveLength(2)
    })

    it('si el borrado falla, avisa y se queda en la pantalla', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const user = userEvent.setup()
      const repositories = createTestRepositories()
      const luggage = await repositories.luggages.create({ name: 'Neceser' })
      // Inyección de dependencias: un repositorio cuyo remove falla.
      const failing = {
        ...repositories,
        luggages: {
          ...repositories.luggages,
          remove: () => Promise.reject(new Error('IndexedDB no disponible')),
        },
      }
      const { router } = renderApp(`/luggages/${luggage.id}`, failing)

      await user.click(
        await screen.findByRole('button', { name: 'Borrar maleta' }),
      )
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Borrar',
        }),
      )

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No se ha podido completar la acción',
      )
      expect(router.state.location.pathname).toBe(`/luggages/${luggage.id}`)
      vi.restoreAllMocks()
    })
  })
})
