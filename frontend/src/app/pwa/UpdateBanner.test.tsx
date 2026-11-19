import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { db } from '@/shared/db/db'
import { AppUpdates } from './AppUpdates'
import { UpdateBanner } from './UpdateBanner'

describe('UpdateBanner', () => {
  it('muestra el mensaje y llama a la acción', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    const onDismiss = vi.fn()
    render(
      <UpdateBanner
        message="Nueva versión disponible."
        actionLabel="Actualizar"
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Nueva versión disponible.',
    )
    await user.click(screen.getByRole('button', { name: 'Actualizar' }))
    await user.click(screen.getByRole('button', { name: 'Luego' }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('sin onDismiss no se puede posponer (no hay "Luego")', () => {
    render(
      <UpdateBanner message="X" actionLabel="Recargar" onAction={() => {}} />,
    )

    expect(
      screen.queryByRole('button', { name: 'Luego' }),
    ).not.toBeInTheDocument()
  })
})

describe('AppUpdates', () => {
  it('sin novedades no muestra nada', () => {
    const { container } = render(<AppUpdates />)

    expect(container).toBeEmptyDOMElement()
  })

  it('si otra pestaña actualiza la base de datos, pide recargar (sin "Luego")', () => {
    render(<AppUpdates />)

    // Es el evento que lanza IndexedDB cuando otra pestaña abre la BD con
    // una versión nueva (una migración).
    act(() => {
      db.on('versionchange').fire(new Event('versionchange'))
    })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Equipao se ha actualizado en otra pestaña.',
    )
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Luego' }),
    ).not.toBeInTheDocument()
  })
})
