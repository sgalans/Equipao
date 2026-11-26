import { describe, expect, it, vi } from 'vitest'
import { createTestRepositories } from '@/test/repositories'
import { parseLuggageText } from '../domain/luggageText'
import { IMPORTED_LUGGAGE_NAME, importLuggage } from './importLuggage'

const text = [
  '🧳 Mallorca',
  '',
  '- Camisetas ×3',
  '- cámara',
  '',
  'Neceser:',
  '- Cepillo de dientes',
].join('\n')

describe('importLuggage', () => {
  it('crea la maleta con sus compartimentos y artículos, sin nada guardado', async () => {
    const repos = createTestRepositories()

    const luggage = await importLuggage(repos, parseLuggageText(text))

    expect(luggage.name).toBe('Mallorca')
    const [kit] = await repos.compartments.listByLuggage(luggage.id)
    expect(kit.name).toBe('Neceser')
    const entries = await repos.quantities.listEntriesByLuggage(luggage.id)
    expect(
      entries.map((e) => [
        e.itemName,
        e.num,
        e.nAlreadyPacked,
        e.compartmentId,
      ]),
    ).toEqual([
      ['Camisetas', 3, 0, null],
      ['cámara', 1, 0, null],
      ['Cepillo de dientes', 1, 0, kit.id],
    ])
  })

  it('reutiliza los artículos del catálogo por nombre (sin duplicarlos)', async () => {
    const repos = createTestRepositories()
    const camera = await repos.items.create({ name: 'Cámara' })

    const luggage = await importLuggage(repos, parseLuggageText(text))

    const entries = await repos.quantities.listEntriesByLuggage(luggage.id)
    expect(entries.find((e) => e.itemId === camera.id)?.itemName).toBe('Cámara')
    expect((await repos.items.list()).map((i) => i.name)).toEqual([
      'Cámara',
      'Camisetas',
      'Cepillo de dientes',
    ])
  })

  it('sin nombre en el texto, la llama "Maleta importada"', async () => {
    const repos = createTestRepositories()

    const luggage = await importLuggage(repos, parseLuggageText('Toalla'))

    expect(luggage.name).toBe(IMPORTED_LUGGAGE_NAME)
  })

  it('si falla a medias, borra la maleta a medio crear (acción compensatoria)', async () => {
    const repos = createTestRepositories()
    vi.spyOn(repos.compartments, 'create').mockRejectedValueOnce(
      new Error('fallo simulado'),
    )

    await expect(importLuggage(repos, parseLuggageText(text))).rejects.toThrow(
      'fallo simulado',
    )

    expect(await repos.luggages.list()).toEqual([])
  })
})
