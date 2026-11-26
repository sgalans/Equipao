import { describe, expect, it } from 'vitest'
import {
  isFullyDone,
  isFullyPacked,
  itemsProgress,
  mergedCounts,
  packingProgress,
  toggledPackedCount,
} from './packing'

const q = (nAlreadyPacked: number, num: number) => ({ num, nAlreadyPacked })

describe('isFullyPacked', () => {
  it.each([
    [q(0, 1), false],
    [q(1, 1), true],
    [q(2, 5), false],
    [q(5, 5), true],
    // Tras cambiar la cantidad (suba o baje) deja de estar listo:
    [q(5, 6), false],
    [q(5, 4), false],
  ])('%o → %s', (counts, expected) => {
    expect(isFullyPacked(counts)).toBe(expected)
  })
})

describe('toggledPackedCount (todo o nada)', () => {
  it('sin guardar → guarda todas las unidades', () => {
    expect(toggledPackedCount(q(0, 5))).toBe(5)
  })

  it('completo → las saca todas', () => {
    expect(toggledPackedCount(q(5, 5))).toBe(0)
  })

  it('no listo tras cambiar la cantidad (5/6 o 5/4) → lo marca con la actual', () => {
    expect(toggledPackedCount(q(5, 6))).toBe(6)
    expect(toggledPackedCount(q(5, 4))).toBe(4)
  })
})

describe('itemsProgress (progreso de un compartimento)', () => {
  it('cuenta artículos completos, no unidades', () => {
    // 5 calcetines guardados pesan lo mismo que 1 pasaporte: 1 artículo.
    expect(itemsProgress([q(5, 5), q(0, 1), q(2, 3)])).toEqual({
      done: 1,
      total: 3,
    })
  })

  it('sin artículos → 0 de 0', () => {
    expect(itemsProgress([])).toEqual({ done: 0, total: 0 })
  })
})

describe('packingProgress (progreso de la maleta, por bloques)', () => {
  const loose = (packed: number, num: number) => ({
    ...q(packed, num),
    compartmentId: null,
  })
  const inside = (packed: number, num: number) => ({
    ...q(packed, num),
    compartmentId: 'neceser',
  })

  it('cada suelto es un bloque y cada compartimento otro (listo solo si está marcado)', () => {
    const progress = packingProgress(
      [loose(1, 1), loose(0, 1), inside(1, 1), inside(1, 1)],
      [{ isReady: true }, { isReady: false }],
    )

    // Sueltos: 1 de 2. Compartimentos: 1 de 2. Total: 2 de 4.
    expect(progress).toEqual({ done: 2, total: 4 })
  })

  it('los artículos DE DENTRO no cuentan por separado', () => {
    // 10 artículos guardados en un neceser sin marcar: 0 de 1.
    const entries = Array.from({ length: 10 }, () => inside(1, 1))

    expect(packingProgress(entries, [{ isReady: false }])).toEqual({
      done: 0,
      total: 1,
    })
  })

  it('un compartimento marcado cuenta como listo aunque falten artículos', () => {
    expect(packingProgress([inside(0, 1)], [{ isReady: true }])).toEqual({
      done: 1,
      total: 1,
    })
  })
})

describe('isFullyDone', () => {
  it('true solo si todo está hecho', () => {
    expect(isFullyDone({ done: 3, total: 3 })).toBe(true)
    expect(isFullyDone({ done: 2, total: 3 })).toBe(false)
  })

  it('una maleta vacía no está "hecha"', () => {
    expect(isFullyDone({ done: 0, total: 0 })).toBe(false)
  })
})

describe('mergedCounts (unir dos artículos en una maleta)', () => {
  it.each([
    // [a, b, resultado]
    [q(1, 1), q(3, 3), q(3, 3)], // los dos guardados → guardado, la mayor
    [q(2, 2), q(0, 3), q(0, 3)], // uno sin marcar → sin marcar
    [q(1, 2), q(2, 4), q(0, 4)], // ninguno listo → sin marcar
    [q(0, 5), q(0, 1), q(0, 5)], // sin guardar → cantidad mayor
  ])('%j + %j → %j', (a, b, expected) => {
    expect(mergedCounts(a, b)).toEqual(expected)
  })
})
