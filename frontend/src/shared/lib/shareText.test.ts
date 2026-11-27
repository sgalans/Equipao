import { afterEach, describe, expect, it, vi } from 'vitest'
import { shareText } from './shareText'

const data = { title: 'Mallorca', text: '🧳 Mallorca' }

afterEach(() => {
  vi.restoreAllMocks()
})

/** `navigator` falso con lo que cada test necesite. */
function fakeNavigator({
  share,
  writeText,
}: {
  share?: (data: ShareData) => Promise<void>
  writeText?: (text: string) => Promise<void>
}) {
  return {
    share,
    clipboard: writeText ? { writeText } : undefined,
  } as unknown as Navigator
}

describe('shareText', () => {
  it('con la Web Share API, abre la hoja nativa', async () => {
    const share = vi.fn(async () => {})
    const writeText = vi.fn(async () => {})

    expect(await shareText(data, fakeNavigator({ share, writeText }))).toBe(
      'shared',
    )
    expect(share).toHaveBeenCalledWith(data)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('sin ella, copia al portapapeles', async () => {
    const writeText = vi.fn(async () => {})

    expect(await shareText(data, fakeNavigator({ writeText }))).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('🧳 Mallorca')
  })

  it('cancelar la hoja no es un error (ni se intenta copiar)', async () => {
    const writeText = vi.fn(async () => {})
    const share = async () => {
      throw new DOMException('cancelado', 'AbortError')
    }

    expect(await shareText(data, fakeNavigator({ share, writeText }))).toBe(
      'cancelled',
    )
    expect(writeText).not.toHaveBeenCalled()
  })

  it('si la hoja falla por otro motivo (p. ej. NotAllowedError), copia', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const writeText = vi.fn(async () => {})
    const share = async () => {
      throw new DOMException('no permitido', 'NotAllowedError')
    }

    expect(await shareText(data, fakeNavigator({ share, writeText }))).toBe(
      'copied',
    )
  })

  it('sin hoja ni portapapeles (p. ej. por HTTP en el iPhone): "manual"', async () => {
    expect(await shareText(data, fakeNavigator({}))).toBe('manual')
  })

  it('si también falla el portapapeles: "manual" (nunca lanza)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const writeText = async () => {
      throw new DOMException('no permitido', 'NotAllowedError')
    }

    expect(await shareText(data, fakeNavigator({ writeText }))).toBe('manual')
  })
})
