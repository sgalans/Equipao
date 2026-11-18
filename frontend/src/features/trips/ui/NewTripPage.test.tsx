import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render'

/**
 * Tests de la pantalla /trips/new como los vería un usuario: buscamos los
 * campos por su etiqueta (getByLabelText), lo que de paso comprueba que la
 * accesibilidad label ↔ input está bien conectada.
 */
async function fillTripForm(
  user: ReturnType<typeof userEvent.setup>,
  values: { name?: string; startDate?: string; endDate?: string },
) {
  if (values.name !== undefined) {
    await user.type(screen.getByLabelText('Nombre'), values.name)
  }
  if (values.startDate !== undefined) {
    await user.type(screen.getByLabelText('Inicio'), values.startDate)
  }
  if (values.endDate !== undefined) {
    await user.type(screen.getByLabelText('Fin'), values.endDate)
  }
}

describe('NewTripPage', () => {
  it('se llega desde la lista con el botón "Nuevo viaje"', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/')

    await user.click(await screen.findByRole('link', { name: 'Nuevo viaje' }))

    expect(router.state.location.pathname).toBe('/trips/new')
    expect(
      screen.getByRole('heading', { name: 'Nuevo viaje' }),
    ).toBeInTheDocument()
  })

  it('crea el viaje, vuelve a la lista y lo muestra', async () => {
    const user = userEvent.setup()
    const { router, repositories } = renderApp('/trips/new')

    await fillTripForm(user, {
      name: '  Japón  ',
      startDate: '2027-04-01',
      endDate: '2027-04-15',
    })
    await user.click(screen.getByRole('button', { name: 'Crear viaje' }))

    expect(await screen.findByText('Japón')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    // Comprobamos también lo guardado: normalizado por Zod (sin espacios).
    const [saved] = await repositories.trips.list()
    expect(saved).toMatchObject({
      name: 'Japón',
      startDate: '2027-04-01',
      endDate: '2027-04-15',
    })
  })

  it('muestra los errores de cada campo y no guarda nada', async () => {
    const user = userEvent.setup()
    const { repositories } = renderApp('/trips/new')

    await user.click(screen.getByRole('button', { name: 'Crear viaje' }))

    expect(
      await screen.findByText('El nombre es obligatorio'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Introduce una fecha válida')).toHaveLength(2)
    // El campo queda marcado como inválido para los lectores de pantalla.
    expect(screen.getByLabelText('Nombre')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription(
      'El nombre es obligatorio',
    )
    expect(await repositories.trips.list()).toEqual([])
  })

  it('señala el campo "Fin" si es anterior al inicio', async () => {
    const user = userEvent.setup()
    const { repositories } = renderApp('/trips/new')

    await fillTripForm(user, {
      name: 'Japón',
      startDate: '2027-04-15',
      endDate: '2027-04-01',
    })
    await user.click(screen.getByRole('button', { name: 'Crear viaje' }))

    expect(screen.getByLabelText('Fin')).toHaveAccessibleDescription(
      'La fecha de fin no puede ser anterior a la de inicio',
    )
    expect(screen.getByLabelText('Inicio')).not.toHaveAttribute('aria-invalid')
    expect(await repositories.trips.list()).toEqual([])
  })

  it('"Cancelar" vuelve a la lista sin guardar', async () => {
    const user = userEvent.setup()
    const { router, repositories } = renderApp('/trips/new')

    await fillTripForm(user, { name: 'A medias' })
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(router.state.location.pathname).toBe('/')
    expect(await repositories.trips.list()).toEqual([])
  })
})
