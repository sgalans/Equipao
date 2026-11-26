import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useNotifications } from '@/shared/ui/notifications/notificationStore'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

afterEach(() => {
  useNotifications.setState({ message: null })
  // navigator.share no existe en jsdom: lo quitamos si un test lo puso.
  Reflect.deleteProperty(navigator, 'share')
  vi.restoreAllMocks()
})

/** Maleta "Mallorca" con Camisetas ×3 suelto y un Neceser con Cepillo. */
async function openMallorca() {
  const repositories = createTestRepositories()
  const luggage = await repositories.luggages.create({ name: 'Mallorca' })
  const shirts = await repositories.items.create({ name: 'Camisetas' })
  await repositories.quantities.add({
    luggageId: luggage.id,
    itemId: shirts.id,
    num: 3,
    nAlreadyPacked: 3,
  })
  const kit = await repositories.compartments.create({
    luggageId: luggage.id,
    name: 'Neceser',
  })
  const brush = await repositories.items.create({ name: 'Cepillo' })
  await repositories.quantities.add({
    luggageId: luggage.id,
    itemId: brush.id,
    compartmentId: kit.id,
    num: 1,
    nAlreadyPacked: 0,
  })
  // setup() ANTES de espiar el portapapeles: userEvent instala el suyo.
  const user = userEvent.setup()
  renderApp(`/luggages/${luggage.id}`, repositories)
  await screen.findByRole('heading', { name: 'Mallorca', level: 1 })
  return { user, repositories }
}

const expectedText = [
  '🧳 Mallorca',
  '',
  '- Camisetas ×3',
  '',
  'Neceser:',
  '- Cepillo',
].join('\n')

describe('Compartir una maleta', () => {
  it('abre la hoja nativa de compartir con la maleta como texto (sin lo ya guardado)', async () => {
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    })
    const { user } = await openMallorca()

    await user.click(screen.getByRole('button', { name: 'Compartir maleta' }))

    expect(share).toHaveBeenCalledWith({
      title: 'Mallorca',
      text: expectedText,
    })
  })

  it('sin hoja nativa, copia la lista y lo dice', async () => {
    const { user } = await openMallorca()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')

    await user.click(screen.getByRole('button', { name: 'Compartir maleta' }))

    expect(writeText).toHaveBeenCalledWith(expectedText)
    expect(
      await screen.findByText('Lista copiada. Pégala donde quieras.'),
    ).toBeInTheDocument()
  })

  /** Abre la ventana de copiar a mano (sin hoja ni portapapeles). */
  async function openManualCopy() {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { user } = await openMallorca()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new DOMException('no permitido', 'NotAllowedError'),
    )
    await user.click(screen.getByRole('button', { name: 'Compartir maleta' }))
    const dialog = await screen.findByRole('dialog', { name: 'Copia la lista' })
    return { user, dialog }
  }

  it('si tampoco hay portapapeles, muestra la lista (sin seleccionar) para copiarla', async () => {
    const { dialog } = await openManualCopy()

    const field = within(dialog).getByRole('textbox', {
      name: 'Lista para copiar',
    })
    expect(field).toHaveValue(expectedText)
    expect(field).not.toHaveFocus()
    // Nada de "No se ha podido guardar": no es un fallo de guardado.
    expect(screen.queryByText(/No se ha podido/)).not.toBeInTheDocument()
  })

  it('"Copiar todo" copia el texto entero, avisa y cierra', async () => {
    const { user, dialog } = await openManualCopy()
    // jsdom no implementa execCommand: lo simulamos (en Safari existe).
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    })
    const field = within(dialog).getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Lista para copiar',
    })
    let selected = ''
    execCommand.mockImplementation(() => {
      selected = field.value.slice(field.selectionStart, field.selectionEnd)
      return true
    })

    await user.click(
      within(dialog).getByRole('button', { name: 'Copiar todo' }),
    )

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(selected).toBe(expectedText)
    expect(
      await screen.findByText('Lista copiada. Pégala donde quieras.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    Reflect.deleteProperty(document, 'execCommand')
  })

  it('si "Copiar todo" no puede, explica cómo copiar a mano', async () => {
    const { user, dialog } = await openManualCopy()

    await user.click(
      within(dialog).getByRole('button', { name: 'Copiar todo' }),
    )

    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Mantén pulsado el texto',
    )
  })
})

describe('Importar una maleta', () => {
  it('desde "Mis maletas" → pegar → vista previa → crea la maleta y la abre', async () => {
    const repositories = createTestRepositories()
    const user = userEvent.setup()
    const { router } = renderApp('/', repositories)

    await user.click(await screen.findByRole('link', { name: 'Importar' }))
    const field = await screen.findByRole('textbox', {
      name: 'Pega aquí la lista',
    })
    expect(screen.getByRole('button', { name: 'Crear maleta' })).toBeDisabled()

    await user.click(field)
    await user.paste(expectedText)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Se creará «Mallorca»: 2 artículos, 1 compartimento.',
    )
    await user.click(screen.getByRole('button', { name: 'Crear maleta' }))

    expect(
      await screen.findByRole('heading', { name: 'Mallorca', level: 1 }),
    ).toBeInTheDocument()
    expect(router.state.historyAction).toBe('REPLACE')
    const [luggage] = await repositories.luggages.list()
    const entries = await repositories.quantities.listEntriesByLuggage(
      luggage.id,
    )
    expect(entries.map((e) => [e.itemName, e.num, e.nAlreadyPacked])).toEqual([
      ['Camisetas', 3, 0],
      ['Cepillo', 1, 0],
    ])
  })

  it('una lista cualquiera se importa como "Maleta importada"', async () => {
    const user = userEvent.setup()
    renderApp('/import')

    await user.click(
      await screen.findByRole('textbox', { name: 'Pega aquí la lista' }),
    )
    await user.paste('Toalla\nCrema solar')

    expect(screen.getByRole('status')).toHaveTextContent(
      'Se creará «Maleta importada»: 2 artículos.',
    )
  })
})
