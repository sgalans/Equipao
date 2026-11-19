import { describe, expect, it, vi } from 'vitest'
import { requestPersistentStorage } from './persistentStorage'

describe('requestPersistentStorage', () => {
  it('si ya es persistente, no vuelve a pedirlo', async () => {
    const storage = {
      persisted: vi.fn().mockResolvedValue(true),
      persist: vi.fn(),
    }

    expect(await requestPersistentStorage(storage)).toBe(true)
    expect(storage.persist).not.toHaveBeenCalled()
  })

  it('si no lo es, lo pide y devuelve la respuesta del navegador', async () => {
    const storage = {
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(true),
    }

    expect(await requestPersistentStorage(storage)).toBe(true)
    expect(storage.persist).toHaveBeenCalledOnce()
  })

  it('sin soporte de la API, o si falla, no rompe nada', async () => {
    expect(await requestPersistentStorage(undefined)).toBe(false)
    const failing = {
      persisted: vi.fn().mockRejectedValue(new Error('no permitido')),
      persist: vi.fn(),
    }
    expect(await requestPersistentStorage(failing)).toBe(false)
  })
})
