import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'
import { SAVE_ERROR_MESSAGE, useNotifications } from './notificationStore'
import { Toaster } from './Toaster'

afterEach(() => {
  // El store es global (módulo): se limpia para que no se filtre entre tests.
  useNotifications.setState({ message: null })
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Toaster', () => {
  it('muestra el aviso, se cierra con "×" y desaparece solo a los 5 s', async () => {
    vi.useFakeTimers()
    render(<Toaster />)

    act(() => useNotifications.getState().show('Hola'))
    expect(screen.getByText('Hola')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByText('Hola')).not.toBeInTheDocument()
  })

  it('el botón "Cerrar aviso" lo oculta', async () => {
    const user = userEvent.setup()
    render(<Toaster />)
    act(() => useNotifications.getState().show('Hola'))

    await user.click(screen.getByRole('button', { name: 'Cerrar aviso' }))

    expect(screen.queryByText('Hola')).not.toBeInTheDocument()
  })
})

describe('Fallos que antes eran silenciosos', () => {
  it('si falla empaquetar un artículo, el usuario ve un aviso', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    const repositories = createTestRepositories()
    const luggage = await repositories.luggages.create({ name: 'Mochila' })
    const item = await repositories.items.create({ name: 'Toalla' })
    await repositories.quantities.add({
      luggageId: luggage.id,
      itemId: item.id,
      num: 1,
      nAlreadyPacked: 0,
    })
    const failing = {
      ...repositories,
      quantities: {
        ...repositories.quantities,
        togglePacked: () => Promise.reject(new Error('Almacenamiento lleno')),
      },
    }
    renderApp(`/luggages/${luggage.id}`, failing)

    await user.click(await screen.findByRole('checkbox', { name: 'Toalla' }))

    expect(await screen.findByText(SAVE_ERROR_MESSAGE)).toBeInTheDocument()
  })
})
